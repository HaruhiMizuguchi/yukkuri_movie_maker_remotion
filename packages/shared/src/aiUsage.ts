import { z } from "zod";

export const AI_PRICING_VERSION = "2026-07-15";
export const AI_PRICING_SOURCE =
  "https://ai.google.dev/gemini-api/docs/pricing";
export const DEFAULT_USD_JPY_RATE = 160;

const AiUsageKindSchema = z.enum(["llm", "image"]);

export const AiUsageRecordSchema = z.object({
  provider: z.literal("google"),
  kind: AiUsageKindSchema,
  model: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  imageCount: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
  pricingKnown: z.boolean(),
  pricingVersion: z.string(),
  pricingSource: z.string().url(),
});

export type AiUsageRecord = z.infer<typeof AiUsageRecordSchema>;

export type AiUsageSummary = {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  imageCount: number;
  estimatedCostUsd: number;
  estimatedCostJpy: number;
  unpricedRequestCount: number;
  usdJpyRate: number;
  pricingVersion: string;
  pricingSource: string;
  byModel: Array<{
    provider: AiUsageRecord["provider"];
    kind: AiUsageRecord["kind"];
    model: string;
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    imageCount: number;
    estimatedCostUsd: number;
    unpricedRequestCount: number;
  }>;
};

type ModelPricing = {
  inputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  imageUsdEach?: number;
};

// 料金はGoogleの標準（非バッチ）単価。実際の請求は無料枠や契約条件で変わる。
const GOOGLE_MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  "gemini-3.5-flash": {
    inputUsdPerMillion: 1.5,
    outputUsdPerMillion: 9,
  },
  "gemini-3-flash-preview": {
    inputUsdPerMillion: 0.5,
    outputUsdPerMillion: 3,
  },
  "gemini-3.1-flash-lite": {
    inputUsdPerMillion: 0.25,
    outputUsdPerMillion: 1.5,
  },
  "gemini-2.5-pro": {
    inputUsdPerMillion: 1.25,
    outputUsdPerMillion: 10,
  },
  "gemini-2.5-flash": {
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
  },
  "gemini-2.5-flash-lite": {
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
  },
  "gemini-2.5-flash-image": {
    inputUsdPerMillion: 0.3,
    imageUsdEach: 0.039,
  },
  "gemini-3.1-flash-lite-image": {
    inputUsdPerMillion: 0.25,
    outputUsdPerMillion: 1.5,
    imageUsdEach: 0.0336,
  },
  "gemini-3.1-flash-image": {
    inputUsdPerMillion: 0.5,
    outputUsdPerMillion: 3,
    imageUsdEach: 0.067,
  },
  "imagen-4.0-fast-generate-001": { imageUsdEach: 0.02 },
  "imagen-4.0-generate-001": { imageUsdEach: 0.04 },
  "imagen-4.0-ultra-generate-001": { imageUsdEach: 0.06 },
};

const roundMoney = (value: number): number => Number(value.toFixed(8));

const createUsageRecord = (input: {
  kind: AiUsageRecord["kind"];
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
}): AiUsageRecord => {
  const inputTokens = Math.max(0, Math.trunc(input.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.trunc(input.outputTokens ?? 0));
  const imageCount = Math.max(0, Math.trunc(input.imageCount ?? 0));
  const pricing = GOOGLE_MODEL_PRICING[input.model];
  const pricingKnown = pricing !== undefined;
  const estimatedCostUsd = pricing
    ? roundMoney(
        (inputTokens / 1_000_000) * (pricing.inputUsdPerMillion ?? 0) +
          (outputTokens / 1_000_000) * (pricing.outputUsdPerMillion ?? 0) +
          imageCount * (pricing.imageUsdEach ?? 0),
      )
    : null;

  return {
    provider: "google",
    kind: input.kind,
    model: input.model,
    inputTokens,
    outputTokens,
    imageCount,
    estimatedCostUsd,
    pricingKnown,
    pricingVersion: AI_PRICING_VERSION,
    pricingSource: AI_PRICING_SOURCE,
  };
};

export const createLlmUsageRecord = (input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): AiUsageRecord => createUsageRecord({ ...input, kind: "llm" });

export const createImageUsageRecord = (input: {
  model: string;
  imageCount: number;
  inputTokens?: number;
  outputTokens?: number;
}): AiUsageRecord => createUsageRecord({ ...input, kind: "image" });

export const extractAiUsageRecords = (outputJson: unknown): AiUsageRecord[] => {
  if (!outputJson || typeof outputJson !== "object") {
    return [];
  }
  const aiUsage = (outputJson as { aiUsage?: unknown }).aiUsage;
  const candidates = Array.isArray(aiUsage) ? aiUsage : [aiUsage];
  return candidates.flatMap((candidate) => {
    const parsed = AiUsageRecordSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
};

export const summarizeAiUsage = (
  records: readonly AiUsageRecord[],
  usdJpyRate = DEFAULT_USD_JPY_RATE,
): AiUsageSummary => {
  const byModel = new Map<string, AiUsageSummary["byModel"][number]>();
  let inputTokens = 0;
  let outputTokens = 0;
  let imageCount = 0;
  let estimatedCostUsd = 0;
  let unpricedRequestCount = 0;

  for (const record of records) {
    inputTokens += record.inputTokens;
    outputTokens += record.outputTokens;
    imageCount += record.imageCount;
    estimatedCostUsd += record.estimatedCostUsd ?? 0;
    unpricedRequestCount += record.pricingKnown ? 0 : 1;

    const key = `${record.provider}:${record.kind}:${record.model}`;
    const current = byModel.get(key) ?? {
      provider: record.provider,
      kind: record.kind,
      model: record.model,
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      imageCount: 0,
      estimatedCostUsd: 0,
      unpricedRequestCount: 0,
    };
    current.requestCount += 1;
    current.inputTokens += record.inputTokens;
    current.outputTokens += record.outputTokens;
    current.imageCount += record.imageCount;
    current.estimatedCostUsd = roundMoney(
      current.estimatedCostUsd + (record.estimatedCostUsd ?? 0),
    );
    current.unpricedRequestCount += record.pricingKnown ? 0 : 1;
    byModel.set(key, current);
  }

  const roundedUsd = roundMoney(estimatedCostUsd);
  return {
    requestCount: records.length,
    inputTokens,
    outputTokens,
    imageCount,
    estimatedCostUsd: roundedUsd,
    estimatedCostJpy: roundMoney(roundedUsd * usdJpyRate),
    unpricedRequestCount,
    usdJpyRate,
    pricingVersion: AI_PRICING_VERSION,
    pricingSource: AI_PRICING_SOURCE,
    byModel: [...byModel.values()],
  };
};
