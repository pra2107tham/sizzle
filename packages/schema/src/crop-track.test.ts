import { describe, it, expect } from "vitest";
import { segmentsToCropTrack } from "./crop-track.js";
import type { CameraSegment } from "./plan.js";

describe("segmentsToCropTrack", () => {
  const fps = 30;
  const segments: CameraSegment[] = [
    { sourceStart: 1.0, sourceEnd: 2.0, amount: 2.0, manualCenter: [0.5, 0.5] },
  ];

  it("produces one crop per frame", () => {
    const track = segmentsToCropTrack(segments, 90, fps); // 3s
    expect(track).toHaveLength(90);
  });

  it("is full-frame before any segment", () => {
    const track = segmentsToCropTrack(segments, 90, fps);
    expect(track[0].w).toBeCloseTo(1, 2);
    expect(track[0].h).toBeCloseTo(1, 2);
  });

  it("is zoomed in (w < 1) during the segment hold", () => {
    const track = segmentsToCropTrack(segments, 90, fps);
    const mid = track[45]; // 1.5s, inside 1..2
    expect(mid.w).toBeLessThan(0.9);
  });
});
