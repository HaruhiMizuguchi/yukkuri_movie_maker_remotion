import { describe, expect, it } from "vitest";
import type { ScriptData } from "./apiTypes";
import {
  deleteScriptLine,
  duplicateScriptLine,
  formatEstimatedScriptDuration,
  getScriptValidationMessages,
  moveScriptLine,
  summarizeScript,
} from "./scriptEditor";

const createScript = (): ScriptData => ({
  title: "AIニュース解説",
  theme: "生成AI",
  lines: [
    { speaker: "reimu", text: "今日は AI です。" },
    { speaker: "marisa", text: "よろしく。" },
  ],
});

describe("summarizeScript", () => {
  it("行数・文字数・話者バランス・読み上げ時間を集計する", () => {
    const summary = summarizeScript(createScript());

    expect(summary.lineCount).toBe(2);
    expect(summary.nonEmptyLineCount).toBe(2);
    expect(summary.characterCount).toBe(13);
    expect(summary.emptyLineIndexes).toEqual([]);
    expect(summary.speakerCounts).toEqual({ reimu: 1, marisa: 1 });
    expect(summary.estimatedDurationSeconds).toBeGreaterThan(0);
    expect(formatEstimatedScriptDuration(65)).toBe("約1分5秒");
  });
});

describe("getScriptValidationMessages", () => {
  it("保存前に不足しているタイトル・テーマ・空セリフを示す", () => {
    expect(
      getScriptValidationMessages({
        title: " ",
        theme: "",
        lines: [{ speaker: "reimu", text: "" }],
      }),
    ).toEqual([
      "動画タイトルを入力してください",
      "動画のテーマを入力してください",
      "空のセリフを入力するか削除してください（1行目）",
    ]);
    expect(getScriptValidationMessages(createScript())).toEqual([]);
  });
});

describe("台本行の編集", () => {
  it("複製・並べ替え・削除を元データを壊さず行える", () => {
    const source = createScript();
    const duplicated = duplicateScriptLine(source, 0);
    expect(duplicated.lines.map((line) => line.text)).toEqual([
      "今日は AI です。",
      "今日は AI です。",
      "よろしく。",
    ]);
    expect(source.lines).toHaveLength(2);

    const moved = moveScriptLine(duplicated, 2, 0);
    expect(moved.lines[0]?.text).toBe("よろしく。");
    expect(moved.lines).not.toBe(duplicated.lines);

    const deleted = deleteScriptLine(moved, 1);
    expect(deleted.lines).toHaveLength(2);
  });

  it("最後の1行は削除しない", () => {
    const source: ScriptData = {
      title: "タイトル",
      theme: "テーマ",
      lines: [{ speaker: "reimu", text: "残す" }],
    };
    expect(deleteScriptLine(source, 0)).toEqual(source);
  });
});
