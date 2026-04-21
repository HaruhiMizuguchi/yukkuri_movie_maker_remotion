import type { Script } from "@ymm/shared";

import type { ScriptTimestamp } from "./task3Quality";

export type CharacterExpression = "normal" | "happy" | "serious" | "surprised";

export type CharacterMouthCue = {
  startMs: number;
  endMs: number;
  openness: number;
  speaker: string;
};

export type CharacterBlinkCue = {
  startMs: number;
  endMs: number;
};

export type CharacterExpressionCue = {
  startMs: number;
  endMs: number;
  expression: CharacterExpression;
  speaker: string;
};

export type CharacterPerformancePlan = {
  mouthCues: CharacterMouthCue[];
  blinkCues: CharacterBlinkCue[];
  expressionCues: CharacterExpressionCue[];
};

export const createCharacterPerformancePlan = ({
  script,
  timestamps,
}: {
  script: Script;
  timestamps: ScriptTimestamp[];
}): CharacterPerformancePlan => {
  const mouthCues = timestamps.flatMap((timestamp) => createMouthCues(timestamp));
  const blinkCues = createBlinkCues(timestamps.at(-1)?.endMs ?? 0);
  const expressionCues = timestamps.map((timestamp) => {
    const line = script.lines[timestamp.index];
    return {
      startMs: timestamp.startMs,
      endMs: timestamp.endMs,
      expression: inferExpression(line?.text ?? timestamp.text, line?.emotion),
      speaker: line?.speaker ?? timestamp.speaker,
    };
  });

  return {
    mouthCues,
    blinkCues,
    expressionCues,
  };
};

const createMouthCues = (timestamp: ScriptTimestamp): CharacterMouthCue[] => {
  const cues: CharacterMouthCue[] = [];
  const pulseMs = 140;
  const gapMs = 70;
  let cursor = timestamp.startMs;
  let pulseIndex = 0;

  while (cursor < timestamp.endMs) {
    const endMs = Math.min(timestamp.endMs, cursor + pulseMs);
    cues.push({
      startMs: cursor,
      endMs,
      openness: [0.35, 0.72, 0.5, 0.85][pulseIndex % 4] ?? 0.5,
      speaker: timestamp.speaker,
    });
    cursor += pulseMs + gapMs;
    pulseIndex += 1;
  }

  return cues;
};

const createBlinkCues = (totalDurationMs: number): CharacterBlinkCue[] => {
  const cues: CharacterBlinkCue[] = [];
  for (let cursor = 1900; cursor < totalDurationMs; cursor += 2800) {
    cues.push({
      startMs: cursor,
      endMs: Math.min(totalDurationMs, cursor + 120),
    });
  }
  return cues;
};

const inferExpression = (
  text: string,
  emotion: string | undefined
): CharacterExpression => {
  const normalizedEmotion = emotion?.toLowerCase() ?? "";
  if (normalizedEmotion.includes("serious")) {
    return "serious";
  }
  if (normalizedEmotion.includes("happy")) {
    return "happy";
  }
  if (normalizedEmotion.includes("surprised")) {
    return "surprised";
  }

  if (text.includes("！？") || text.includes("?!") || text.includes("!?") || text.includes("?")) {
    return "surprised";
  }
  if (text.includes("重要") || text.includes("注意") || text.includes("結論")) {
    return "serious";
  }
  if (text.includes("！")) {
    return "happy";
  }
  return "normal";
};
