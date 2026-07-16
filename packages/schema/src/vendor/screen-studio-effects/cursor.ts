/**
 * Cursor smoothing pipeline — spring-based cursor interpolation.
 *
 * Raw cursor events from a screen recording are noisy and irregularly spaced.
 * This module transforms them into a smooth, precomputed trajectory that can
 * be sampled at any time with O(log n) lookups.
 *
 * Pipeline: raw events → UV transform → shake filter → densify gaps → spring simulate
 *
 * The spring simulation uses three profiles that switch based on context:
 *   - **Default**: natural, slightly springy cursor following
 *   - **Snappy**: tight response near click events (160ms window)
 *   - **Drag**: heavier, more damped feel during mouse drag
 *
 * Ported from Cap's cursor_interpolation.rs.
 */

import type { CursorEvent, CursorTransform, SmoothedCursor, SpringConfig } from './types.js'
import { solveSpring1d } from './spring.js'

// ─── Spring profiles ─────────────────────────────────────────────────────────

/** Default cursor spring: natural, slightly springy. */
export const SPRING_DEFAULT: SpringConfig = { tension: 170, mass: 1.0, friction: 20 }
/** Snappy spring: tight response near click events. */
export const SPRING_SNAPPY: SpringConfig = { tension: 700, mass: 1.0, friction: 30 }
/** Drag spring: heavier, more damped feel during mouse drags. */
export const SPRING_DRAG: SpringConfig = {
  tension: SPRING_DEFAULT.tension * 0.8,
  mass: Math.max(SPRING_DEFAULT.mass * 1.2, 0.1),
  friction: SPRING_DEFAULT.friction * 1.3,
}

/** Window (ms) around a click event where snappy profile activates. */
const CLICK_REACTION_WINDOW_MS = 160

// ─── Coordinate transform ────────────────────────────────────────────────────

/** Convert screen coordinates to video-frame UV [0-1]. */
export function screenToVideoUV(
  x: number,
  y: number,
  transform: CursorTransform,
): { u: number; v: number } {
  const videoX = (x - transform.windowX) * 2
  const videoY = (y - transform.windowY) * 2
  const u = Math.max(0, Math.min(1, videoX / transform.captureWidth))
  const v = Math.max(0, Math.min(1, videoY / transform.captureHeight))
  return { u, v }
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface MoveEvent {
  timeMs: number
  u: number
  v: number
}

interface ClickEvt {
  timeMs: number
  isDown: boolean
}

interface SpringState {
  posU: number; posV: number
  velU: number; velV: number
  targetU: number; targetV: number
  tension: number; mass: number; friction: number
}

interface SmoothedSample {
  timeMs: number
  u: number; v: number
  velU: number; velV: number
  targetU: number; targetV: number
}

// ─── Shake filter ────────────────────────────────────────────────────────────
// Removes jitter: if three consecutive points form a direction reversal with
// small displacement within a 100ms window, the middle point is dropped.

const SHAKE_THRESHOLD_UV = 0.015
const SHAKE_DETECTION_WINDOW_MS = 100

function filterCursorShake(moves: MoveEvent[]): MoveEvent[] {
  if (moves.length < 3) return moves

  const filtered: MoveEvent[] = [moves[0]]
  let i = 1
  while (i < moves.length - 1) {
    const prev = filtered[filtered.length - 1]
    const curr = moves[i]
    const next = moves[i + 1]

    const timeWindow = next.timeMs - prev.timeMs
    if (timeWindow > SHAKE_DETECTION_WINDOW_MS) {
      filtered.push(curr)
      i++
      continue
    }

    const dxToCurr = curr.u - prev.u
    const dyToCurr = curr.v - prev.v
    const dxToNext = next.u - curr.u
    const dyToNext = next.v - curr.v
    const dot = dxToCurr * dxToNext + dyToCurr * dyToNext
    const isReversal = dot < 0

    const dispCurr = Math.sqrt(dxToCurr ** 2 + dyToCurr ** 2)
    const dispNext = Math.sqrt(dxToNext ** 2 + dyToNext ** 2)
    const isSmall = dispCurr < SHAKE_THRESHOLD_UV && dispNext < SHAKE_THRESHOLD_UV

    if (isReversal && isSmall) {
      i++ // skip — it's jitter
      continue
    }

    filtered.push(curr)
    i++
  }

  if (moves.length > 1) filtered.push(moves[moves.length - 1])
  return filtered
}

// ─── Densify ─────────────────────────────────────────────────────────────────
// Fills gaps > 66ms with linearly interpolated points so the spring simulation
// doesn't skip over large time jumps.

const CURSOR_FRAME_MS = 1000 / 60 // ~16.667ms
const GAP_THRESHOLD_MS = CURSOR_FRAME_MS * 4 // ~66ms
const MIN_TRAVEL_FOR_INTERP = 0.02
const MAX_INTERP_STEPS = 120

function shouldFillGap(from: MoveEvent, to: MoveEvent): boolean {
  const dt = Math.max(0, to.timeMs - from.timeMs)
  if (dt < GAP_THRESHOLD_MS) return false
  const dx = to.u - from.u
  const dy = to.v - from.v
  return Math.sqrt(dx * dx + dy * dy) >= MIN_TRAVEL_FOR_INTERP
}

function densifyCursorMoves(moves: MoveEvent[]): MoveEvent[] {
  if (moves.length < 2) return moves

  const needsFill = moves.some((m, i) => i > 0 && shouldFillGap(moves[i - 1], m))
  if (!needsFill) return moves

  const dense: MoveEvent[] = [moves[0]]
  for (let i = 0; i < moves.length - 1; i++) {
    const from = moves[i]
    const to = moves[i + 1]
    if (shouldFillGap(from, to)) {
      const dtMs = Math.max(0, to.timeMs - from.timeMs)
      const steps = Math.min(Math.max(2, Math.ceil(dtMs / CURSOR_FRAME_MS)), MAX_INTERP_STEPS)
      for (let step = 1; step < steps; step++) {
        const t = step / steps
        dense.push({
          timeMs: from.timeMs + dtMs * t,
          u: from.u + (to.u - from.u) * t,
          v: from.v + (to.v - from.v) * t,
        })
      }
    }
    dense.push(to)
  }
  return dense
}

// ─── Spring simulation ───────────────────────────────────────────────────────

function stepSpring(s: SpringState, dtMs: number): SpringState {
  if (dtMs <= 0) return s
  const t = dtMs / 1000
  const mass = Math.max(s.mass, 0.001)
  const omega0 = Math.sqrt(s.tension / mass)
  const zeta = s.friction / (2 * Math.sqrt(s.tension * mass))

  const [ndU, nvU] = solveSpring1d(s.posU - s.targetU, s.velU, t, omega0, zeta)
  const [ndV, nvV] = solveSpring1d(s.posV - s.targetV, s.velV, t, omega0, zeta)

  const newPosU = s.targetU + ndU
  const newPosV = s.targetV + ndV

  const dispMag = Math.sqrt(ndU * ndU + ndV * ndV)
  const velMag = Math.sqrt(nvU * nvU + nvV * nvV)

  if (dispMag < 1e-5 && velMag < 1e-4) {
    return { ...s, posU: s.targetU, posV: s.targetV, velU: 0, velV: 0 }
  }

  return { ...s, posU: newPosU, posV: newPosV, velU: nvU, velV: nvV }
}

function buildSmoothedSamples(moves: MoveEvent[], clicks: ClickEvt[]): SmoothedSample[] {
  if (moves.length === 0) return []

  let state: SpringState = {
    posU: moves[0].u, posV: moves[0].v,
    velU: 0, velV: 0,
    targetU: moves[0].u, targetV: moves[0].v,
    tension: SPRING_DEFAULT.tension, mass: SPRING_DEFAULT.mass, friction: SPRING_DEFAULT.friction,
  }

  const samples: SmoothedSample[] = []
  let lastTimeMs = 0
  let nextClickIdx = 0
  let lastClickTime: number | null = null
  let primaryDown = false

  function advanceClicks(timeMs: number) {
    while (nextClickIdx < clicks.length && clicks[nextClickIdx].timeMs <= timeMs) {
      lastClickTime = clicks[nextClickIdx].timeMs
      primaryDown = clicks[nextClickIdx].isDown
      nextClickIdx++
    }
  }

  function getProfile(timeMs: number): SpringConfig {
    if (lastClickTime !== null && Math.abs(timeMs - lastClickTime) <= CLICK_REACTION_WINDOW_MS) {
      return SPRING_SNAPPY
    }
    if (primaryDown) return SPRING_DRAG
    return SPRING_DEFAULT
  }

  if (moves[0].timeMs > 0) {
    samples.push({
      timeMs: 0,
      u: state.posU, v: state.posV,
      velU: 0, velV: 0,
      targetU: state.posU, targetV: state.posV,
    })
  }

  for (const m of moves) {
    state = { ...state, targetU: m.u, targetV: m.v }

    advanceClicks(m.timeMs)
    const profile = getProfile(m.timeMs)
    state = { ...state, tension: profile.tension, mass: profile.mass, friction: profile.friction }

    state = stepSpring(state, m.timeMs - lastTimeMs)
    lastTimeMs = m.timeMs

    samples.push({
      timeMs: m.timeMs,
      u: Math.max(0, Math.min(1, state.posU)),
      v: Math.max(0, Math.min(1, state.posV)),
      velU: state.velU, velV: state.velV,
      targetU: m.u, targetV: m.v,
    })
  }

  return samples
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a precomputed spring-smoothed cursor trajectory from raw events.
 *
 * The returned `SmoothedCursor` can be sampled at any source time in O(log n).
 *
 * @param rawEvents - Raw cursor events from a screen recording
 * @param transform - Coordinate transform from screen space to video UV space
 */
export function buildSmoothedCursor(
  rawEvents: CursorEvent[],
  transform: CursorTransform,
): SmoothedCursor {
  const moves: MoveEvent[] = []
  const clicks: ClickEvt[] = []

  for (const ev of rawEvents) {
    const timeMs = ev.t / 1_000_000
    const { u, v } = screenToVideoUV(ev.x, ev.y, transform)
    moves.push({ timeMs, u, v })
    if (ev.type === 'click') clicks.push({ timeMs, isDown: true })
    else if (ev.type === 'release') clicks.push({ timeMs, isDown: false })
  }

  const filtered = filterCursorShake(moves)
  const dense = densifyCursorMoves(filtered)
  const samples = buildSmoothedSamples(dense, clicks)

  return {
    interpolateAt(sourceTimeSecs: number): { u: number; v: number } {
      if (samples.length === 0) return { u: 0.5, v: 0.5 }

      const queryMs = sourceTimeSecs * 1000
      let sample: SmoothedSample | null = null
      let dt = 0
      for (let i = 0; i < samples.length - 1; i++) {
        if (samples[i].timeMs <= queryMs && queryMs < samples[i + 1].timeMs) {
          sample = samples[i]
          dt = queryMs - samples[i].timeMs
          break
        }
      }
      if (!sample) {
        sample = samples[samples.length - 1]
        dt = Math.max(0, queryMs - sample.timeMs)
      }

      let springState: SpringState = {
        posU: sample.u, posV: sample.v,
        velU: sample.velU, velV: sample.velV,
        targetU: sample.targetU, targetV: sample.targetV,
        tension: SPRING_DEFAULT.tension, mass: SPRING_DEFAULT.mass, friction: SPRING_DEFAULT.friction,
      }
      springState = stepSpring(springState, dt)

      return {
        u: Math.max(0, Math.min(1, springState.posU)),
        v: Math.max(0, Math.min(1, springState.posV)),
      }
    },

    isClickingAt(sourceTimeSecs: number): boolean {
      if (clicks.length === 0) return false
      const targetMs = sourceTimeSecs * 1000
      const idx = clicks.findIndex((c) => c.timeMs > targetMs)
      const searchEnd = idx === -1 ? clicks.length : idx
      for (let i = searchEnd - 1; i >= 0; i--) {
        return clicks[i].isDown
      }
      return false
    },
  }
}
