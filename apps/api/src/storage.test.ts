import { describe, expect, it } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  createTemplate,
  listTemplates,
  listProjectAssets,
  readProjectOwner,
  readOrCreateTimeline,
  readProjectScript,
  readSettings,
  saveProjectAsset,
  saveProjectOwner,
  saveProjectScript,
  saveTimeline,
  writeSettings,
} from "./storage";

const createWorkspace = async () => {
  const root = path.join(process.cwd(), "outputs", "test_evidence", "task4", `storage-${Date.now()}`);
  await fs.mkdir(root, { recursive: true });
  return root;
};

describe("api storage", () => {
  it("台本・タイムライン・設定・テンプレートを保存して再読込できる", async () => {
    const workspaceRoot = await createWorkspace();

    await saveProjectScript(workspaceRoot, "project-1", {
      title: "テスト台本",
      theme: "検証",
      lines: [
        { speaker: "reimu", text: "こんにちは" },
        { speaker: "marisa", text: "解説を始めるぜ" },
      ],
    });

    const script = await readProjectScript(workspaceRoot, "project-1");
    expect(script?.lines.length).toBe(2);
    await saveProjectOwner(workspaceRoot, "project-1", "user-a");
    await expect(readProjectOwner(workspaceRoot, "project-1")).resolves.toBe("user-a");

    const timeline = await readOrCreateTimeline(workspaceRoot, "project-1", script!);
    const moved = {
      ...timeline,
      playbackRange: { inMs: 1000, outMs: 7000 },
    };
    await saveTimeline(workspaceRoot, "project-1", moved);
    const loadedTimeline = await readOrCreateTimeline(workspaceRoot, "project-1", script!);
    expect(loadedTimeline.playbackRange.inMs).toBe(1000);

    await writeSettings(workspaceRoot, {
      apiKeys: { google: "***" },
      outputPreset: { width: 1280, height: 720, fps: 30 },
    });
    const settings = await readSettings(workspaceRoot);
    expect(settings.outputPreset.width).toBe(1280);

    await saveProjectAsset(workspaceRoot, "project-1", {
      id: "asset-1",
      type: "image",
      name: "bg",
      relativePath: "input/assets/bg.png",
      createdAt: new Date().toISOString(),
    });
    const assets = await listProjectAssets(workspaceRoot, "project-1");
    expect(assets).toHaveLength(1);

    await createTemplate(workspaceRoot, {
      id: "tpl-1",
      name: "ニュース向け",
      description: "ニュース系テンプレ",
      scriptSeed: { theme: "ニュース", tone: "hard" },
      timelinePreset: loadedTimeline,
    });
    const templates = await listTemplates(workspaceRoot);
    expect(templates).toHaveLength(1);
  });
});
