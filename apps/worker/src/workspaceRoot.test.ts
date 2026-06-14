import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveWorkerOutputRoot, resolveWorkerWorkspaceRoot } from "./workspaceRoot";

describe("resolveWorkerWorkspaceRoot", () => {
  it("apps/worker 配下のモジュールURLからリポジトリルートを解決する", () => {
    const moduleUrl = pathToFileURL(
      path.join(process.cwd(), "apps", "worker", "src", "index.ts")
    ).href;

    expect(resolveWorkerWorkspaceRoot(moduleUrl)).toBe(process.cwd());
  });

  it("出力先未指定時はリポジトリルートを使う", () => {
    const moduleUrl = pathToFileURL(
      path.join(process.cwd(), "apps", "worker", "src", "index.ts")
    ).href;

    expect(resolveWorkerOutputRoot(moduleUrl)).toBe(process.cwd());
  });

  it("出力先指定があればそちらを優先する", () => {
    const moduleUrl = pathToFileURL(
      path.join(process.cwd(), "apps", "worker", "src", "index.ts")
    ).href;
    const configuredOutputRoot = path.join(process.cwd(), "outputs", "custom");

    expect(resolveWorkerOutputRoot(moduleUrl, configuredOutputRoot)).toBe(configuredOutputRoot);
  });
});
