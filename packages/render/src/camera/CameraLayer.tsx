import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { CropFrame } from "@sizzle/schema";
import { cropToTransform } from "./cropToTransform.js";

export const CameraLayer: React.FC<{
  cropTrack: CropFrame[];
  children: React.ReactNode;
}> = ({ cropTrack, children }) => {
  const frame = useCurrentFrame();
  const crop = cropTrack[Math.min(frame, cropTrack.length - 1)] ?? { x: 0, y: 0, w: 1, h: 1 };
  const { scale, translatePctX, translatePctY } = cropToTransform(crop);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "center center",
          scale: String(scale),
          translate: `${translatePctX}% ${translatePctY}%`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
