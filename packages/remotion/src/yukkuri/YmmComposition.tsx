import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Img, useCurrentFrame, useVideoConfig } from "remotion";

export type SubtitleTrack = {
  startMs: number;
  endMs: number;
  text: string;
  speaker: string;
};

export type ShotPlanItem = {
  id: string;
  type: "wide" | "medium" | "close" | "insert";
  startMs: number;
  endMs: number;
  lineIndexes: number[];
  focusSpeaker: string;
  zoomStart: number;
  zoomEnd: number;
  panX: number;
  panY: number;
};

export type YmmCompositionProps = Record<string, unknown> & {
  title: string;
  theme: string;
  subtitleTracks: SubtitleTrack[];
  shotPlan?: ShotPlanItem[];
  durationMs?: number;
  audioPath?: string;
  backgroundImagePath?: string;
  characterImagePath?: string;
};

export const YmmComposition: React.FC<YmmCompositionProps> = ({
  title,
  theme,
  subtitleTracks,
  shotPlan = [],
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
  const currentShot = useMemo(
    () => shotPlan.find((shot) => currentMs >= shot.startMs && currentMs < shot.endMs) ?? null,
    [currentMs, shotPlan]
  );
  const shotProgress = currentShot
    ? Math.min(1, Math.max(0, (currentMs - currentShot.startMs) / Math.max(1, currentShot.endMs - currentShot.startMs)))
    : 0;
  const backgroundScale = currentShot
    ? currentShot.zoomStart + (currentShot.zoomEnd - currentShot.zoomStart) * shotProgress
    : 1;
  const backgroundTranslateX = currentShot ? currentShot.panX * 240 : 0;
  const backgroundTranslateY = currentShot ? currentShot.panY * 200 : 0;
  const characterScale =
    currentShot?.type === "close" ? 1.08 : currentShot?.type === "wide" ? 0.96 : 1.02;
  const characterTranslateX = currentShot ? currentShot.panX * 120 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a", color: "#fff" }}>
      {backgroundImagePath ? (
        <Img
          src={backgroundImagePath}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `translate(${backgroundTranslateX}px, ${backgroundTranslateY}px) scale(${backgroundScale})`,
          }}
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
            transform: `translateX(${characterTranslateX}px) scale(${characterScale})`,
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
