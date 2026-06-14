export type TimelineClip = {
  id: string;
  assetType: string;
  assetPath: string;
  startMs: number;
  durationMs: number;
  inMs?: number;
  outMs?: number;
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  text?: string;
  style?: string;
};

export type TimelineMarker = {
  id: string;
  timeMs: number;
  label: string;
};

export type TimelineTrack = {
  id: string;
  name: string;
  type: string;
  clips: TimelineClip[];
};

export type TimelineData = {
  playbackRange: { inMs: number; outMs: number };
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
};

export type SelectedTimelineClip = {
  trackId: string;
  clipId: string;
};

export const clampNonNegativeInt = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const clampPositiveInt = (value: number, minimum = 100) =>
  Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : minimum;

const sortTimelineClips = (clips: TimelineClip[]) =>
  [...clips].sort((left, right) => left.startMs - right.startMs);

const sortTimelineMarkers = (markers: TimelineMarker[]) =>
  [...markers].sort((left, right) => left.timeMs - right.timeMs);

export const updateTimelineClipLocal = (
  timeline: TimelineData,
  trackId: string,
  clipId: string,
  patch: Partial<TimelineClip>
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === trackId
      ? {
          ...track,
          clips: sortTimelineClips(
            track.clips.map((clip) =>
              clip.id === clipId
                ? {
                    ...clip,
                    ...patch,
                    startMs:
                      patch.startMs === undefined
                        ? clip.startMs
                        : clampNonNegativeInt(patch.startMs),
                    durationMs:
                      patch.durationMs === undefined
                        ? clip.durationMs
                        : clampPositiveInt(patch.durationMs),
                    inMs:
                      patch.inMs === undefined
                        ? clip.inMs
                        : clampNonNegativeInt(patch.inMs),
                    outMs:
                      patch.outMs === undefined
                        ? clip.outMs
                        : clampNonNegativeInt(patch.outMs),
                  }
                : clip
            )
          ),
        }
      : track
  ),
});

export const duplicateTimelineClipLocal = (
  timeline: TimelineData,
  trackId: string,
  clipId: string
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }
    const source = track.clips.find((clip) => clip.id === clipId);
    if (!source) {
      return track;
    }
    const duplicateId = predictNextDuplicateClipId(track.clips, clipId);
    return {
      ...track,
      clips: sortTimelineClips([
        ...track.clips,
        {
          ...source,
          id: duplicateId,
          startMs: source.startMs + Math.max(100, Math.floor(source.durationMs / 4)),
        },
      ]),
    };
  }),
});

export const deleteTimelineClipLocal = (
  timeline: TimelineData,
  trackId: string,
  clipId: string
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === trackId
      ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
      : track
  ),
});

export const addManualSubtitleClipLocal = (
  timeline: TimelineData,
  text: string,
  clipId: string
): TimelineData => {
  const cleanText = text.trim();
  const playbackStart = timeline.playbackRange.inMs;
  const durationMs = Math.min(
    4000,
    Math.max(1200, timeline.playbackRange.outMs - playbackStart)
  );
  const nextClip: TimelineClip = {
    id: clipId,
    assetType: "subtitle",
    assetPath: "manual",
    startMs: playbackStart,
    durationMs,
    text: cleanText,
    style: "manual",
  };
  const hasSubtitleTrack = timeline.tracks.some((track) => track.id === "track-subtitle");
  const tracks = hasSubtitleTrack
    ? timeline.tracks.map((track) =>
        track.id === "track-subtitle"
          ? { ...track, clips: sortTimelineClips([...track.clips, nextClip]) }
          : track
      )
    : [
        ...timeline.tracks,
        { id: "track-subtitle", name: "字幕", type: "subtitle", clips: [nextClip] },
      ];
  return { ...timeline, tracks };
};

export const addTimelineMarkerLocal = (
  timeline: TimelineData,
  marker: TimelineMarker
): TimelineData => ({
  ...timeline,
  markers: sortTimelineMarkers([
    ...timeline.markers.filter((current) => current.id !== marker.id),
    {
      ...marker,
      timeMs: clampNonNegativeInt(marker.timeMs),
      label: marker.label.trim(),
    },
  ]),
});

export const splitTimelineClipLocal = (
  timeline: TimelineData,
  trackId: string,
  clipId: string,
  splitAtMs: number
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }
    const source = track.clips.find((clip) => clip.id === clipId);
    if (!source || source.durationMs < 200) {
      return track;
    }
    const splitMs = Math.max(
      source.startMs + 100,
      Math.min(splitAtMs, source.startMs + source.durationMs - 100)
    );
    const firstDuration = splitMs - source.startMs;
    const secondDuration = source.durationMs - firstDuration;
    const nextClipId = predictNextSplitClipId(track.clips, source.id);
    const firstClip = {
      ...source,
      durationMs: firstDuration,
      outMs: source.inMs === undefined ? source.outMs : source.inMs + firstDuration,
    };
    const secondClip = {
      ...source,
      id: nextClipId,
      startMs: splitMs,
      durationMs: secondDuration,
      inMs: source.inMs === undefined ? source.inMs : source.inMs + firstDuration,
      outMs: source.outMs,
    };
    return {
      ...track,
      clips: sortTimelineClips(
        track.clips.flatMap((clip) => (clip.id === clipId ? [firstClip, secondClip] : [clip]))
      ),
    };
  }),
});

export const findTimelineClip = (
  timeline: TimelineData | null,
  selectedClip: SelectedTimelineClip | null
): { track: TimelineTrack; clip: TimelineClip } | null => {
  if (!timeline || !selectedClip) {
    return null;
  }
  const track = timeline.tracks.find((candidate) => candidate.id === selectedClip.trackId);
  const clip = track?.clips.find((candidate) => candidate.id === selectedClip.clipId);
  return track && clip ? { track, clip } : null;
};

export const getTimelineViewport = (
  timeline: TimelineData,
  playheadMs: number,
  zoomWindowMs: number
) => {
  const durationMs = Math.max(timeline.playbackRange.outMs, 1000);
  const viewportDurationMs = Math.min(Math.max(1000, zoomWindowMs), durationMs);
  const clampedPlayheadMs = Math.min(Math.max(0, playheadMs), durationMs);
  const viewportStartMs = Math.max(
    0,
    Math.min(clampedPlayheadMs - viewportDurationMs / 2, durationMs - viewportDurationMs)
  );
  const viewportEndMs = viewportStartMs + viewportDurationMs;
  return {
    durationMs,
    viewportDurationMs,
    viewportStartMs,
    viewportEndMs,
    clampedPlayheadMs,
  };
};

export const getVisibleClipLayout = (
  clip: TimelineClip,
  viewport: ReturnType<typeof getTimelineViewport>
): {
  leftPercent: number;
  widthPercent: number;
  trimmedLeft: boolean;
  trimmedRight: boolean;
} | null => {
  const clipStartMs = clip.startMs;
  const clipEndMs = clip.startMs + clip.durationMs;
  const visibleStartMs = Math.max(clipStartMs, viewport.viewportStartMs);
  const visibleEndMs = Math.min(clipEndMs, viewport.viewportEndMs);
  if (visibleEndMs <= visibleStartMs) {
    return null;
  }
  return {
    leftPercent:
      ((visibleStartMs - viewport.viewportStartMs) / viewport.viewportDurationMs) * 100,
    widthPercent: Math.max(
      1.4,
      ((visibleEndMs - visibleStartMs) / viewport.viewportDurationMs) * 100
    ),
    trimmedLeft: visibleStartMs > clipStartMs,
    trimmedRight: visibleEndMs < clipEndMs,
  };
};

export const getTimelineTickStepMs = (viewportDurationMs: number) => {
  if (viewportDurationMs <= 2500) {
    return 250;
  }
  if (viewportDurationMs <= 6000) {
    return 500;
  }
  if (viewportDurationMs <= 15000) {
    return 1000;
  }
  return 2000;
};

export const formatTimelineTime = (timeMs: number) => `${(timeMs / 1000).toFixed(1)}s`;

export const getTrackAccent = (trackType: string) => {
  if (trackType === "audio" || trackType === "bgm") {
    return {
      solid: "linear-gradient(120deg, rgba(34,197,94,0.88), rgba(74,222,128,0.8))",
      glow: "rgba(74, 222, 128, 0.32)",
    };
  }
  if (trackType === "subtitle") {
    return {
      solid: "linear-gradient(120deg, rgba(56,189,248,0.88), rgba(59,130,246,0.82))",
      glow: "rgba(96, 165, 250, 0.28)",
    };
  }
  return {
    solid: "linear-gradient(120deg, rgba(168,85,247,0.82), rgba(236,72,153,0.78))",
    glow: "rgba(216, 180, 254, 0.26)",
  };
};

export const predictNextSplitClipId = (clips: TimelineClip[], sourceClipId: string) => {
  const baseId = `${sourceClipId}-split-2`;
  if (!clips.some((clip) => clip.id === baseId)) {
    return baseId;
  }
  let suffix = 3;
  while (clips.some((clip) => clip.id === `${sourceClipId}-split-${suffix}`)) {
    suffix += 1;
  }
  return `${sourceClipId}-split-${suffix}`;
};

export const predictNextDuplicateClipId = (clips: TimelineClip[], sourceClipId: string) => {
  const duplicateIdBase = `${sourceClipId}-copy`;
  if (!clips.some((clip) => clip.id === duplicateIdBase)) {
    return duplicateIdBase;
  }
  let suffix = 2;
  while (clips.some((clip) => clip.id === `${duplicateIdBase}-${suffix}`)) {
    suffix += 1;
  }
  return `${duplicateIdBase}-${suffix}`;
};

export const summarizeTimelineDraft = (timeline: TimelineData) => ({
  subtitleClipCount: timeline.tracks
    .filter((track) => track.type === "subtitle")
    .reduce((sum, track) => sum + track.clips.length, 0),
  audioClipCount: timeline.tracks
    .filter((track) => track.type === "audio" || track.type === "bgm")
    .reduce((sum, track) => sum + track.clips.length, 0),
  markerCount: timeline.markers.length,
});
