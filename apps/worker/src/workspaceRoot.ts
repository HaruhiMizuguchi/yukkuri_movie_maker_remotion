import path from "node:path";
import { fileURLToPath } from "node:url";

export const resolveWorkerWorkspaceRoot = (moduleUrl: string): string =>
  path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..", "..", "..");

export const resolveWorkerOutputRoot = (
  moduleUrl: string,
  configuredOutputRoot?: string
): string => configuredOutputRoot ?? resolveWorkerWorkspaceRoot(moduleUrl);
