import { describe, expect, it } from "vitest";
import { parseMediaDurationMs } from "./mediaProbe";

describe("parseMediaDurationMs", () => {
  it("ffprobeの秒表記をミリ秒へ丸める", () => {
    expect(parseMediaDurationMs("14.229000\n")).toBe(14229);
  });

  it("不正なメディア長は受け入れない", () => {
    expect(() => parseMediaDurationMs("N/A")).toThrow(
      "メディアの再生時間を取得できませんでした。",
    );
  });
});
