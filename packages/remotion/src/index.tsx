import React from "react";
import { Composition, registerRoot } from "remotion";
import { SimpleComposition } from "./simple/SimpleComposition";
import { YmmComposition, type YmmCompositionProps } from "./yukkuri/YmmComposition";

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

const readOutputPreset = (props: YmmCompositionProps) => ({
  fps: Math.max(1, Math.floor(Number(props.outputPreset?.fps ?? DEFAULT_FPS))),
  width: Math.max(320, Math.floor(Number(props.outputPreset?.width ?? DEFAULT_WIDTH))),
  height: Math.max(180, Math.floor(Number(props.outputPreset?.height ?? DEFAULT_HEIGHT))),
});

const calculateYmmMetadata = ({ props }: { props: YmmCompositionProps }) => {
  const outputPreset = readOutputPreset(props);
  const subtitleDurationMs = props.subtitleTracks.reduce(
    (max, track) => Math.max(max, track.endMs),
    0
  );
  const effectiveDurationMs = Math.max(
    1000,
    props.durationMs ?? subtitleDurationMs,
    subtitleDurationMs
  );
  return {
    durationInFrames: Math.max(
      outputPreset.fps,
      Math.ceil((effectiveDurationMs / 1000) * outputPreset.fps)
    ),
    fps: outputPreset.fps,
    width: outputPreset.width,
    height: outputPreset.height,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Simple"
        component={SimpleComposition}
        durationInFrames={DEFAULT_FPS * 10}
        fps={DEFAULT_FPS}
        width={DEFAULT_WIDTH}
        height={DEFAULT_HEIGHT}
        defaultProps={{ title: "Hello Remotion" }}
      />
      <Composition<any, YmmCompositionProps>
        id="YmmComposition"
        component={YmmComposition}
        calculateMetadata={calculateYmmMetadata}
        defaultProps={{
          title: "ゆっくり解説",
          theme: "今日のテーマ",
          durationMs: 9000,
          subtitleTracks: [
            { startMs: 0, endMs: 4000, text: "最小構成のコンポジションです。", speaker: "reimu" },
            { startMs: 4000, endMs: 9000, text: "字幕と立ち絵を重ねます。", speaker: "marisa" },
          ],
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);

