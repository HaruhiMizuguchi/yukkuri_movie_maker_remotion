import React from "react";
import { AbsoluteFill } from "remotion";

export type SimpleCompositionProps = Record<string, unknown> & {
  title: string;
};

export const SimpleComposition: React.FC<SimpleCompositionProps> = ({ title }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b1020", color: "white", justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 72, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 16, opacity: 0.8 }}>Remotion 雛形</div>
    </AbsoluteFill>
  );
};

