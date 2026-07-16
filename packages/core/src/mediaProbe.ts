import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const parseMediaDurationMs = (stdout: string): number => {
  const durationSec = Number(stdout.trim());
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("メディアの再生時間を取得できませんでした。");
  }
  return Math.max(1, Math.round(durationSec * 1000));
};

export const probeMediaDurationMs = async (targetPath: string) => {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      targetPath,
    ],
    { windowsHide: true, timeout: 30_000 },
  );
  return parseMediaDurationMs(stdout);
};
