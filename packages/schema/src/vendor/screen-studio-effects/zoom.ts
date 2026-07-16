/**
 * Zoom evaluation engine — spring-animated camera framing.
 *
 * This is the main algorithm that produces the final crop bounds for each
 * frame of a screen recording. It implements the "Screen Studio effect":
 *
 * 1. **Zoom transitions** between segments use spring easing (not linear/cubic).
 *    The spring constants produce a natural, slightly bouncy feel on zoom-in
 *    and a softer ease-out.
 *
 * 2. **Viewport panning** in auto-mode: the viewport locks its center on
 *    segment entry and only pans when the cursor exits a "safe zone" (inner
 *    70% of viewport). Panning is spring-animated, not instant.
 *
 * 3. **Jitter cancellation**: before panning, a 1-second lookahead checks if
 *    the cursor will return to the safe zone. If so, the pan is skipped —
 *    preventing distracting camera jitter from brief cursor excursions.
 *
 * 4. **Trajectory-averaged targeting**: when panning does occur, the target
 *    is averaged over 0.5s of future cursor positions, smoothing out the
 *    pan destination.
 *
 * Coordinate system (from Cap):
 *   SegmentBounds define where source [0,1]×[0,1] maps in "scaled zoom space".
 *   For 2x zoom centered: tl=(-0.5,-0.5), br=(1.5,1.5).
 *   Conversion to crop: zoom = brX - tlX; x = -tlX/zoom; y = -tlY/zoom; w = h = 1/zoom.
 *
 * Ported from Cap (https://github.com/CapSoftware/Cap).
 */

import type { CropBounds, SpringConfig, ZoomSegment } from './types.js'
import { stepSpring2D, type SpringState2D } from './spring.js' // SpringState2D used in stepVpSpring

// ─── Spring constants for zoom transitions ───────────────────────────────────

const SCREEN_SPRING_STIFFNESS = 200.0
const SCREEN_SPRING_DAMPING = 40.0
const SCREEN_SPRING_MASS = 2.25

/** Edge trigger margin: pan starts when cursor is within 15% of viewport edge. */
const VIEWPORT_EDGE_THRESH = 0.15

/** Lookahead window (seconds) for jitter cancellation. */
const RECENTER_LOOKAHEAD_S = 1
/** Number of samples in the lookahead window. */
const RECENTER_LOOKAHEAD_SAMPLES = 10
/** Window (seconds) for trajectory-averaged recenter targeting. */
const RECENTER_AVG_WINDOW_S = 0.5

/** Duration of a full zoom-in or zoom-out spring transition (seconds). */
const ZOOM_DURATION = 1.0

// ─── Viewport spring presets ─────────────────────────────────────────────────

/**
 * Built-in viewport spring presets.
 *
 * - **focused**: tighter, snappier spring — camera tracks cursor responsively
 * - **smooth**: gentler, more damped — camera movement is cinematic and slow
 */
export const VP_PRESETS: Record<'focused' | 'smooth', SpringConfig> = {
  focused: { tension: 300, mass: 6.75, friction: 120 },
  smooth: { tension: 240, mass: 3.375, friction: 80 },
}

// ─── Spring easing ───────────────────────────────────────────────────────────

function springEase(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const omega0 = Math.sqrt(SCREEN_SPRING_STIFFNESS / SCREEN_SPRING_MASS)
  const zeta = SCREEN_SPRING_DAMPING / (2 * Math.sqrt(SCREEN_SPRING_STIFFNESS * SCREEN_SPRING_MASS))
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega0 * t)
    return 1 - decay * (Math.cos(omegaD * t) + (zeta * omega0 / omegaD) * Math.sin(omegaD * t))
  }
  const decay = Math.exp(-omega0 * t)
  return 1 - decay * (1 + omega0 * t)
}

function springEaseOut(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const omega0 = Math.sqrt(SCREEN_SPRING_STIFFNESS / SCREEN_SPRING_MASS) * 0.9
  const zeta =
    (SCREEN_SPRING_DAMPING / (2 * Math.sqrt(SCREEN_SPRING_STIFFNESS * SCREEN_SPRING_MASS))) * 1.15
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega0 * t)
    return 1 - decay * (Math.cos(omegaD * t) + (zeta * omega0 / omegaD) * Math.sin(omegaD * t))
  }
  const decay = Math.exp(-omega0 * t)
  return 1 - decay * (1 + omega0 * t)
}

function instantEase(t: number): number {
  return t <= 0 ? 0 : 1
}

function tClamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// ─── SegmentBounds ───────────────────────────────────────────────────────────

interface SegmentBounds {
  tlX: number; tlY: number
  brX: number; brY: number
}

function defaultBounds(): SegmentBounds {
  return { tlX: 0, tlY: 0, brX: 1, brY: 1 }
}

function lerpBounds(a: SegmentBounds, b: SegmentBounds, t: number): SegmentBounds {
  const u = 1 - t
  return {
    tlX: a.tlX * u + b.tlX * t,
    tlY: a.tlY * u + b.tlY * t,
    brX: a.brX * u + b.brX * t,
    brY: a.brY * u + b.brY * t,
  }
}

function boundsToCrop(b: SegmentBounds): CropBounds {
  const zoom = b.brX - b.tlX
  if (zoom <= 0) return { x: 0, y: 0, w: 1, h: 1 }
  return { x: -b.tlX / zoom, y: -b.tlY / zoom, w: 1 / zoom, h: 1 / zoom }
}

function segmentBoundsFor(amount: number, cx: number, cy: number): SegmentBounds {
  const half = 0.5 / amount
  const clampedCx = Math.max(half, Math.min(1 - half, cx))
  const clampedCy = Math.max(half, Math.min(1 - half, cy))
  const tlX = -amount * clampedCx + 0.5
  const tlY = -amount * clampedCy + 0.5
  return { tlX, tlY, brX: tlX + amount, brY: tlY + amount }
}

// ─── Segment cursor lookup ───────────────────────────────────────────────────

interface SegmentsCursor {
  time: number
  segment: ZoomSegment | null
  prevSegment: ZoomSegment | null
  segments: ZoomSegment[]
}

function buildSegmentsCursor(time: number, segments: ZoomSegment[]): SegmentsCursor {
  const idx = segments.findIndex((s) => time > s.sourceStart && time <= s.sourceEnd)
  if (idx >= 0) {
    return {
      time,
      segment: segments[idx],
      prevSegment: idx > 0 ? segments[idx - 1] : null,
      segments,
    }
  }
  let prevSegment: ZoomSegment | null = null
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].sourceEnd <= time) {
      prevSegment = segments[i]
      break
    }
  }
  return { time, segment: null, prevSegment, segments }
}

// ─── Zoom focus center ───────────────────────────────────────────────────────

function zoomFocusFor(
  seg: ZoomSegment,
  cursorCenter: { u: number; v: number } | undefined,
): { cx: number; cy: number } {
  if (seg.manualCenter) {
    return { cx: seg.manualCenter[0], cy: seg.manualCenter[1] }
  }
  return { cx: cursorCenter?.u ?? 0.5, cy: cursorCenter?.v ?? 0.5 }
}

// ─── InterpolatedZoom ────────────────────────────────────────────────────────

interface InterpolatedZoom {
  t: number
  bounds: SegmentBounds
}

function computeInterpolatedZoom(
  cursor: SegmentsCursor,
  cursorCenter: { u: number; v: number } | undefined,
  easeIn: (t: number) => number,
  easeOut: (t: number) => number,
): InterpolatedZoom {
  const def = defaultBounds()
  const { segment: seg, prevSegment: prev, time } = cursor

  if (!seg && !prev) return { t: 0, bounds: def }

  if (prev && !seg) {
    const zoomT = easeOut(tClamp((time - prev.sourceEnd) / ZOOM_DURATION))
    const { cx, cy } = zoomFocusFor(prev, cursorCenter)
    const prevBounds = segmentBoundsFor(prev.amount, cx, cy)
    return { t: 1 - zoomT, bounds: lerpBounds(prevBounds, def, zoomT) }
  }

  if (!prev && seg) {
    const t = easeIn(tClamp((time - seg.sourceStart) / ZOOM_DURATION))
    const { cx, cy } = zoomFocusFor(seg, cursorCenter)
    const segBounds = segmentBoundsFor(seg.amount, cx, cy)
    return { t, bounds: lerpBounds(def, segBounds, t) }
  }

  if (!prev || !seg) return { t: 0, bounds: def }

  const { cx: pcx, cy: pcy } = zoomFocusFor(prev, cursorCenter)
  const { cx: scx, cy: scy } = zoomFocusFor(seg, cursorCenter)
  const prevBounds = segmentBoundsFor(prev.amount, pcx, pcy)
  const segBounds = segmentBoundsFor(seg.amount, scx, scy)
  const zoomT = easeIn(tClamp((time - seg.sourceStart) / ZOOM_DURATION))

  if (seg.sourceStart === prev.sourceEnd) {
    return { t: 1, bounds: lerpBounds(prevBounds, segBounds, zoomT) }
  }

  if (seg.sourceStart - prev.sourceEnd < ZOOM_DURATION) {
    const minCursor = buildSegmentsCursor(seg.sourceStart, cursor.segments)
    const min = computeInterpolatedZoom(minCursor, cursorCenter, easeIn, easeOut)
    return {
      t: min.t * (1 - zoomT) + zoomT,
      bounds: lerpBounds(min.bounds, segBounds, zoomT),
    }
  }

  return { t: zoomT, bounds: lerpBounds(def, segBounds, zoomT) }
}

function interpolatedZoom(
  cursor: SegmentsCursor,
  cursorCenter: { u: number; v: number } | undefined,
): InterpolatedZoom {
  const useInstant = (cursor.segment ?? cursor.prevSegment)?.instantAnimation ?? false
  const easeIn = useInstant ? instantEase : springEase
  const easeOut = useInstant ? instantEase : springEaseOut
  return computeInterpolatedZoom(cursor, cursorCenter, easeIn, easeOut)
}

// ─── ensure_cursor_visible ───────────────────────────────────────────────────

function ensureCursorVisible(
  zoom: InterpolatedZoom,
  cursorX: number,
  cursorY: number,
): InterpolatedZoom {
  const currentZoom = zoom.bounds.brX - zoom.bounds.tlX
  if (currentZoom <= 1.001) return zoom

  const viewportSize = 1 / currentZoom
  const viewportLeft = -zoom.bounds.tlX / currentZoom
  const viewportRight = viewportLeft + viewportSize
  const viewportTop = -zoom.bounds.tlY / currentZoom
  const viewportBottom = viewportTop + viewportSize

  const triggerMargin = viewportSize * VIEWPORT_EDGE_THRESH

  const inSafeZone =
    cursorX >= viewportLeft + triggerMargin &&
    cursorX <= viewportRight - triggerMargin &&
    cursorY >= viewportTop + triggerMargin &&
    cursorY <= viewportBottom - triggerMargin

  if (inSafeZone) return zoom

  const placeMargin = viewportSize * 0.20
  let newVpLeft = viewportLeft
  let newVpTop = viewportTop

  if (cursorX < viewportLeft + triggerMargin) newVpLeft = cursorX - placeMargin
  else if (cursorX > viewportRight - triggerMargin)
    newVpLeft = cursorX - viewportSize + placeMargin

  if (cursorY < viewportTop + triggerMargin) newVpTop = cursorY - placeMargin
  else if (cursorY > viewportBottom - triggerMargin)
    newVpTop = cursorY - viewportSize + placeMargin

  newVpLeft = Math.max(0, Math.min(1 - viewportSize, newVpLeft))
  newVpTop = Math.max(0, Math.min(1 - viewportSize, newVpTop))

  const newVpRight = newVpLeft + viewportSize
  const newVpBottom = newVpTop + viewportSize

  if (
    cursorX >= newVpLeft && cursorX <= newVpRight &&
    cursorY >= newVpTop && cursorY <= newVpBottom
  ) {
    const newTlX = -newVpLeft * currentZoom
    const newTlY = -newVpTop * currentZoom
    return {
      t: zoom.t,
      bounds: { tlX: newTlX, tlY: newTlY, brX: newTlX + currentZoom, brY: newTlY + currentZoom },
    }
  }

  // Reduce zoom to fit cursor
  const requiredMargin = 0.05
  const distFromLeft = Math.max(0, cursorX - requiredMargin)
  const distFromRight = Math.max(0, 1 - cursorX - requiredMargin)
  const distFromTop = Math.max(0, cursorY - requiredMargin)
  const distFromBottom = Math.max(0, 1 - cursorY - requiredMargin)
  const effectiveDistX = Math.max(0.001, Math.min(distFromLeft, distFromRight))
  const effectiveDistY = Math.max(0.001, Math.min(distFromTop, distFromBottom))
  const maxZoom = Math.max(1, Math.min(0.5 / effectiveDistX, 0.5 / effectiveDistY))
  const newZoom = Math.min(currentZoom, maxZoom)
  const newVpSize = 1 / newZoom

  const finalLeft = Math.max(0, Math.min(1 - newVpSize, cursorX - newVpSize / 2))
  const finalTop = Math.max(0, Math.min(1 - newVpSize, cursorY - newVpSize / 2))

  const newTlX = -finalLeft * newZoom
  const newTlY = -finalTop * newZoom
  return {
    t: zoom.t,
    bounds: { tlX: newTlX, tlY: newTlY, brX: newTlX + newZoom, brY: newTlY + newZoom },
  }
}

// ─── Stateful zoom evaluator ─────────────────────────────────────────────────

/** Internal viewport spring state — uses X/Y naming for positional clarity. */
interface VpSpring {
  posX: number; posY: number
  velX: number; velY: number
  targetX: number; targetY: number
}

function stepVpSpring(s: VpSpring, dtMs: number, config: SpringConfig): void {
  // Bridge to SpringState2D (posU/posV naming)
  const state: SpringState2D = {
    posU: s.posX, posV: s.posY,
    velU: s.velX, velV: s.velY,
    targetU: s.targetX, targetV: s.targetY,
  }
  stepSpring2D(state, dtMs, config)
  s.posX = state.posU; s.posY = state.posV
  s.velX = state.velU; s.velY = state.velV
}

/** Persistent state for the zoom evaluator. Create with `createZoomState()`. */
export interface ZoomState {
  lockedCenter: { u: number; v: number } | null
  lockedSegStart: number | null
  spring: VpSpring
  lastTimeS: number | null
}

/** Create a fresh zoom state. Pass to `evaluateZoom()` across frames. */
export function createZoomState(): ZoomState {
  return {
    lockedCenter: null,
    lockedSegStart: null,
    spring: { posX: 0.5, posY: 0.5, velX: 0, velY: 0, targetX: 0.5, targetY: 0.5 },
    lastTimeS: null,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate zoom crop bounds at a given source time.
 *
 * This is the main per-frame function. Call it once per frame with the current
 * source time and cursor position. It returns the crop region to apply to the
 * source frame.
 *
 * @param segments - Zoom segments defining when/where to zoom
 * @param sourceTime - Current playback time in seconds
 * @param cursorCenter - Spring-smoothed cursor UV position (from `SmoothedCursor.interpolateAt`)
 * @param state - Persistent state object (create with `createZoomState()`)
 * @param cursorLookahead - Optional: sample cursor UV at any source time (for jitter cancellation)
 * @param springConfig - Optional: viewport spring config (default: `VP_PRESETS.focused`)
 */
export function evaluateZoom(
  segments: ZoomSegment[],
  sourceTime: number,
  cursorCenter?: { u: number; v: number },
  state?: ZoomState,
  cursorLookahead?: (t: number) => { u: number; v: number },
  springConfig?: SpringConfig,
): CropBounds {
  if (segments.length === 0) {
    if (state) {
      state.lockedCenter = null
      state.lockedSegStart = null
      state.lastTimeS = null
    }
    return { x: 0, y: 0, w: 1, h: 1 }
  }

  const cursor = buildSegmentsCursor(sourceTime, segments)
  if (!cursor.segment && !cursor.prevSegment) {
    if (state) {
      state.lockedCenter = null
      state.lockedSegStart = null
      state.lastTimeS = null
    }
    return { x: 0, y: 0, w: 1, h: 1 }
  }

  // Compute frame dt
  let dtMs = 0
  let seekDetected = false
  if (state) {
    if (state.lastTimeS !== null) {
      const d = sourceTime - state.lastTimeS
      if (d > 0 && d < 0.5) {
        dtMs = Math.min(d * 1000, 100)
      } else if (d !== 0) {
        seekDetected = true
      }
    }
    state.lastTimeS = sourceTime
  }

  const activeSeg = cursor.segment ?? cursor.prevSegment
  const isAuto = activeSeg ? !activeSeg.manualCenter : false

  let zoomCenter = cursorCenter
  if (isAuto && state) {
    const curSegStart = cursor.segment?.sourceStart ?? null

    if (curSegStart !== null && curSegStart !== state.lockedSegStart) {
      state.lockedCenter = cursorCenter ? { u: cursorCenter.u, v: cursorCenter.v } : null
      state.lockedSegStart = curSegStart
      if (cursorCenter) {
        state.spring.posX = cursorCenter.u
        state.spring.posY = cursorCenter.v
        state.spring.targetX = cursorCenter.u
        state.spring.targetY = cursorCenter.v
        state.spring.velX = 0
        state.spring.velY = 0
      }
    } else if (!state.lockedCenter) {
      state.lockedCenter = cursorCenter ? { u: cursorCenter.u, v: cursorCenter.v } : null
      if (cursorCenter) {
        state.spring.posX = cursorCenter.u
        state.spring.posY = cursorCenter.v
        state.spring.targetX = cursorCenter.u
        state.spring.targetY = cursorCenter.v
        state.spring.velX = 0
        state.spring.velY = 0
      }
    }

    zoomCenter = state.lockedCenter ?? cursorCenter
  }

  const zoom = interpolatedZoom(cursor, zoomCenter)

  if (!isAuto || !cursorCenter || !state) {
    const finalZoom = isAuto && cursorCenter ? ensureCursorVisible(zoom, cursorCenter.u, cursorCenter.v) : zoom
    return boundsToCrop(finalZoom.bounds)
  }

  // Auto-mode: check cursor against the spring-animated viewport
  const springCenter = { u: state.spring.posX, v: state.spring.posY }
  const actualZoom = interpolatedZoom(cursor, springCenter)
  const z = actualZoom.bounds.brX - actualZoom.bounds.tlX

  if (z > 1.001) {
    const vpSize = 1 / z
    const vpLeft = -actualZoom.bounds.tlX / z
    const vpTop = -actualZoom.bounds.tlY / z
    const triggerMargin = vpSize * VIEWPORT_EDGE_THRESH

    const inSafe =
      cursorCenter.u >= vpLeft + triggerMargin &&
      cursorCenter.u <= vpLeft + vpSize - triggerMargin &&
      cursorCenter.v >= vpTop + triggerMargin &&
      cursorCenter.v <= vpTop + vpSize - triggerMargin

    if (!inSafe) {
      let cancelRecenter = false
      if (cursorLookahead) {
        for (let i = 1; i <= RECENTER_LOOKAHEAD_SAMPLES; i++) {
          const futureT = sourceTime + (RECENTER_LOOKAHEAD_S * i) / RECENTER_LOOKAHEAD_SAMPLES
          const fc = cursorLookahead(futureT)
          const futureInSafe =
            fc.u >= vpLeft + triggerMargin &&
            fc.u <= vpLeft + vpSize - triggerMargin &&
            fc.v >= vpTop + triggerMargin &&
            fc.v <= vpTop + vpSize - triggerMargin
          if (futureInSafe) {
            cancelRecenter = true
            break
          }
        }
      }

      if (!cancelRecenter) {
        let targetU = cursorCenter.u
        let targetV = cursorCenter.v
        if (cursorLookahead && RECENTER_AVG_WINDOW_S > 0) {
          let sumU = cursorCenter.u
          let sumV = cursorCenter.v
          const N = RECENTER_LOOKAHEAD_SAMPLES
          for (let i = 1; i <= N; i++) {
            const fc = cursorLookahead(sourceTime + (RECENTER_AVG_WINDOW_S * i) / N)
            sumU += fc.u
            sumV += fc.v
          }
          targetU = sumU / (N + 1)
          targetV = sumV / (N + 1)
        }
        state.lockedCenter = { u: targetU, v: targetV }
        state.spring.targetX = targetU
        state.spring.targetY = targetV
      }
    }
  }

  // Step the spring (or teleport on seek)
  const config = springConfig ?? VP_PRESETS.focused
  if (seekDetected) {
    state.spring.posX = state.spring.targetX
    state.spring.posY = state.spring.targetY
    state.spring.velX = 0
    state.spring.velY = 0
  } else {
    stepVpSpring(state.spring, dtMs, config)
  }

  // Recompute visual bounds from the spring-smoothed anchor
  if (z > 1.001) {
    const smoothedCenter = { u: state.spring.posX, v: state.spring.posY }
    const visualZoom = interpolatedZoom(cursor, smoothedCenter)
    return boundsToCrop(visualZoom.bounds)
  }

  return boundsToCrop(actualZoom.bounds)
}
