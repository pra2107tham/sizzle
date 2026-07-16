import { describe, it, expect } from "vitest";
import { editPlanSchema } from "./plan.js";

const valid = {
  plan_version: "1.2",
  job_id: "demo01",
  source_kind: "recording",
  fps: 30,
  base: { uri: "raw.mp4", width: 1920, height: 1080, durationSec: 40 },
  camera: { segments: [{ sourceStart: 6.5, sourceEnd: 8.4, amount: 1.5, manualCenter: [0.42, 0.31] }] },
  captions: [{ start: 0.4, end: 2.1, text: "Creating an invoice takes one click" }],
};

describe("editPlanSchema", () => {
  it("accepts a valid recording plan", () => {
    expect(editPlanSchema.parse(valid)).toMatchObject({ job_id: "demo01" });
  });

  it("rejects amount below 1", () => {
    const bad = { ...valid, camera: { segments: [{ sourceStart: 1, sourceEnd: 2, amount: 0.5 }] } };
    expect(() => editPlanSchema.parse(bad)).toThrow();
  });

  it("rejects manualCenter outside 0..1", () => {
    const bad = { ...valid, camera: { segments: [{ sourceStart: 1, sourceEnd: 2, amount: 1.5, manualCenter: [1.4, 0.2] }] } };
    expect(() => editPlanSchema.parse(bad)).toThrow();
  });
});
