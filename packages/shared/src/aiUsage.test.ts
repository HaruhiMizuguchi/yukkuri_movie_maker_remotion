import { describe, expect, it } from "vitest";
import {
  createImageUsageRecord,
  createLlmUsageRecord,
  extractAiUsageRecords,
  summarizeAiUsage,
} from "./aiUsage";

describe("AI使用量と概算料金", () => {
  it("LLMの入出力トークンを公開単価から計算する", () => {
    const usage = createLlmUsageRecord({
      model: "gemini-3.5-flash",
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    });

    expect(usage.estimatedCostUsd).toBe(6);
    expect(usage.pricingKnown).toBe(true);
  });

  it("画像の生成枚数を1枚あたりの単価から計算する", () => {
    const usage = createImageUsageRecord({
      model: "imagen-4.0-generate-001",
      imageCount: 2,
    });

    expect(usage.estimatedCostUsd).toBe(0.08);
  });

  it("現行の画像モデルは1K画像と入力トークンの料金を計算する", () => {
    const usage = createImageUsageRecord({
      model: "gemini-3.1-flash-lite-image",
      imageCount: 1,
      inputTokens: 1_000,
    });

    expect(usage.estimatedCostUsd).toBeCloseTo(0.03385, 6);
  });

  it("プロジェクト全体とモデル別の使用量を集計する", () => {
    const records = [
      createLlmUsageRecord({
        model: "gemini-2.5-flash",
        inputTokens: 100_000,
        outputTokens: 20_000,
      }),
      createImageUsageRecord({
        model: "gemini-2.5-flash-image",
        imageCount: 3,
      }),
    ];

    const summary = summarizeAiUsage(records, 160);

    expect(summary.requestCount).toBe(2);
    expect(summary.inputTokens).toBe(100_000);
    expect(summary.outputTokens).toBe(20_000);
    expect(summary.imageCount).toBe(3);
    expect(summary.estimatedCostUsd).toBeCloseTo(0.197, 6);
    expect(summary.estimatedCostJpy).toBeCloseTo(31.52, 2);
    expect(summary.byModel).toHaveLength(2);
  });

  it("未登録モデルは0円扱いにせず料金不明として数える", () => {
    const usage = createLlmUsageRecord({
      model: "future-model",
      inputTokens: 100,
      outputTokens: 50,
    });
    const summary = summarizeAiUsage([usage]);

    expect(usage.estimatedCostUsd).toBeNull();
    expect(summary.unpricedRequestCount).toBe(1);
  });

  it("OpenAIとClaudeの実トークン数を各社の公式単価で計算する", () => {
    const openai = createLlmUsageRecord({
      model: "gpt-5.6-terra",
      inputTokens: 1_000_000,
      outputTokens: 100_000,
    });
    const claude = createLlmUsageRecord({
      model: "claude-sonnet-5",
      inputTokens: 1_000_000,
      outputTokens: 100_000,
    });

    expect(openai).toMatchObject({ provider: "openai", estimatedCostUsd: 4 });
    expect(claude).toMatchObject({
      provider: "anthropic",
      estimatedCostUsd: 3,
    });
    const summary = summarizeAiUsage([openai, claude]);
    expect(summary.pricingSources).toHaveLength(2);
    expect(summary.pricingSources).toContain(
      "https://developers.openai.com/api/docs/pricing",
    );
    expect(summary.pricingSources).toContain(
      "https://platform.claude.com/docs/en/about-claude/pricing",
    );
  });

  it("OpenAI画像モデルの16:9中品質の枚数料金を計算する", () => {
    const usage = createImageUsageRecord({
      model: "gpt-image-2",
      imageCount: 2,
    });

    expect(usage.provider).toBe("openai");
    expect(usage.estimatedCostUsd).toBe(0.082);
  });

  it("WorkflowStepのoutputJsonから有効な使用量だけを抽出する", () => {
    const usage = createLlmUsageRecord({
      model: "gemini-2.5-flash-lite",
      inputTokens: 1_000,
      outputTokens: 200,
    });

    expect(extractAiUsageRecords({ aiUsage: usage })).toEqual([usage]);
    expect(
      extractAiUsageRecords({ aiUsage: [usage, { broken: true }] }),
    ).toEqual([usage]);
    expect(extractAiUsageRecords(null)).toEqual([]);
  });
});
