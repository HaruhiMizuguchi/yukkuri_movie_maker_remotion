import React from "react";
import { Composition } from "remotion";
import { SimpleComposition } from "./simple/SimpleComposition";
import { YmmComposition, type YmmCompositionProps } from "./yukkuri/YmmComposition";

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
      <Composition<YmmCompositionProps>
        id="YmmComposition"
        component={YmmComposition}
        durationInFrames={30 * 10}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "ゆっくり解説",
          theme: "今日のテーマ",
          subtitleTracks: [
            { startMs: 0, endMs: 4000, text: "最小構成のコンポジションです。", speaker: "reimu" },
            { startMs: 4000, endMs: 9000, text: "字幕と立ち絵を重ねます。", speaker: "marisa" },
          ],
        }}
      />
    </>
  );
};

