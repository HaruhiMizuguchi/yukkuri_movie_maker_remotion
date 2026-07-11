import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readGitIgnoreLines = (): string[] =>
  readFileSync(".gitignore", "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

const gitLsFiles = (pathspec: string): string[] =>
  execFileSync("git", ["ls-files", pathspec], {
    cwd: process.cwd(),
    encoding: "utf-8",
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

describe("repository hygiene", () => {
  it("生成物とローカル設定をGit管理対象から外すignore規約を持つ", () => {
    const lines = readGitIgnoreLines();

    expect(lines).toEqual(
      expect.arrayContaining([
        "outputs/*",
        "!outputs/.gitkeep",
        "projects/*",
        "!projects/.gitkeep",
        "apps/api/projects/",
        "apps/worker/projects/",
        "logs/",
      ]),
    );
  });

  it("outputs配下は.gitkeep以外を追跡しない", () => {
    const trackedOutputs = gitLsFiles("outputs");

    expect(trackedOutputs).toEqual(["outputs/.gitkeep"]);
  });

  it("projects配下は.gitkeep以外の生成物を追跡しない", () => {
    const trackedProjects = gitLsFiles("projects");
    expect(trackedProjects).toEqual(["projects/.gitkeep"]);
  });
});
