import { z } from "zod";

const uv = z.number().min(0).max(1);

export const cameraSegmentSchema = z.object({
  sourceStart: z.number().nonnegative(),
  sourceEnd: z.number().nonnegative(),
  amount: z.number().min(1).max(4),
  manualCenter: z.tuple([uv, uv]).optional(),
}).refine((s) => s.sourceEnd > s.sourceStart, { message: "sourceEnd must exceed sourceStart" });

export const captionSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string().min(1),
});

export const editPlanSchema = z.object({
  plan_version: z.literal("1.2"),
  job_id: z.string().min(1),
  source_kind: z.literal("recording"),
  fps: z.number().int().positive(),
  base: z.object({
    uri: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationSec: z.number().positive(),
  }),
  camera: z.object({ segments: z.array(cameraSegmentSchema) }),
  captions: z.array(captionSchema),
});

export type CameraSegment = z.infer<typeof cameraSegmentSchema>;
export type Caption = z.infer<typeof captionSchema>;
export type EditPlan = z.infer<typeof editPlanSchema>;
