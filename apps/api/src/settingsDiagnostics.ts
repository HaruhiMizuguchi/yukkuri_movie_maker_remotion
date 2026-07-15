import type { AiProvider } from "@ymm/shared";
import type { ApiKeyStatus, ResolvedApiKeys } from "./secretStore";

type ApiConnectionDiagnostic = ApiKeyStatus & {
  reachable: boolean;
  status?: number;
  error?: string;
};

export type SettingsDiagnostics = {
  googleApiKey: ApiConnectionDiagnostic;
  openaiApiKey: ApiConnectionDiagnostic;
  anthropicApiKey: ApiConnectionDiagnostic;
  aivisSpeech: {
    configured: boolean;
    reachable: boolean;
    status?: number;
    error?: string;
  };
};

type DiagnosticEnvironment =
  | NodeJS.ProcessEnv
  | Record<string, string | undefined>;

const providers: AiProvider[] = ["google", "openai", "anthropic"];

export const buildSettingsDiagnostics = async ({
  env = process.env,
  fetchFn = fetch,
  apiKeys = {
    google: env.GOOGLE_API_KEY,
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
  },
  apiKeySources = {
    google: apiKeys.google ? "environment" : null,
    openai: apiKeys.openai ? "environment" : null,
    anthropic: apiKeys.anthropic ? "environment" : null,
  },
}: {
  env?: DiagnosticEnvironment;
  fetchFn?: typeof fetch;
  apiKeys?: ResolvedApiKeys;
  apiKeySources?: Record<AiProvider, ApiKeyStatus["source"]>;
} = {}): Promise<SettingsDiagnostics> => {
  const aivisBaseUrl = env.AIVIS_SPEECH_BASE_URL?.trim();
  const aiDiagnostics = await Promise.all(
    providers.map((provider) =>
      checkAiProvider({
        provider,
        apiKey: apiKeys[provider]?.trim(),
        source: apiKeySources[provider],
        fetchFn,
      }),
    ),
  );
  const aivisSpeech = await checkAivisSpeech({ aivisBaseUrl, fetchFn });
  return {
    googleApiKey: aiDiagnostics[0],
    openaiApiKey: aiDiagnostics[1],
    anthropicApiKey: aiDiagnostics[2],
    aivisSpeech,
  };
};

const checkAiProvider = async ({
  provider,
  apiKey,
  source,
  fetchFn,
}: {
  provider: AiProvider;
  apiKey?: string;
  source: ApiKeyStatus["source"];
  fetchFn: typeof fetch;
}): Promise<ApiConnectionDiagnostic> => {
  if (!apiKey) {
    return { configured: false, reachable: false, source: null };
  }
  const request: { url: string; headers: Record<string, string> } =
    provider === "google"
      ? {
          url: "https://generativelanguage.googleapis.com/v1beta/models",
          headers: { "x-goog-api-key": apiKey },
        }
      : provider === "openai"
        ? {
            url: "https://api.openai.com/v1/models",
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        : {
            url: "https://api.anthropic.com/v1/models",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
          };
  try {
    const response = await fetchFn(request.url, {
      headers: request.headers,
      signal: AbortSignal.timeout(5_000),
    });
    return {
      configured: true,
      reachable: response.ok,
      source,
      status: response.status,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const checkAivisSpeech = async ({
  aivisBaseUrl,
  fetchFn,
}: {
  aivisBaseUrl?: string;
  fetchFn: typeof fetch;
}): Promise<SettingsDiagnostics["aivisSpeech"]> => {
  if (!aivisBaseUrl) {
    return { configured: false, reachable: false };
  }
  try {
    const response = await fetchFn(
      `${aivisBaseUrl.replace(/\/$/, "")}/speakers`,
      { signal: AbortSignal.timeout(1_500) },
    );
    return {
      configured: true,
      reachable: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
