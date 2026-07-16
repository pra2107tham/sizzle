import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Caption } from "@sizzle/schema";

export const CaptionLayer: React.FC<{ captions: Caption[]; fps: number }> = ({ captions, fps }) => {
  const frame = useCurrentFrame();
  const t = frame / fps;
  const active = captions.find((c) => t >= c.start && t <= c.end);
  if (!active) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 80 }}>
      <div
        style={{
          background: "rgba(0,0,0,0.7)",
          color: "white",
          fontSize: 42,
          fontFamily: "sans-serif",
          padding: "12px 28px",
          borderRadius: 12,
          maxWidth: "80%",
          textAlign: "center",
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};
