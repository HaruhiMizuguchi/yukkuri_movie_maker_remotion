export type SettingsDiagnostics = {
  googleApiKey: {
    configured: boolean;
    reachable: boolean;
    source: "stored" | "environment" | null;
    status?: number;
    error?: string;
  };
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

export const buildSettingsDiagnostics = async ({
  env = process.env,
  fetchFn = fetch,
  googleApiKey = env.GOOGLE_API_KEY,
  googleApiKeySource = googleApiKey ? "environment" : null,
}: {
  env?: DiagnosticEnvironment;
  fetchFn?: typeof fetch;
  googleApiKey?: string;
  googleApiKeySource?: "stored" | "environment" | null;
} = {}): Promise<SettingsDiagnostics> => {
  const aivisBaseUrl = env.AIVIS_SPEECH_BASE_URL?.trim();
  const trimmedGoogleApiKey = googleApiKey?.trim();

  const googlePromise = checkGoogleApi({
    apiKey: trimmedGoogleApiKey,
    source: googleApiKeySource,
    fetchFn,
  });
  const aivisPromise = checkAivisSpeech({ aivisBaseUrl, fetchFn });
  const [googleApiDiagnostics, aivisSpeech] = await Promise.all([
    googlePromise,
    aivisPromise,
  ]);
  return { googleApiKey: googleApiDiagnostics, aivisSpeech };
};

const checkGoogleApi = async ({
  apiKey,
  source,
  fetchFn,
}: {
  apiKey?: string;
  source: "stored" | "environment" | null;
  fetchFn: typeof fetch;
}): Promise<SettingsDiagnostics["googleApiKey"]> => {
  if (!apiKey) {
    return { configured: false, reachable: false, source: null };
  }
  try {
    const response = await fetchFn(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(5_000),
      },
    );
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
      {
        signal: AbortSignal.timeout(1_500),
      },
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
