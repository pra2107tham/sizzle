import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import type { EditPlan, CropFrame } from "@sizzle/schema";
import { CameraLayer } from "./camera/CameraLayer";
import { CaptionLayer } from "./captions/CaptionLayer";

export type RecordingProps = {
  plan: EditPlan;
  cropTrack: CropFrame[];
};

export const RecordingComposition: React.FC<RecordingProps> = ({ plan, cropTrack }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <CameraLayer cropTrack={cropTrack}>
        <OffthreadVideo src={staticFile(plan.base.uri)} />
      </CameraLayer>
      <CaptionLayer captions={plan.captions} fps={plan.fps} />
    </AbsoluteFill>
  );
};
