import type { TimelineData, TimelineTrack } from "@ymm/shared";

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

type PlaybackRangeInput = {
  inMs: number;
  outMs: number;
};

export type RemotionTimelineProps = {
  durationInFrames: number;
  subtitleTracks: Array<{ startMs: number; endMs: number; text: string; speaker: string }>;
};

export const moveClip = (timeline: TimelineData, input: MoveClipInput): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === input.trackId
      ? {
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === input.clipId ? { ...clip, startMs: Math.max(0, input.newStartMs) } : clip
          ),
        }
      : track
  ),
});

export const resizeClip = (timeline: TimelineData, input: ResizeClipInput): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === input.trackId
      ? {
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === input.clipId
              ? { ...clip, durationMs: Math.max(100, input.newDurationMs) }
              : clip
          ),
        }
      : track
  ),
});

export const setPlaybackRange = (
  timeline: TimelineData,
  range: PlaybackRangeInput
): TimelineData => {
  const inMs = Math.max(0, range.inMs);
  const outMs = Math.max(inMs, range.outMs);
  return {
    ...timeline,
    playbackRange: { inMs, outMs },
  };
};

export const timelineToRemotionProps = (timeline: TimelineData): RemotionTimelineProps => {
  const subtitleTracks = collectSubtitleTracks(timeline.tracks);
  const durationMs = Math.max(
    timeline.playbackRange.outMs - timeline.playbackRange.inMs,
    1000
  );
  return {
    durationInFrames: Math.ceil((durationMs / 1000) * 30),
    subtitleTracks,
  };
};

const collectSubtitleTracks = (
  tracks: TimelineTrack[]
): Array<{ startMs: number; endMs: number; text: string; speaker: string }> =>
  tracks
    .filter((track) => track.type === "subtitle")
    .flatMap((track) =>
      track.clips.map((clip) => ({
        startMs: clip.startMs,
        endMs: clip.startMs + clip.durationMs,
        text: clip.text ?? "",
        speaker: clip.style ?? "narrator",
      }))
    );
