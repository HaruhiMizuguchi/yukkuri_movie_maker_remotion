export const DEV_WORKSPACE_COMMANDS: string[];
export function createLogTimestamp(date?: Date): string;
export function buildDevLogPaths(
  baseDirectory?: string,
  date?: Date
): {
  logDirectory: string;
  runLogPath: string;
  latestLogPath: string;
};
export function buildConcurrentDevCommand(): string;
