import { describe, expect, it } from "vitest";
import { buildJobRequest, workflowSteps } from "./automationProfiles";

describe("automation profiles", () => {
  it("モードと手動スキップからジョブ作成リクエストを作る", () => {
    expect(buildJobRequest("full", [])).toEqual({ mode: "full", runMode: "resume" });
    expect(buildJobRequest("scriptOnly", [])).toEqual({
      mode: "scriptOnly",
      runMode: "resume",
    });
    expect(buildJobRequest("custom", ["tts_generation", "tts_generation"])).toEqual({
      mode: "custom",
      runMode: "resume",
      skipSteps: ["tts_generation"],
    });
    expect(workflowSteps).toContain("final_encoding");
  });
});
