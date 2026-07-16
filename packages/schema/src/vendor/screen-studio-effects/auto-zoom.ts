/**
 * Auto-zoom segment generation from cursor motion analysis.
 *
 * Analyzes a stream of cursor events to find "silence zones" (periods of
 * near-zero cursor movement) and generates zoom segments for the active
 * (non-silent) regions. This creates a Screen Studio-style effect where
 * the camera zooms in when the user is actively interacting and zooms
 * out during pauses.
 *
 * Algorithm:
 *   1. Walk cursor events, detecting zones where displacement < 2px
 *   2. Discard zones shorter than `minSilenceSecs` (default 0.5s)
 *   3. The gaps between silence zones become "active" regions
 *   4. Each active region becomes a zoom segment at the specified magnification
 */

import type { CursorEvent, ZoomSegment } from './types.js'

interface SilenceZone {
  start: number // seconds
  end: number   // seconds
}

/**
 * Detect zones where the cursor is essentially stationary.
 *
 * A zone starts when displacement between consecutive events drops below 2px
 * and extends until a displacement >= 2px is seen. Zones shorter than
 * `minSilenceSecs` are discarded.
 *
 * @param events - Raw cursor events (timestamps in nanoseconds)
 * @param minSilenceSecs - Minimum silence duration to count (default 0.5s)
 */
export function detectSilenceZones(
  events: CursorEvent[],
  minSilenceSecs = 0.5,
): SilenceZone[] {
  if (events.length < 2) return []

  const zones: SilenceZone[] = []
  let silenceStart: number | null = null

  for (let i = 1; i < events.length; i++) {
    const dx = events[i].x - events[i - 1].x
    const dy = events[i].y - events[i - 1].y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const tSec = events[i].t / 1e9 // nanoseconds → seconds

    if (dist < 2) {
      if (silenceStart === null) {
        silenceStart = events[i - 1].t / 1e9
      }
    } else {
      if (silenceStart !== null) {
        const duration = tSec - silenceStart
        if (duration >= minSilenceSecs) {
          zones.push({ start: silenceStart, end: tSec })
        }
        silenceStart = null
      }
    }
  }

  // Close trailing zone
  if (silenceStart !== null) {
    const lastT = events[events.length - 1].t / 1e9
    const duration = lastT - silenceStart
    if (duration >= minSilenceSecs) {
      zones.push({ start: silenceStart, end: lastT })
    }
  }

  return zones
}

/**
 * Generate zoom segments from silence zone analysis.
 *
 * From silence zones, derives the "active" (non-silent) regions and turns
 * each into a zoom segment at the specified magnification.
 *
 * @param silenceZones - Output from `detectSilenceZones()`
 * @param totalDuration - Total recording duration in seconds
 * @param zoomAmount - Magnification for active regions (default 1.5x)
 */
export function generateAutoZoomSegments(
  silenceZones: SilenceZone[],
  totalDuration: number,
  zoomAmount = 1.5,
): ZoomSegment[] {
  const active: { start: number; end: number }[] = []
  let cursor = 0

  for (const z of silenceZones) {
    if (z.start > cursor) {
      active.push({ start: cursor, end: z.start })
    }
    cursor = z.end
  }
  if (cursor < totalDuration) {
    active.push({ start: cursor, end: totalDuration })
  }

  return active
    .filter((r) => r.end - r.start >= 0.2)
    .map((r) => ({
      sourceStart: r.start,
      sourceEnd: r.end,
      amount: zoomAmount,
    }))
}
