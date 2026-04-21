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

export type CharacterPerformancePlan = {
  mouthCues: Array<{
    startMs: number;
    endMs: number;
    openness: number;
    speaker: string;
  }>;
  blinkCues: Array<{
    startMs: number;
    endMs: number;
  }>;
  expressionCues: Array<{
    startMs: number;
    endMs: number;
    expression: "normal" | "happy" | "serious" | "surprised";
    speaker: string;
  }>;
};

export type YmmCompositionProps = Record<string, unknown> & {
  title: string;
  theme: string;
  subtitleTracks: SubtitleTrack[];
  shotPlan?: ShotPlanItem[];
  characterPerformance?: CharacterPerformancePlan;
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
  characterPerformance = {
    mouthCues: [],
    blinkCues: [],
    expressionCues: [],
  },
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
  const currentMouthCue = useMemo(
    () =>
      characterPerformance.mouthCues.find(
        (cue) => currentMs >= cue.startMs && currentMs < cue.endMs
      ) ?? null,
    [characterPerformance.mouthCues, currentMs]
  );
  const currentBlinkCue = useMemo(
    () =>
      characterPerformance.blinkCues.find(
        (cue) => currentMs >= cue.startMs && currentMs < cue.endMs
      ) ?? null,
    [characterPerformance.blinkCues, currentMs]
  );
  const currentExpressionCue = useMemo(
    () =>
      characterPerformance.expressionCues.find(
        (cue) => currentMs >= cue.startMs && currentMs < cue.endMs
      ) ?? null,
    [characterPerformance.expressionCues, currentMs]
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
  const speakingBounce = currentMouthCue ? -8 : 0;
  const mouthScale = currentMouthCue ? 0.5 + currentMouthCue.openness : 0;
  const expressionStyle = getExpressionStyle(currentExpressionCue?.expression ?? "normal");

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
        <div
          style={{
            position: "absolute",
            right: 60,
            bottom: 0,
            width: 540,
            height: 860,
            transform: `translate(${characterTranslateX}px, ${speakingBounce}px) scale(${characterScale})`,
          }}
        >
          <Img
            src={characterImagePath}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: expressionStyle.filter,
              opacity: currentBlinkCue ? 0.95 : 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 24,
              borderRadius: 24,
              boxShadow: expressionStyle.glow,
              opacity: 0.85,
            }}
          />
          {currentMouthCue ? (
            <div
              style={{
                position: "absolute",
                left: "47%",
                top: "50%",
                width: 54,
                height: 20,
                marginLeft: -27,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.78)",
                boxShadow: "0 0 18px rgba(255,255,255,0.32)",
                transform: `scaleY(${mouthScale})`,
                transformOrigin: "center center",
              }}
            />
          ) : null}
          {currentBlinkCue ? (
            <>
              <div
                style={{
                  position: "absolute",
                  left: "33%",
                  top: "24%",
                  width: 62,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "rgba(15,23,42,0.82)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "57%",
                  top: "24%",
                  width: 62,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "rgba(15,23,42,0.82)",
                }}
              />
            </>
          ) : null}
        </div>
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

const getExpressionStyle = (expression: "normal" | "happy" | "serious" | "surprised") => {
  if (expression === "happy") {
    return {
      filter: "saturate(1.08) brightness(1.02)",
      glow: "0 0 36px rgba(250, 204, 21, 0.35)",
    };
  }
  if (expression === "serious") {
    return {
      filter: "saturate(0.92) contrast(1.05)",
      glow: "0 0 30px rgba(59, 130, 246, 0.3)",
    };
  }
  if (expression === "surprised") {
    return {
      filter: "saturate(1.15) brightness(1.05)",
      glow: "0 0 38px rgba(248, 113, 113, 0.36)",
    };
  }
  return {
    filter: "none",
    glow: "0 0 18px rgba(255,255,255,0.14)",
  };
};
