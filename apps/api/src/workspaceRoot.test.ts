import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveApiWorkspaceRoot } from "./workspaceRoot";

describe("resolveApiWorkspaceRoot", () => {
  it("apps/api 配下のモジュールURLからリポジトリルートを解決する", () => {
    const moduleUrl = pathToFileURL(
      path.join(process.cwd(), "apps", "api", "src", "index.ts")
    ).href;

    expect(resolveApiWorkspaceRoot(moduleUrl)).toBe(process.cwd());
  });
});
