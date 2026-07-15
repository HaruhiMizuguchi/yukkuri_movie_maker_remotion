import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { AiProvider } from "@ymm/shared";

const SecretStoreSchema = z.object({
  googleApiKey: z.string().min(1).optional(),
  openaiApiKey: z.string().min(1).optional(),
  anthropicApiKey: z.string().min(1).optional(),
});

type SecretStore = z.infer<typeof SecretStoreSchema>;
type DiagnosticEnvironment =
  | NodeJS.ProcessEnv
  | Record<string, string | undefined>;

export type ApiKeyStatus = {
  configured: boolean;
  source: "stored" | "environment" | null;
};

export type ApiKeyStatuses = Record<AiProvider, ApiKeyStatus>;
export type GoogleApiKeyStatus = ApiKeyStatus;
export type ResolvedApiKeys = Record<AiProvider, string | undefined>;

const secretFieldByProvider: Record<AiProvider, keyof SecretStore> = {
  google: "googleApiKey",
  openai: "openaiApiKey",
  anthropic: "anthropicApiKey",
};

const environmentFieldByProvider: Record<AiProvider, string> = {
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

const providers: AiProvider[] = ["google", "openai", "anthropic"];

const getSecretStorePath = (workspaceRoot: string): string =>
  path.join(workspaceRoot, "outputs", "system", "secrets.json");

const readSecretStore = async (workspaceRoot: string): Promise<SecretStore> => {
  try {
    const raw = await fs.readFile(getSecretStorePath(workspaceRoot), "utf-8");
    return SecretStoreSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
};

const writeSecretStore = async (
  workspaceRoot: string,
  store: SecretStore,
): Promise<void> => {
  const targetPath = getSecretStorePath(workspaceRoot);
  if (Object.values(store).every((value) => !value?.trim())) {
    await fs.unlink(targetPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return;
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  // 秘密情報は成果物・通常設定と分離し、可能な環境では所有者だけが読める権限にする。
  await fs.writeFile(targetPath, JSON.stringify(store, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });
  await fs.chmod(targetPath, 0o600).catch(() => undefined);
};

export const saveApiKey = async (
  workspaceRoot: string,
  provider: AiProvider,
  apiKey: string,
): Promise<void> => {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error(`${provider} APIキーが空です`);
  }
  const store = await readSecretStore(workspaceRoot);
  store[secretFieldByProvider[provider]] = trimmed;
  await writeSecretStore(workspaceRoot, store);
};

export const resolveApiKeys = async (
  workspaceRoot: string,
  env: DiagnosticEnvironment = process.env,
): Promise<ResolvedApiKeys> => {
  const store = await readSecretStore(workspaceRoot);
  return Object.fromEntries(
    providers.map((provider) => [
      provider,
      store[secretFieldByProvider[provider]]?.trim() ||
        env[environmentFieldByProvider[provider]]?.trim() ||
        undefined,
    ]),
  ) as ResolvedApiKeys;
};

export const getApiKeyStatuses = async (
  workspaceRoot: string,
  env: DiagnosticEnvironment = process.env,
): Promise<ApiKeyStatuses> => {
  const store = await readSecretStore(workspaceRoot);
  return Object.fromEntries(
    providers.map((provider) => {
      if (store[secretFieldByProvider[provider]]?.trim()) {
        return [provider, { configured: true, source: "stored" }];
      }
      if (env[environmentFieldByProvider[provider]]?.trim()) {
        return [provider, { configured: true, source: "environment" }];
      }
      return [provider, { configured: false, source: null }];
    }),
  ) as ApiKeyStatuses;
};

export const clearApiKey = async (
  workspaceRoot: string,
  provider: AiProvider,
): Promise<void> => {
  const store = await readSecretStore(workspaceRoot);
  delete store[secretFieldByProvider[provider]];
  await writeSecretStore(workspaceRoot, store);
};

// 既存呼び出しとの互換性を保ちつつ、実体は共通ストアへ集約する。
export const saveGoogleApiKey = (workspaceRoot: string, apiKey: string) =>
  saveApiKey(workspaceRoot, "google", apiKey);

export const resolveGoogleApiKey = async (
  workspaceRoot: string,
  env: DiagnosticEnvironment = process.env,
): Promise<string | undefined> =>
  (await resolveApiKeys(workspaceRoot, env)).google;

export const getGoogleApiKeyStatus = async (
  workspaceRoot: string,
  env: DiagnosticEnvironment = process.env,
): Promise<GoogleApiKeyStatus> =>
  (await getApiKeyStatuses(workspaceRoot, env)).google;

export const clearGoogleApiKey = (workspaceRoot: string) =>
  clearApiKey(workspaceRoot, "google");
