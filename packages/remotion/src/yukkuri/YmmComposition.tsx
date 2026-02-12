import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Img, useCurrentFrame, useVideoConfig } from "remotion";

export type SubtitleTrack = {
  startMs: number;
  endMs: number;
  text: string;
  speaker: string;
};

export type YmmCompositionProps = {
  title: string;
  theme: string;
  subtitleTracks: SubtitleTrack[];
  audioPath?: string;
  backgroundImagePath?: string;
  characterImagePath?: string;
};

export const YmmComposition: React.FC<YmmCompositionProps> = ({
  title,
  theme,
  subtitleTracks,
  audioPath,
  backgroundImagePath,
  characterImagePath,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const currentSubtitle = useMemo(
    () =>
      subtitleTracks.find(
        (track) => currentMs >= track.startMs && currentMs < track.endMs
      ) ?? null,
    [currentMs, subtitleTracks]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a", color: "#fff" }}>
      {backgroundImagePath ? (
        <Img
          src={backgroundImagePath}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(160deg, #0f172a 0%, #1d4ed8 40%, #22d3ee 100%)",
          }}
        />
      )}
      {characterImagePath ? (
        <Img
          src={characterImagePath}
          style={{
            position: "absolute",
            right: 60,
            bottom: 0,
            width: 540,
            height: 860,
            objectFit: "contain",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 60,
          right: 60,
          fontSize: 56,
          fontWeight: 800,
          textShadow: "0 6px 24px rgba(0,0,0,0.45)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          top: 126,
          left: 64,
          fontSize: 28,
          opacity: 0.9,
        }}
      >
        {theme}
      </div>
      <div
        style={{
          position: "absolute",
          left: 50,
          right: 50,
          bottom: 50,
          padding: "20px 26px",
          borderRadius: 16,
          backgroundColor: "rgba(0,0,0,0.68)",
          fontSize: 44,
          fontWeight: 700,
          lineHeight: 1.45,
          minHeight: 120,
        }}
      >
        {currentSubtitle ? `${currentSubtitle.speaker}: ${currentSubtitle.text}` : ""}
      </div>
      {audioPath ? <Audio src={audioPath} /> : null}
    </AbsoluteFill>
  );
};
