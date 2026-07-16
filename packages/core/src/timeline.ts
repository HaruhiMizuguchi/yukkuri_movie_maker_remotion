import type {
  TimelineClip,
  TimelineData,
  TimelineMarker,
  TimelineTrack,
} from "@ymm/shared";

export type { TimelineData } from "@ymm/shared";

type MoveClipInput = {
  trackId: string;
  clipId: string;
  newStartMs: number;
};

type ResizeClipInput = {
  trackId: string;
  clipId: string;
  newDurationMs: number;
};

type SplitClipInput = {
  trackId: string;
  clipId: string;
  splitAtMs: number;
};

type PlaybackRangeInput = {
  inMs: number;
  outMs: number;
};

type AddClipInput = {
  trackId: string;
  clip: TimelineClip;
};

type DuplicateClipInput = {
  trackId: string;
  clipId: string;
};

type DeleteClipInput = {
  trackId: string;
  clipId: string;
};

type UpdateClipInput = {
  trackId: string;
  clipId: string;
  patch: Partial<TimelineClip>;
};

type AddMarkerInput = TimelineMarker;

type CreateFinalVideoEditingTimelineInput = {
  assetPath: string;
  durationMs: number;
  sourceName?: string;
};

export type RemotionTimelineProps = {
  durationInFrames: number;
  durationMs: number;
  playbackRange: { inMs: number; outMs: number };
  subtitleTracks: Array<{
    clipId: string;
    startMs: number;
    endMs: number;
    text: string;
    speaker: string;
  }>;
  audioTracks: Array<{
    clipId: string;
    assetPath: string;
    startMs: number;
    endMs: number;
    trimBeforeMs: number;
    volume: number;
    fadeInMs: number;
    fadeOutMs: number;
  }>;
  videoTracks: Array<{
    clipId: string;
    assetPath: string;
    startMs: number;
    endMs: number;
    trimBeforeMs: number;
    volume: number;
  }>;
  finalVideoEditMode: boolean;
  markers: TimelineMarker[];
  manualEditSummary: {
    subtitleClipCount: number;
    audioClipCount: number;
    videoClipCount: number;
    markerCount: number;
    playbackRangeApplied: boolean;
  };
};

/**
 * 焼き込み済みの完成動画を、元の自動生成レイヤーと二重にならない編集状態へ変換する。
 */
export const createFinalVideoEditingTimeline = (
  timeline: TimelineData,
  input: CreateFinalVideoEditingTimelineInput,
): TimelineData => {
  const durationMs = Math.max(100, Math.round(input.durationMs));
  const disabledSourceTracks = timeline.tracks
    .filter(
      (track) =>
        track.id !== "track-final-video" &&
        track.id !== "track-overlay-subtitle",
    )
    .map((track) => ({
      ...track,
      ...(track.type === "audio" || track.type === "bgm"
        ? { muted: true }
        : { hidden: true }),
    }));

  return {
    ...timeline,
    editingMode: "final-video",
    playbackRange: { inMs: 0, outMs: durationMs },
    tracks: [
      {
        id: "track-final-video",
        name: input.sourceName?.trim() || "完成動画",
        type: "video",
        hidden: false,
        muted: false,
        clips: [
          {
            id: "final-video-main",
            assetType: "video",
            assetPath: input.assetPath,
            startMs: 0,
            durationMs,
            inMs: 0,
            outMs: durationMs,
            volume: 1,
            timingMode: "manual",
          },
        ],
      },
      {
        id: "track-overlay-subtitle",
        name: "追加テロップ",
        type: "subtitle",
        hidden: false,
        clips: [],
      },
      ...disabledSourceTracks,
    ],
    markers: timeline.markers.filter((marker) => marker.timeMs <= durationMs),
  };
};

export type GeneratedTimelineTimestamp = {
  index?: number;
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type TimelineSynchronizationSummary = {
  audioClipsAdjusted: number;
  subtitleClipsAdjusted: number;
  playbackRangeAdjusted: boolean;
  audioDurationMs: number;
};

export const moveClip = (
  timeline: TimelineData,
  input: MoveClipInput,
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === input.trackId
      ? {
          ...track,
          clips: sortClips(
            track.clips.map((clip) =>
              clip.id === input.clipId
                ? sanitizeClip({
                    ...clip,
                    startMs: input.newStartMs,
                    timingMode: "manual",
                  })
                : clip,
            ),
          ),
        }
      : track,
  ),
});

export const resizeClip = (
  timeline: TimelineData,
  input: ResizeClipInput,
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === input.trackId
      ? {
          ...track,
          clips: sortClips(
            track.clips.map((clip) =>
              clip.id === input.clipId
                ? sanitizeClip({
                    ...clip,
                    durationMs: input.newDurationMs,
                    timingMode: "manual",
                  })
                : clip,
            ),
          ),
        }
      : track,
  ),
});

export const splitClip = (
  timeline: TimelineData,
  input: SplitClipInput,
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) => {
    if (track.id !== input.trackId) {
      return track;
    }

    const source = track.clips.find((clip) => clip.id === input.clipId);
    if (!source) {
      return track;
    }

    const sanitizedSource = sanitizeClip(source);
    const splitAtMs = Math.max(
      sanitizedSource.startMs + 100,
      Math.min(
        input.splitAtMs,
        sanitizedSource.startMs + sanitizedSource.durationMs - 100,
      ),
    );
    if (
      splitAtMs <= sanitizedSource.startMs ||
      splitAtMs >= sanitizedSource.startMs + sanitizedSource.durationMs
    ) {
      return track;
    }

    const leftDurationMs = splitAtMs - sanitizedSource.startMs;
    const rightDurationMs = sanitizedSource.durationMs - leftDurationMs;
    const sourceInMs = sanitizedSource.inMs ?? 0;
    const sourceOutMs =
      sanitizedSource.outMs ?? sourceInMs + sanitizedSource.durationMs;
    const rightInMs = sourceInMs + leftDurationMs;
    const duplicateId = createSplitClipId(track.clips, sanitizedSource.id);

    const leftClip = sanitizeClip({
      ...sanitizedSource,
      durationMs: leftDurationMs,
      outMs: Math.min(sourceOutMs, sourceInMs + leftDurationMs),
      timingMode: "manual",
    });
    const rightClip = sanitizeClip({
      ...sanitizedSource,
      id: duplicateId,
      startMs: splitAtMs,
      durationMs: rightDurationMs,
      inMs: rightInMs,
      outMs: sourceOutMs,
      timingMode: "manual",
    });

    return {
      ...track,
      clips: sortClips(
        track.clips.flatMap((clip) =>
          clip.id === input.clipId ? [leftClip, rightClip] : [clip],
        ),
      ),
    };
  }),
});

export const addClip = (
  timeline: TimelineData,
  input: AddClipInput,
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === input.trackId
      ? {
          ...track,
          clips: sortClips([
            ...track.clips,
            sanitizeClip({ ...input.clip, timingMode: "manual" }),
          ]),
        }
      : track,
  ),
});

export const duplicateClip = (
  timeline: TimelineData,
  input: DuplicateClipInput,
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) => {
    if (track.id !== input.trackId) {
      return track;
    }
    const source = track.clips.find((clip) => clip.id === input.clipId);
    if (!source) {
      return track;
    }
    const duplicated = sanitizeClip({
      ...source,
      id: createDuplicateClipId(track.clips, source.id),
      startMs: source.startMs + source.durationMs,
      timingMode: "manual",
    });
    return {
      ...track,
      clips: sortClips([...track.clips, duplicated]),
    };
  }),
});

export const deleteClip = (
  timeline: TimelineData,
  input: DeleteClipInput,
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === input.trackId
      ? {
          ...track,
          clips: track.clips.filter((clip) => clip.id !== input.clipId),
        }
      : track,
  ),
});

export const updateClip = (
  timeline: TimelineData,
  input: UpdateClipInput,
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === input.trackId
      ? {
          ...track,
          clips: sortClips(
            track.clips.map((clip) =>
              clip.id === input.clipId
                ? sanitizeClip({
                    ...clip,
                    ...input.patch,
                    timingMode: "manual",
                  })
                : clip,
            ),
          ),
        }
      : track,
  ),
});

export const setPlaybackRange = (
  timeline: TimelineData,
  range: PlaybackRangeInput,
): TimelineData => {
  const { inMs, outMs } = sanitizePlaybackRange(range);
  return {
    ...timeline,
    playbackRange: { inMs, outMs },
  };
};

export const addMarker = (
  timeline: TimelineData,
  marker: AddMarkerInput,
): TimelineData => ({
  ...timeline,
  markers: sortMarkers([
    ...timeline.markers.filter((current) => current.id !== marker.id),
    sanitizeMarker(marker),
  ]),
});

/**
 * プロジェクト作成時の文字数ベース推定尺を、TTSが返した実測尺へ同期する。
 * timingMode=manual のクリップと、旧形式でも自動生成の形から外れたクリップは保持する。
 */
export const synchronizeGeneratedTimelineTiming = (
  timeline: TimelineData,
  input: {
    timestamps: GeneratedTimelineTimestamp[];
    audioDurationMs: number;
  },
): { timeline: TimelineData; summary: TimelineSynchronizationSummary } => {
  const audioDurationMs = Math.max(1, Math.round(input.audioDurationMs));
  if (timeline.editingMode === "final-video") {
    return {
      timeline,
      summary: {
        audioClipsAdjusted: 0,
        subtitleClipsAdjusted: 0,
        playbackRangeAdjusted: false,
        audioDurationMs,
      },
    };
  }
  const originalMaxTrackEndMs = getMaxTrackEndMs(timeline.tracks);
  const coveredWholeTimeline =
    timeline.playbackRange.inMs === 0 &&
    timeline.playbackRange.outMs >= originalMaxTrackEndMs;
  const timestampsByIndex = new Map(
    input.timestamps.map((timestamp, index) => [
      timestamp.index ?? index,
      timestamp,
    ]),
  );
  let audioClipsAdjusted = 0;
  let subtitleClipsAdjusted = 0;

  const tracks = timeline.tracks.map((track) => {
    if (track.type === "subtitle") {
      let legacyEstimatedCursorMs = 0;
      return {
        ...track,
        clips: track.clips.map((clip) => {
          const match = /^sub-(\d+)$/.exec(clip.id);
          const timestampIndex = match ? Number(match[1]) - 1 : -1;
          const timestamp = timestampsByIndex.get(timestampIndex);
          const estimatedDurationMs = Math.max(
            1200,
            (clip.text ?? "").length * 100,
          );
          const isLegacyGenerated =
            clip.timingMode === undefined &&
            match !== null &&
            clip.assetPath ===
              "output/subtitle_generation/latest/subtitles.json" &&
            clip.startMs === legacyEstimatedCursorMs &&
            clip.durationMs === estimatedDurationMs;
          if (match !== null) {
            legacyEstimatedCursorMs += estimatedDurationMs;
          }
          const isGenerated =
            clip.timingMode === "generated" || isLegacyGenerated;
          if (!isGenerated || !timestamp || clip.text !== timestamp.text) {
            return clip;
          }

          const synchronizedClip = sanitizeClip({
            ...clip,
            startMs: timestamp.startMs,
            durationMs: Math.max(1, timestamp.endMs - timestamp.startMs),
            timingMode: "generated",
          });
          if (!areClipsEqual(clip, synchronizedClip)) {
            subtitleClipsAdjusted += 1;
          }
          return synchronizedClip;
        }),
      };
    }

    if (track.type === "audio") {
      return {
        ...track,
        clips: track.clips.map((clip) => {
          const isLegacyGenerated =
            clip.timingMode === undefined &&
            clip.id === "audio-main" &&
            clip.assetPath === "output/tts_generation/latest/audio.wav" &&
            clip.startMs === 0 &&
            (clip.inMs ?? 0) === 0 &&
            clip.durationMs === originalMaxTrackEndMs &&
            (clip.outMs ?? clip.durationMs) === originalMaxTrackEndMs;
          const isGenerated =
            clip.timingMode === "generated" || isLegacyGenerated;
          if (!isGenerated) {
            return clip;
          }

          const synchronizedClip = sanitizeClip({
            ...clip,
            startMs: 0,
            durationMs: audioDurationMs,
            inMs: 0,
            outMs: audioDurationMs,
            timingMode: "generated",
          });
          if (!areClipsEqual(clip, synchronizedClip)) {
            audioClipsAdjusted += 1;
          }
          return synchronizedClip;
        }),
      };
    }

    return track;
  });

  const synchronizedOutMs = coveredWholeTimeline
    ? Math.max(1000, getMaxTrackEndMs(tracks))
    : timeline.playbackRange.outMs;
  const playbackRangeAdjusted =
    synchronizedOutMs !== timeline.playbackRange.outMs;
  return {
    timeline: {
      ...timeline,
      tracks,
      playbackRange: {
        ...timeline.playbackRange,
        outMs: synchronizedOutMs,
      },
    },
    summary: {
      audioClipsAdjusted,
      subtitleClipsAdjusted,
      playbackRangeAdjusted,
      audioDurationMs,
    },
  };
};

export const timelineToRemotionProps = (
  timeline: TimelineData,
  fps = 30,
): RemotionTimelineProps => {
  const playbackRange = sanitizePlaybackRange(timeline.playbackRange);
  const durationMs = Math.max(playbackRange.outMs - playbackRange.inMs, 1000);
  const subtitleTracks = collectSubtitleTracks(timeline.tracks, playbackRange);
  const audioTracks = collectAudioTracks(timeline.tracks, playbackRange);
  const videoTracks = collectVideoTracks(timeline.tracks, playbackRange);
  const markers = collectMarkers(timeline.markers, playbackRange);
  const maxTrackEndMs = Math.max(
    0,
    ...timeline.tracks.flatMap((track) =>
      track.clips.map((clip) => clip.startMs + clip.durationMs),
    ),
  );
  return {
    durationInFrames: Math.ceil(
      (durationMs / 1000) * Math.max(1, Math.floor(fps)),
    ),
    durationMs,
    playbackRange,
    subtitleTracks,
    audioTracks,
    videoTracks,
    finalVideoEditMode: timeline.editingMode === "final-video",
    markers,
    manualEditSummary: {
      subtitleClipCount: subtitleTracks.length,
      audioClipCount: audioTracks.length,
      videoClipCount: videoTracks.length,
      markerCount: markers.length,
      playbackRangeApplied:
        playbackRange.inMs > 0 || playbackRange.outMs < maxTrackEndMs,
    },
  };
};

const collectSubtitleTracks = (
  tracks: TimelineTrack[],
  playbackRange: { inMs: number; outMs: number },
): Array<{
  clipId: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker: string;
}> =>
  tracks
    .filter((track) => track.type === "subtitle" && track.hidden !== true)
    .flatMap((track) =>
      track.clips
        .map((clip) => normalizeClipToPlaybackRange(clip, playbackRange))
        .filter(
          (clip): clip is TimelineClip & { startMs: number; endMs: number } =>
            clip !== null,
        )
        .map((normalized) => ({
          clipId: normalized.id,
          startMs: normalized.startMs,
          endMs: normalized.endMs,
          text: normalized.text ?? "",
          speaker: normalized.style ?? "narrator",
        })),
    )
    .sort((left, right) => left.startMs - right.startMs);

const collectAudioTracks = (
  tracks: TimelineTrack[],
  playbackRange: { inMs: number; outMs: number },
): Array<{
  clipId: string;
  assetPath: string;
  startMs: number;
  endMs: number;
  trimBeforeMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
}> =>
  tracks
    .filter(
      (track) =>
        (track.type === "audio" || track.type === "bgm") &&
        track.muted !== true,
    )
    .flatMap((track) =>
      track.clips
        .map((clip) => normalizeClipToPlaybackRange(clip, playbackRange))
        .filter(
          (clip): clip is TimelineClip & { startMs: number; endMs: number } =>
            clip !== null,
        )
        .map((normalized) => ({
          clipId: normalized.id,
          assetPath: normalized.assetPath,
          startMs: normalized.startMs,
          endMs: normalized.endMs,
          trimBeforeMs: normalized.inMs ?? 0,
          volume: normalized.volume ?? 1,
          fadeInMs: normalized.fadeInMs ?? 0,
          fadeOutMs: normalized.fadeOutMs ?? 0,
        })),
    )
    .sort((left, right) => left.startMs - right.startMs);

const collectVideoTracks = (
  tracks: TimelineTrack[],
  playbackRange: { inMs: number; outMs: number },
): RemotionTimelineProps["videoTracks"] =>
  tracks
    .filter((track) => track.type === "video" && track.hidden !== true)
    .flatMap((track) =>
      track.clips
        .map((clip) => normalizeClipToPlaybackRange(clip, playbackRange))
        .filter(
          (clip): clip is TimelineClip & { startMs: number; endMs: number } =>
            clip !== null,
        )
        .map((normalized) => ({
          clipId: normalized.id,
          assetPath: normalized.assetPath,
          startMs: normalized.startMs,
          endMs: normalized.endMs,
          trimBeforeMs: normalized.inMs ?? 0,
          volume: track.muted === true ? 0 : (normalized.volume ?? 1),
        })),
    )
    .sort((left, right) => left.startMs - right.startMs);

const collectMarkers = (
  markers: TimelineMarker[],
  playbackRange: { inMs: number; outMs: number },
): TimelineMarker[] =>
  sortMarkers(
    markers
      .filter(
        (marker) =>
          marker.timeMs >= playbackRange.inMs &&
          marker.timeMs <= playbackRange.outMs,
      )
      .map((marker) => ({
        ...marker,
        timeMs: marker.timeMs - playbackRange.inMs,
      })),
  );

const normalizeClipToPlaybackRange = (
  clip: TimelineClip,
  playbackRange: { inMs: number; outMs: number },
): (TimelineClip & { startMs: number; endMs: number }) | null => {
  const clipStartMs = clip.startMs;
  const clipEndMs = clip.startMs + clip.durationMs;
  const clippedStartMs = Math.max(clipStartMs, playbackRange.inMs);
  const clippedEndMs = Math.min(clipEndMs, playbackRange.outMs);
  if (clippedEndMs <= clippedStartMs) {
    return null;
  }

  const trimmedLeadMs = Math.max(0, playbackRange.inMs - clipStartMs);
  return {
    ...sanitizeClip(clip),
    startMs: clippedStartMs - playbackRange.inMs,
    endMs: clippedEndMs - playbackRange.inMs,
    inMs: (clip.inMs ?? 0) + trimmedLeadMs,
  };
};

const sanitizePlaybackRange = (
  range: PlaybackRangeInput,
): { inMs: number; outMs: number } => {
  const inMs = Math.max(
    0,
    Number.isFinite(range.inMs) ? Math.floor(range.inMs) : 0,
  );
  const outMs = Math.max(
    inMs,
    Number.isFinite(range.outMs) ? Math.floor(range.outMs) : inMs,
  );
  return { inMs, outMs };
};

const sanitizeClip = (clip: TimelineClip): TimelineClip => {
  const inMs =
    clip.inMs === undefined ? undefined : Math.max(0, Math.floor(clip.inMs));
  const outMs =
    clip.outMs === undefined
      ? undefined
      : Math.max(inMs ?? 0, Math.floor(clip.outMs));
  return {
    ...clip,
    startMs: Math.max(0, Math.floor(clip.startMs)),
    durationMs: Math.max(100, Math.floor(clip.durationMs)),
    inMs,
    outMs,
    volume:
      clip.volume === undefined
        ? undefined
        : Math.min(2, Math.max(0, clip.volume)),
    fadeInMs:
      clip.fadeInMs === undefined
        ? undefined
        : Math.max(0, Math.floor(clip.fadeInMs)),
    fadeOutMs:
      clip.fadeOutMs === undefined
        ? undefined
        : Math.max(0, Math.floor(clip.fadeOutMs)),
  };
};

const sanitizeMarker = (marker: TimelineMarker): TimelineMarker => ({
  ...marker,
  timeMs: Math.max(0, Math.floor(marker.timeMs)),
  label: marker.label.trim(),
});

const sortClips = (clips: TimelineClip[]): TimelineClip[] =>
  [...clips].sort((left, right) => left.startMs - right.startMs);

const getMaxTrackEndMs = (tracks: TimelineTrack[]): number =>
  Math.max(
    0,
    ...tracks.flatMap((track) =>
      track.clips.map((clip) => clip.startMs + clip.durationMs),
    ),
  );

const areClipsEqual = (left: TimelineClip, right: TimelineClip): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const sortMarkers = (markers: TimelineMarker[]): TimelineMarker[] =>
  [...markers].sort((left, right) => left.timeMs - right.timeMs);

const createDuplicateClipId = (
  clips: TimelineClip[],
  sourceId: string,
): string => {
  const baseId = `${sourceId}-copy`;
  if (!clips.some((clip) => clip.id === baseId)) {
    return baseId;
  }
  let suffix = 2;
  while (clips.some((clip) => clip.id === `${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
};

const createSplitClipId = (clips: TimelineClip[], sourceId: string): string => {
  const baseId = `${sourceId}-split-2`;
  if (!clips.some((clip) => clip.id === baseId)) {
    return baseId;
  }
  let suffix = 3;
  while (clips.some((clip) => clip.id === `${sourceId}-split-${suffix}`)) {
    suffix += 1;
  }
  return `${sourceId}-split-${suffix}`;
};
