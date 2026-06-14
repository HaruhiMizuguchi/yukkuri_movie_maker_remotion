import path from "node:path";
import { fileURLToPath } from "node:url";

export const resolveApiWorkspaceRoot = (moduleUrl: string): string =>
  path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..", "..", "..");
