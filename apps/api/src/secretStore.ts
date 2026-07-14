import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const SecretStoreSchema = z.object({
  googleApiKey: z.string().min(1).optional(),
});

type SecretStore = z.infer<typeof SecretStoreSchema>;

export type GoogleApiKeyStatus = {
  configured: boolean;
  source: "stored" | "environment" | null;
};

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

export const saveGoogleApiKey = async (
  workspaceRoot: string,
  apiKey: string,
): Promise<void> => {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("Google APIキーが空です");
  }
  const targetPath = getSecretStorePath(workspaceRoot);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  // 秘密情報は成果物・通常設定と分離し、可能な環境では所有者だけが読める権限にする。
  await fs.writeFile(
    targetPath,
    JSON.stringify({ googleApiKey: trimmed }, null, 2) + "\n",
    { encoding: "utf-8", mode: 0o600 },
  );
  await fs.chmod(targetPath, 0o600).catch(() => undefined);
};

export const resolveGoogleApiKey = async (
  workspaceRoot: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<string | undefined> => {
  const stored = await readSecretStore(workspaceRoot);
  return stored.googleApiKey?.trim() || env.GOOGLE_API_KEY?.trim() || undefined;
};

export const getGoogleApiKeyStatus = async (
  workspaceRoot: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<GoogleApiKeyStatus> => {
  const stored = await readSecretStore(workspaceRoot);
  if (stored.googleApiKey?.trim()) {
    return { configured: true, source: "stored" };
  }
  if (env.GOOGLE_API_KEY?.trim()) {
    return { configured: true, source: "environment" };
  }
  return { configured: false, source: null };
};

export const clearGoogleApiKey = async (
  workspaceRoot: string,
): Promise<void> => {
  try {
    await fs.unlink(getSecretStorePath(workspaceRoot));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};
