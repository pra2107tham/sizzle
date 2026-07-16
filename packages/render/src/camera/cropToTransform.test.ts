import { describe, it, expect } from "vitest";
import { cropToTransform } from "./cropToTransform";

describe("cropToTransform", () => {
  it("full frame => scale 1, no translate", () => {
    const t = cropToTransform({ x: 0, y: 0, w: 1, h: 1 });
    expect(t.scale).toBeCloseTo(1, 3);
    expect(t.translatePctX).toBeCloseTo(0, 3);
    expect(t.translatePctY).toBeCloseTo(0, 3);
  });

  it("centered half-frame crop => scale 2", () => {
    const t = cropToTransform({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(t.scale).toBeCloseTo(2, 3);
    // crop center is (0.5,0.5) => already centered => no translate
    expect(t.translatePctX).toBeCloseTo(0, 3);
    expect(t.translatePctY).toBeCloseTo(0, 3);
  });

  it("off-center crop translates toward the crop center", () => {
    const t = cropToTransform({ x: 0, y: 0, w: 0.5, h: 0.5 });
    // crop center (0.25,0.25) is up-left => content shifts down-right (positive translate)
    expect(t.translatePctX).toBeGreaterThan(0);
    expect(t.translatePctY).toBeGreaterThan(0);
  });
});
