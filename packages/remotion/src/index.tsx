import React from "react";
import { Composition } from "remotion";
import { SimpleComposition } from "./simple/SimpleComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Simple"
        component={SimpleComposition}
        durationInFrames={30 * 10}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ title: "Hello Remotion" }}
      />
    </>
  );
};

