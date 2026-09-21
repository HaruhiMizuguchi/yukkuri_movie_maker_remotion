export type TimelineShortcutAction =
  | { type: "toggle-playback" }
  | { type: "split-clip" }
  | { type: "delete-clip" }
  | { type: "nudge-playhead"; deltaMs: number }
  | { type: "undo" }
  | { type: "redo" };

export type TimelineShortcutInput = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isEditingField?: boolean;
};

export const resolveTimelineShortcut = (
  input: TimelineShortcutInput,
): TimelineShortcutAction | null => {
  if (input.isEditingField || input.altKey) {
    return null;
  }

  const key = input.key.toLowerCase();
  const hasPrimaryModifier = Boolean(input.ctrlKey || input.metaKey);
  if (hasPrimaryModifier) {
    if (key === "z") {
      return { type: input.shiftKey ? "redo" : "undo" };
    }
    if (key === "y") {
      return { type: "redo" };
    }
    return null;
  }

  if (input.key === " ") {
    return { type: "toggle-playback" };
  }
  if (key === "s") {
    return { type: "split-clip" };
  }
  if (input.key === "Delete" || input.key === "Backspace") {
    return { type: "delete-clip" };
  }
  if (input.key === "ArrowLeft" || input.key === "ArrowRight") {
    const direction = input.key === "ArrowLeft" ? -1 : 1;
    return {
      type: "nudge-playhead",
      deltaMs: direction * (input.shiftKey ? 1_000 : 100),
    };
  }
  return null;
};

const timelineTrackTypeLabels: Record<string, string> = {
  video: "映像",
  audio: "音声",
  bgm: "BGM",
  subtitle: "字幕",
  image: "画像",
  character: "立ち絵",
};

export const getTimelineTrackTypeLabel = (type: string): string =>
  timelineTrackTypeLabels[type] ?? "その他";
