import { describe, expect, it } from "vitest";

import { parseWorkflowPayload } from "./workflowPayload";

describe("parseWorkflowPayload", () => {
  it("jobIdのみならrunOptionsは空で返す", () => {
    const result = parseWorkflowPayload({ jobId: "11111111-1111-1111-1111-111111111111" });

    expect(result).toEqual({
      jobId: "11111111-1111-1111-1111-111111111111",
      runOptions: {},
    });
  });

  it("runModeとskipStepsを読み取る", () => {
    const result = parseWorkflowPayload({
      jobId: "22222222-2222-2222-2222-222222222222",
      runMode: "full",
      skipSteps: ["tts_generation", "subtitle_generation"],
    });

    expect(result).toEqual({
      jobId: "22222222-2222-2222-2222-222222222222",
      runOptions: {
        mode: "full",
        skipSteps: ["tts_generation", "subtitle_generation"],
      },
    });
  });

  it("未定義のステップは弾く", () => {
    expect(() =>
      parseWorkflowPayload({
        jobId: "33333333-3333-3333-3333-333333333333",
        skipSteps: ["invalid_step"],
      })
    ).toThrow();
  });
});
