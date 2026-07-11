import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeWorkflowStepFingerprint,
  hasValidWorkflowCache,
  writeWorkflowCacheManifest,
} from "./workflowCache";

describe("workflow cache", () => {
  it("入力内容が同じ場合だけcache hitにする", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ymm-cache-"));
    const inputPath = path.join(projectRoot, "input", "manual-script.json");
    const outputPath = path.join(
      projectRoot,
      "output",
      "tts_generation",
      "latest",
      "audio.wav",
    );
    await fs.mkdir(path.dirname(inputPath), { recursive: true });
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(inputPath, "first", "utf-8");
    await fs.writeFile(outputPath, "audio", "utf-8");

    const first = await computeWorkflowStepFingerprint({
      projectRoot,
      stepName: "tts_generation",
      signature: { outputPreset: { width: 1920, height: 1080, fps: 30 } },
    });
    await writeWorkflowCacheManifest(projectRoot, "tts_generation", first);
    await expect(
      hasValidWorkflowCache(projectRoot, "tts_generation", outputPath, first),
    ).resolves.toBe(true);

    await fs.writeFile(inputPath, "second", "utf-8");
    const changed = await computeWorkflowStepFingerprint({
      projectRoot,
      stepName: "tts_generation",
      signature: { outputPreset: { width: 1920, height: 1080, fps: 30 } },
    });
    expect(changed).not.toBe(first);
    await expect(
      hasValidWorkflowCache(projectRoot, "tts_generation", outputPath, changed),
    ).resolves.toBe(false);
  });
});
