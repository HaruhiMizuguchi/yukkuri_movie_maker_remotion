export type SettingsDiagnostics = {
  googleApiKey: { configured: boolean };
  aivisSpeech: { configured: boolean; reachable: boolean; status?: number; error?: string };
};

export const buildSettingsDiagnostics = async ({
  env = process.env,
  fetchFn = fetch,
}: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchFn?: typeof fetch;
} = {}): Promise<SettingsDiagnostics> => {
  const aivisBaseUrl = env.AIVIS_SPEECH_BASE_URL?.trim();
  const diagnostics: SettingsDiagnostics = {
    googleApiKey: { configured: Boolean(env.GOOGLE_API_KEY?.trim()) },
    aivisSpeech: { configured: Boolean(aivisBaseUrl), reachable: false },
  };

  if (!aivisBaseUrl) {
    return diagnostics;
  }

  let timeout: NodeJS.Timeout | null = null;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetchFn(`${aivisBaseUrl.replace(/\/$/, "")}/speakers`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    diagnostics.aivisSpeech = {
      configured: true,
      reachable: response.ok,
      status: response.status,
    };
  } catch (error) {
    diagnostics.aivisSpeech = {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  return diagnostics;
};
