import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type SubtitleTrack = {
  startMs: number;
  endMs: number;
  text: string;
  speaker: string;
};

export type ManualAudioTrack = {
  clipId: string;
  assetPath: string;
  startMs: number;
  endMs: number;
  trimBeforeMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
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

export type SubtitlePresentationPlan = {
  items: Array<{
    speaker: string;
    text: string;
    startMs: number;
    endMs: number;
    keywordBadge: string | null;
    tokens: Array<{
      text: string;
      kind: "plain" | "emphasis" | "secondary";
    }>;
  }>;
  emphasisCount: number;
};

export type AudioMixPlan = {
  bgmWindows: Array<{ startMs: number; endMs: number; volume: number }>;
  ambientWindows: Array<{ startMs: number; endMs: number; volume: number }>;
  seCues: Array<{
    id: string;
    kind: "accent" | "transition";
    assetKey: "accent" | "transition";
    startMs: number;
    durationMs: number;
    volume: number;
  }>;
  assets: {
    bgmPath: string;
    ambientPath: string;
    accentPath: string;
    transitionPath: string;
  };
};

export type ChapterPlan = {
  chapters: Array<{
    id: string;
    title: string;
    startMs: number;
    endMs: number;
    lineIndexes: number[];
    transitionDurationMs: number;
  }>;
};

export type VisualPlan = {
  assets: Array<{
    id: string;
    sourceType: "image" | "video";
    path: string;
    durationMs: number | null;
    accentColor?: string;
  }>;
  tracks: Array<{
    id: string;
    shotId: string;
    assetId: string;
    sourceType: "image" | "video";
    startMs: number;
    endMs: number;
    sourceStartMs: number;
    zoomStart: number;
    zoomEnd: number;
    panX: number;
    panY: number;
    accentColor?: string;
  }>;
};

export type YmmCompositionProps = Record<string, unknown> & {
  title: string;
  theme: string;
  subtitleTracks: SubtitleTrack[];
  outputPreset?: {
    width: number;
    height: number;
    fps: number;
  };
  audioTracks?: ManualAudioTrack[];
  shotPlan?: ShotPlanItem[];
  characterPerformance?: CharacterPerformancePlan;
  subtitlePresentation?: SubtitlePresentationPlan;
  audioMixPlan?: AudioMixPlan;
  chapterPlan?: ChapterPlan;
  visualPlan?: VisualPlan;
  durationMs?: number;
  audioPath?: string;
  backgroundImagePath?: string;
  characterImagePath?: string;
  illustrationImagePath?: string;
};

export const YmmComposition: React.FC<YmmCompositionProps> = ({
  title,
  theme,
  subtitleTracks,
  audioTracks = [],
  shotPlan = [],
  characterPerformance = {
    mouthCues: [],
    blinkCues: [],
    expressionCues: [],
  },
  subtitlePresentation = {
    items: [],
    emphasisCount: 0,
  },
  audioMixPlan = {
    bgmWindows: [],
    ambientWindows: [],
    seCues: [],
    assets: {
      bgmPath: "",
      ambientPath: "",
      accentPath: "",
      transitionPath: "",
    },
  },
  chapterPlan = {
    chapters: [],
  },
  visualPlan = {
    assets: [],
    tracks: [],
  },
  audioPath,
  backgroundImagePath,
  characterImagePath,
  illustrationImagePath,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const currentSubtitle = useMemo(
    () =>
      subtitleTracks.find(
        (track) => currentMs >= track.startMs && currentMs < track.endMs,
      ) ?? null,
    [currentMs, subtitleTracks],
  );
  const currentShot = useMemo(
    () =>
      shotPlan.find(
        (shot) => currentMs >= shot.startMs && currentMs < shot.endMs,
      ) ?? null,
    [currentMs, shotPlan],
  );
  const currentMouthCue = useMemo(
    () =>
      characterPerformance.mouthCues.find(
        (cue) => currentMs >= cue.startMs && currentMs < cue.endMs,
      ) ?? null,
    [characterPerformance.mouthCues, currentMs],
  );
  const currentBlinkCue = useMemo(
    () =>
      characterPerformance.blinkCues.find(
        (cue) => currentMs >= cue.startMs && currentMs < cue.endMs,
      ) ?? null,
    [characterPerformance.blinkCues, currentMs],
  );
  const currentExpressionCue = useMemo(
    () =>
      characterPerformance.expressionCues.find(
        (cue) => currentMs >= cue.startMs && currentMs < cue.endMs,
      ) ?? null,
    [characterPerformance.expressionCues, currentMs],
  );
  const currentSubtitlePresentation = useMemo(
    () =>
      subtitlePresentation.items.find(
        (item) => currentMs >= item.startMs && currentMs < item.endMs,
      ) ?? null,
    [currentMs, subtitlePresentation.items],
  );
  const currentChapter = useMemo(
    () =>
      chapterPlan.chapters.find(
        (chapter) => currentMs >= chapter.startMs && currentMs < chapter.endMs,
      ) ?? null,
    [chapterPlan.chapters, currentMs],
  );
  const currentTransition = useMemo(
    () =>
      chapterPlan.chapters.find(
        (chapter) =>
          currentMs >= chapter.startMs &&
          currentMs < chapter.startMs + chapter.transitionDurationMs,
      ) ?? null,
    [chapterPlan.chapters, currentMs],
  );
  const shotProgress = currentShot
    ? Math.min(
        1,
        Math.max(
          0,
          (currentMs - currentShot.startMs) /
            Math.max(1, currentShot.endMs - currentShot.startMs),
        ),
      )
    : 0;
  const visualAssetMap = useMemo(
    () => new Map(visualPlan.assets.map((asset) => [asset.id, asset])),
    [visualPlan.assets],
  );
  const backgroundScale = currentShot
    ? currentShot.zoomStart +
      (currentShot.zoomEnd - currentShot.zoomStart) * shotProgress
    : 1;
  const backgroundTranslateX = currentShot ? currentShot.panX * 240 : 0;
  const backgroundTranslateY = currentShot ? currentShot.panY * 200 : 0;
  const characterScale =
    currentShot?.type === "close"
      ? 1.08
      : currentShot?.type === "wide"
        ? 0.96
        : 1.02;
  const characterTranslateX = currentShot ? currentShot.panX * 120 : 0;
  const speakingBounce = currentMouthCue ? -8 : 0;
  const mouthScale = currentMouthCue ? 0.5 + currentMouthCue.openness : 0;
  const expressionStyle = getExpressionStyle(
    currentExpressionCue?.expression ?? "normal",
  );
  const transitionProgress = currentTransition
    ? Math.min(
        1,
        Math.max(
          0,
          (currentMs - currentTransition.startMs) /
            Math.max(1, currentTransition.transitionDurationMs),
        ),
      )
    : 0;

  const hasManualAudioTracks = audioTracks.length > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a", color: "#fff" }}>
      {visualPlan.tracks.length > 0 ? (
        <>
          {visualPlan.tracks.map((track) => {
            const asset = visualAssetMap.get(track.assetId);
            if (!asset) {
              return null;
            }
            return (
              <Sequence
                key={track.id}
                from={Math.max(0, Math.floor((track.startMs / 1000) * fps))}
                durationInFrames={Math.max(
                  1,
                  Math.ceil(((track.endMs - track.startMs) / 1000) * fps),
                )}
              >
                <VisualTrackLayer asset={asset} track={track} />
              </Sequence>
            );
          })}
        </>
      ) : backgroundImagePath ? (
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
      {illustrationImagePath && currentShot?.type === "insert" ? (
        <Img
          src={illustrationImagePath}
          style={{
            position: "absolute",
            inset: "12% 14% 20%",
            width: "72%",
            height: "68%",
            objectFit: "cover",
            borderRadius: 28,
            border: "4px solid rgba(255,255,255,0.82)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.48)",
          }}
        />
      ) : null}
      {currentTransition ? (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: `rgba(255,255,255,${0.16 * (1 - transitionProgress)})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 180,
              left: 0,
              width: 760,
              height: 132,
              backgroundColor: "rgba(15,23,42,0.82)",
              borderLeft: "10px solid rgba(245,158,11,0.95)",
              transform: `translateX(${(-1 + transitionProgress) * 220}px)`,
              opacity: 1 - transitionProgress * 0.12,
              boxShadow: "0 12px 34px rgba(0,0,0,0.28)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 34,
                top: 22,
                fontSize: 28,
                opacity: 0.82,
              }}
            >
              Chapter
            </div>
            <div
              style={{
                position: "absolute",
                left: 32,
                top: 54,
                fontSize: 56,
                fontWeight: 800,
              }}
            >
              {currentTransition.title}
            </div>
          </div>
        </>
      ) : null}
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
        {currentChapter ? `${theme}  /  ${currentChapter.title}` : theme}
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
        {currentSubtitlePresentation ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            <span style={{ color: "rgba(216,255,246,0.9)", marginRight: 10 }}>
              {currentSubtitlePresentation.speaker}:
            </span>
            {currentSubtitlePresentation.tokens.map((token, index) => (
              <span
                key={`${token.kind}-${index}-${token.text}`}
                style={getSubtitleTokenStyle(token.kind)}
              >
                {token.text}
              </span>
            ))}
          </div>
        ) : currentSubtitle ? (
          `${currentSubtitle.speaker}: ${currentSubtitle.text}`
        ) : (
          ""
        )}
      </div>
      {currentSubtitlePresentation?.keywordBadge ? (
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 188,
            padding: "8px 18px",
            borderRadius: 999,
            backgroundColor: "rgba(245, 158, 11, 0.92)",
            color: "#0f172a",
            fontSize: 28,
            fontWeight: 800,
            boxShadow: "0 10px 28px rgba(0,0,0,0.25)",
          }}
        >
          {currentSubtitlePresentation.keywordBadge}
        </div>
      ) : null}
      {audioMixPlan.assets.ambientPath ? (
        <Audio
          src={audioMixPlan.assets.ambientPath}
          volume={(audioFrame) =>
            getWindowVolume(
              audioMixPlan.ambientWindows,
              (audioFrame / fps) * 1000,
            )
          }
        />
      ) : null}
      {audioMixPlan.assets.bgmPath ? (
        <Audio
          src={audioMixPlan.assets.bgmPath}
          volume={(audioFrame) =>
            getWindowVolume(audioMixPlan.bgmWindows, (audioFrame / fps) * 1000)
          }
        />
      ) : null}
      {audioMixPlan.seCues.map((cue) => {
        const cuePath =
          cue.assetKey === "accent"
            ? audioMixPlan.assets.accentPath
            : audioMixPlan.assets.transitionPath;
        if (!cuePath) {
          return null;
        }
        return (
          <Sequence
            key={cue.id}
            from={Math.max(0, Math.floor((cue.startMs / 1000) * fps))}
            durationInFrames={Math.max(
              1,
              Math.ceil((cue.durationMs / 1000) * fps),
            )}
          >
            <Audio src={cuePath} volume={cue.volume} />
          </Sequence>
        );
      })}
      {hasManualAudioTracks ? (
        audioTracks.map((track) => (
          <Sequence
            key={track.clipId}
            from={Math.max(0, Math.floor((track.startMs / 1000) * fps))}
            durationInFrames={Math.max(
              1,
              Math.ceil(((track.endMs - track.startMs) / 1000) * fps),
            )}
          >
            <Audio
              src={track.assetPath}
              trimBefore={Math.max(
                0,
                Math.floor((track.trimBeforeMs / 1000) * fps),
              )}
              volume={(audioFrame) =>
                getManualAudioTrackVolume(track, (audioFrame / fps) * 1000)
              }
            />
          </Sequence>
        ))
      ) : audioPath ? (
        <Audio src={audioPath} />
      ) : null}
    </AbsoluteFill>
  );
};

const VisualTrackLayer: React.FC<{
  asset: VisualPlan["assets"][number];
  track: VisualPlan["tracks"][number];
}> = ({ asset, track }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = Math.max(
    1,
    Math.ceil(((track.endMs - track.startMs) / 1000) * fps),
  );
  const progress = durationFrames <= 1 ? 0 : frame / (durationFrames - 1);
  const scale = track.zoomStart + (track.zoomEnd - track.zoomStart) * progress;
  const translateX = track.panX * 240;
  const translateY = track.panY * 180;
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
    transformOrigin: "center center",
    filter: "saturate(1.06) contrast(1.04)",
  };

  return (
    <AbsoluteFill>
      {asset.sourceType === "video" ? (
        <OffthreadVideo
          src={asset.path}
          muted
          trimBefore={Math.max(
            0,
            Math.floor((track.sourceStartMs / 1000) * fps),
          )}
          style={style}
        />
      ) : (
        <Img src={asset.path} style={style} />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.24) 0%, rgba(15,23,42,0.06) 34%, rgba(15,23,42,0.46) 100%)",
        }}
      />
      {track.accentColor ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 18% 18%, ${track.accentColor} 0%, transparent 44%)`,
            mixBlendMode: "screen",
            opacity: 0.72,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const getExpressionStyle = (
  expression: "normal" | "happy" | "serious" | "surprised",
) => {
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

const getSubtitleTokenStyle = (kind: "plain" | "emphasis" | "secondary") => {
  if (kind === "emphasis") {
    return {
      color: "#fef08a",
      backgroundColor: "rgba(217, 119, 6, 0.24)",
      padding: "0 6px",
      borderRadius: 8,
    };
  }
  if (kind === "secondary") {
    return {
      color: "#d8fff6",
      padding: "0 2px",
    };
  }
  return {
    color: "#ffffff",
  };
};

const getWindowVolume = (
  windows: Array<{ startMs: number; endMs: number; volume: number }>,
  currentMs: number,
) => {
  const matched = windows.find(
    (window) => currentMs >= window.startMs && currentMs < window.endMs,
  );
  return matched?.volume ?? 0;
};

const getManualAudioTrackVolume = (
  track: ManualAudioTrack,
  relativeMs: number,
) => {
  const durationMs = Math.max(1, track.endMs - track.startMs);
  const fadeInRatio =
    track.fadeInMs > 0
      ? Math.min(1, Math.max(0, relativeMs / track.fadeInMs))
      : 1;
  const remainingMs = Math.max(0, durationMs - relativeMs);
  const fadeOutRatio =
    track.fadeOutMs > 0
      ? Math.min(1, Math.max(0, remainingMs / track.fadeOutMs))
      : 1;
  return track.volume * Math.min(fadeInRatio, fadeOutRatio);
};
