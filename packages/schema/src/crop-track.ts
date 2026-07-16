import { createZoomState, evaluateZoom } from "./vendor/screen-studio-effects/index.js";
import type { ZoomSegment, CropBounds } from "./vendor/screen-studio-effects/index.js";
import type { CameraSegment } from "./plan.js";

export type CropFrame = CropBounds;

const CENTER = { u: 0.5, v: 0.5 } as const;

export function segmentsToCropTrack(
  segments: CameraSegment[],
  durationFrames: number,
  fps: number,
): CropFrame[] {
  const zoomSegments: ZoomSegment[] = segments.map((s) => ({
    sourceStart: s.sourceStart,
    sourceEnd: s.sourceEnd,
    amount: s.amount,
    manualCenter: s.manualCenter,
  }));
  const state = createZoomState();
  const track: CropFrame[] = [];
  // ONE sequential forward pass — evaluateZoom is stateful; never call it out of order.
  for (let f = 0; f < durationFrames; f++) {
    const t = f / fps;
    const crop = evaluateZoom(zoomSegments, t, CENTER, state, () => CENTER);
    track.push({ x: crop.x, y: crop.y, w: crop.w, h: crop.h });
  }
  return track;
}
