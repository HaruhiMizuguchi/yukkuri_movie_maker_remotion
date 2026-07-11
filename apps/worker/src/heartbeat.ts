import { promises as fs } from "node:fs";
import path from "node:path";

export const writeWorkerHeartbeat = async (
  workspaceRoot: string,
): Promise<void> => {
  const targetPath = path.join(
    workspaceRoot,
    "outputs",
    "system",
    "worker-heartbeat.json",
  );
  const temporaryPath = `${targetPath}.tmp`;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`,
    "utf-8",
  );
  await fs.rename(temporaryPath, targetPath);
};

export const startWorkerHeartbeat = (
  workspaceRoot: string,
  intervalMs = 5_000,
): { stop: () => void } => {
  void writeWorkerHeartbeat(workspaceRoot);
  const timer = setInterval(
    () => void writeWorkerHeartbeat(workspaceRoot),
    intervalMs,
  );
  timer.unref();
  return { stop: () => clearInterval(timer) };
};
