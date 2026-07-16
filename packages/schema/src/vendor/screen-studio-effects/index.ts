/**
 * screen-studio-effects — open-source auto-zoom & physics-based frame settling
 *
 * Algorithms for Screen Studio-style animated camera movement in screen recordings.
 * Uses spring-mass-damper physics for smooth, natural transitions.
 *
 * ## Quick start
 *
 * ```ts
 * import {
 *   buildSmoothedCursor,
 *   detectSilenceZones,
 *   generateAutoZoomSegments,
 *   createZoomState,
 *   evaluateZoom,
 * } from 'screen-studio-effects'
 *
 * // 1. Smooth raw cursor events
 * const cursor = buildSmoothedCursor(rawEvents, transform)
 *
 * // 2. Auto-detect zoom regions from cursor activity
 * const silences = detectSilenceZones(rawEvents)
 * const segments = generateAutoZoomSegments(silences, totalDuration)
 *
 * // 3. Per-frame: evaluate the crop bounds
 * const state = createZoomState()
 * for (const frame of frames) {
 *   const pos = cursor.interpolateAt(frame.time)
 *   const crop = evaluateZoom(segments, frame.time, pos, state,
 *     (t) => cursor.interpolateAt(t))
 *   // Apply crop to your frame...
 * }
 * ```
 */

// Types
export type {
  ZoomSegment,
  CropBounds,
  SpringConfig,
  CursorEvent,
  CursorTransform,
  SmoothedCursor,
} from './types.js'

// Spring physics
export { solveSpring1d, stepSpring2D } from './spring.js'
export type { SpringState2D } from './spring.js'

// Cursor smoothing
export {
  buildSmoothedCursor,
  screenToVideoUV,
  SPRING_DEFAULT,
  SPRING_SNAPPY,
  SPRING_DRAG,
} from './cursor.js'

// Auto-zoom detection
export { detectSilenceZones, generateAutoZoomSegments } from './auto-zoom.js'

// Zoom evaluation
export {
  evaluateZoom,
  createZoomState,
  VP_PRESETS,
} from './zoom.js'
export type { ZoomState } from './zoom.js'
