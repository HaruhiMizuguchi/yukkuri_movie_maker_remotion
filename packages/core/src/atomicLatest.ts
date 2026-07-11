import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const syncLatestAtomically = async ({
  runDir,
  latestDir,
}: {
  runDir: string;
  latestDir: string;
}): Promise<void> => {
  const parent = path.dirname(latestDir);
  const token = randomUUID();
  const stagingDir = path.join(parent, `.latest-staging-${token}`);
  const backupDir = path.join(parent, `.latest-backup-${token}`);
  await fs.cp(runDir, stagingDir, { recursive: true });
  let previousMoved = false;
  try {
    try {
      await renameWithRetry(latestDir, backupDir);
      previousMoved = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await renameWithRetry(stagingDir, latestDir);
    if (previousMoved) await fs.rm(backupDir, { recursive: true, force: true });
    await pruneOldRunDirectories(parent, 5);
  } catch (error) {
    if (previousMoved) {
      try {
        await renameWithRetry(backupDir, latestDir);
      } catch {
        // 復旧に失敗した場合も元の例外を維持し、ログから調査できるようにする。
      }
    }
    throw error;
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
    await fs.rm(backupDir, { recursive: true, force: true });
  }
};

const renameWithRetry = async (
  source: string,
  destination: string,
): Promise<void> => {
  const retryableCodes = new Set(["EPERM", "EBUSY", "EACCES"]);
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(source, destination);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!retryableCodes.has(code ?? "") || attempt >= 5) throw error;
      // Windows Defenderや動画プロセスが解放するまで短時間だけ待つ。
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
    }
  }
};

const pruneOldRunDirectories = async (
  stepRoot: string,
  keep: number,
): Promise<void> => {
  const entries = await fs.readdir(stepRoot, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("run-"))
      .map(async (entry) => {
        const entryPath = path.join(stepRoot, entry.name);
        return { entryPath, modifiedAt: (await fs.stat(entryPath)).mtimeMs };
      }),
  );
  const obsolete = candidates
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .slice(Math.max(1, keep));
  for (const candidate of obsolete) {
    const resolved = path.resolve(candidate.entryPath);
    if (path.dirname(resolved) !== path.resolve(stepRoot)) {
      throw new Error("Run directory cleanup escaped the step root.");
    }
    await fs.rm(resolved, { recursive: true, force: true });
  }
};
