import React from "react";
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { editPlanSchema, segmentsToCropTrack, type EditPlan } from "@sizzle/schema";
import { RecordingComposition, type RecordingProps } from "./RecordingComposition";
import demoPlan from "../../../samples/demo01/editplan.json";

const defaultPlan: EditPlan = editPlanSchema.parse(demoPlan);

const calculateMetadata: CalculateMetadataFunction<RecordingProps> = ({ props }) => {
  const plan = props.plan;
  const durationInFrames = Math.round(plan.base.durationSec * plan.fps);
  const cropTrack = segmentsToCropTrack(plan.camera.segments, durationInFrames, plan.fps);
  return {
    durationInFrames,
    fps: plan.fps,
    width: plan.base.width,
    height: plan.base.height,
    props: { ...props, cropTrack },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Recording"
      component={RecordingComposition}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ plan: defaultPlan, cropTrack: [] as RecordingProps["cropTrack"] }}
      calculateMetadata={calculateMetadata}
    />
  );
};
