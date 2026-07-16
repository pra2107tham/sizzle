// ─── Core types ──────────────────────────────────────────────────────────────

/** A zoom effect region: "zoom in from sourceStart to sourceEnd at this magnification." */
export interface ZoomSegment {
  /** Source time (seconds) where the zoom begins. */
  sourceStart: number
  /** Source time (seconds) where the zoom ends. */
  sourceEnd: number
  /** Magnification factor (e.g. 1.5, 2, 3, 4). */
  amount: number
  /**
   * Manual center in UV space [0-1, 0-1].
   * If undefined, the viewport follows the cursor automatically (auto-mode).
   */
  manualCenter?: [number, number]
  /** If true, use instant cut instead of spring animation. */
  instantAnimation?: boolean
}

/** Crop bounds in normalized UV space. Full frame = { x:0, y:0, w:1, h:1 }. */
export interface CropBounds {
  x: number
  y: number
  w: number
  h: number
}

/** Spring configuration: tension (stiffness), mass, and friction (damping). */
export interface SpringConfig {
  tension: number
  mass: number
  friction: number
}

/** A raw cursor event from a screen recording. */
export interface CursorEvent {
  /** Timestamp in nanoseconds from recording start. */
  t: number
  /** Global screen X coordinate (macOS points or pixels). */
  x: number
  /** Global screen Y coordinate (macOS points or pixels). */
  y: number
  /** Event type: "move", "click", or "release". */
  type: string
}

/** Parameters for converting screen coordinates to video-frame UV space. */
export interface CursorTransform {
  /** Window origin X in screen coordinates. */
  windowX: number
  /** Window origin Y in screen coordinates. */
  windowY: number
  /** Capture width in pixels (e.g. 2x screen points on macOS Retina). */
  captureWidth: number
  /** Capture height in pixels. */
  captureHeight: number
}

/** Precomputed spring-smoothed cursor with O(log n) per-frame lookup. */
export interface SmoothedCursor {
  /** Interpolate spring-smoothed UV position at the given source time (seconds). */
  interpolateAt(sourceTimeSecs: number): { u: number; v: number }
  /** Whether the primary button is pressed at the given source time. */
  isClickingAt(sourceTimeSecs: number): boolean
}
