import type { ScriptData } from "./apiTypes";

export type ScriptSummary = {
  lineCount: number;
  nonEmptyLineCount: number;
  characterCount: number;
  emptyLineIndexes: number[];
  speakerCounts: Record<string, number>;
  estimatedDurationSeconds: number;
};

export const countScriptCharacters = (text: string): number =>
  Array.from(text.replace(/\s/g, "")).length;

export const summarizeScript = (script: ScriptData): ScriptSummary => {
  const emptyLineIndexes: number[] = [];
  const speakerCounts: Record<string, number> = {};
  let characterCount = 0;
  let nonEmptyLineCount = 0;

  script.lines.forEach((line, index) => {
    const trimmedText = line.text.trim();
    if (!trimmedText) {
      emptyLineIndexes.push(index);
      return;
    }
    nonEmptyLineCount += 1;
    characterCount += countScriptCharacters(trimmedText);
    speakerCounts[line.speaker] = (speakerCounts[line.speaker] ?? 0) + 1;
  });

  return {
    lineCount: script.lines.length,
    nonEmptyLineCount,
    characterCount,
    emptyLineIndexes,
    speakerCounts,
    estimatedDurationSeconds:
      characterCount === 0
        ? 0
        : Math.max(
            1,
            Math.ceil(characterCount / 4.2 + nonEmptyLineCount * 0.45),
          ),
  };
};

export const formatEstimatedScriptDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  if (safeSeconds < 60) {
    return `約${safeSeconds}秒`;
  }
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return remainder > 0 ? `約${minutes}分${remainder}秒` : `約${minutes}分`;
};

export const getScriptValidationMessages = (script: ScriptData): string[] => {
  const messages: string[] = [];
  if (!script.title?.trim()) {
    messages.push("動画タイトルを入力してください");
  }
  if (!script.theme?.trim()) {
    messages.push("動画のテーマを入力してください");
  }
  if (script.lines.length === 0) {
    messages.push("セリフを1行以上追加してください");
    return messages;
  }
  const emptyLines = summarizeScript(script).emptyLineIndexes;
  if (emptyLines.length > 0) {
    messages.push(
      `空のセリフを入力するか削除してください（${emptyLines.map((index) => `${index + 1}行目`).join("・")}）`,
    );
  }
  return messages;
};

export const duplicateScriptLine = (
  script: ScriptData,
  index: number,
): ScriptData => {
  const source = script.lines[index];
  if (!source) return script;
  const lines = [...script.lines];
  lines.splice(index + 1, 0, { ...source });
  return { ...script, lines };
};

export const moveScriptLine = (
  script: ScriptData,
  fromIndex: number,
  toIndex: number,
): ScriptData => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= script.lines.length ||
    toIndex >= script.lines.length ||
    fromIndex === toIndex
  ) {
    return script;
  }
  const lines = [...script.lines];
  const [moved] = lines.splice(fromIndex, 1);
  if (!moved) return script;
  lines.splice(toIndex, 0, moved);
  return { ...script, lines };
};

export const deleteScriptLine = (
  script: ScriptData,
  index: number,
): ScriptData => {
  if (script.lines.length <= 1 || !script.lines[index]) return script;
  return {
    ...script,
    lines: script.lines.filter((_, lineIndex) => lineIndex !== index),
  };
};
