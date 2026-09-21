import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import {
  captureJobInputs,
  prepareJobWorkspace,
  publishJobOutputs,
} from "./jobWorkspace";

describe("Job入力の固定", () => {
  it("投入後の台本・素材・タイムライン変更を隔離し、公開時も新しい編集を保つ", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ymm-job-inputs-"));
    const projectId = "project-1",
      jobId = "job-1";
    const source = path.join(root, "projects", projectId);
    await fs.mkdir(path.join(source, "input/assets"), { recursive: true });
    await fs.mkdir(path.join(source, "intermediate"), { recursive: true });
    await fs.writeFile(
      path.join(source, "input/manual-script.json"),
      JSON.stringify({ title: "投入時" }),
    );
    await fs.writeFile(path.join(source, "input/assets/voice.wav"), "音声A");
    await fs.writeFile(
      path.join(source, "intermediate/timeline.json"),
      JSON.stringify({
        tracks: [
          {
            clips: [{ assetPath: "projects/project-1/input/assets/voice.wav" }],
          },
        ],
      }),
    );
    const options = {
      workspaceRoot: root,
      outputRoot: root,
      projectId,
      jobId,
      settings: { version: 1 },
    };
    const revision = await captureJobInputs(options);
    await fs.writeFile(
      path.join(source, "input/manual-script.json"),
      JSON.stringify({ title: "投入後" }),
    );
    await fs.writeFile(path.join(source, "input/assets/voice.wav"), "音声B");
    await fs.writeFile(
      path.join(source, "intermediate/timeline.json"),
      JSON.stringify({ edited: true }),
    );
    const work = await prepareJobWorkspace({
      ...options,
      inputRevision: revision,
    });
    expect(
      JSON.parse(
        await fs.readFile(path.join(work, "input/manual-script.json"), "utf8"),
      ).title,
    ).toBe("投入時");
    const timeline = JSON.parse(
      await fs.readFile(path.join(work, "intermediate/timeline.json"), "utf8"),
    );
    expect(
      await fs.readFile(timeline.tracks[0].clips[0].assetPath, "utf8"),
    ).toBe("音声A");
    await fs.mkdir(path.join(work, "final"), { recursive: true });
    await fs.writeFile(path.join(work, "final/final.mp4"), "生成物");
    await publishJobOutputs(options);
    expect(
      await fs.readFile(path.join(source, "final/final.mp4"), "utf8"),
    ).toBe("生成物");
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(source, "intermediate/timeline.json"),
          "utf8",
        ),
      ),
    ).toEqual({ edited: true });
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(source, "input/manual-script.json"),
          "utf8",
        ),
      ).title,
    ).toBe("投入後");
    expect(
      await prepareJobWorkspace({ ...options, inputRevision: revision }),
    ).toBe(work);
  });

  it("投入済みsnapshotの改変を検出して実行を拒否する", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ymm-job-tamper-"));
    const options = {
      workspaceRoot: root,
      outputRoot: root,
      projectId: "p",
      jobId: "j",
      settings: {},
    };
    const inputRevision = await captureJobInputs(options);
    await fs.writeFile(
      path.join(root, "projects/p/jobs/j/snapshot/unexpected.txt"),
      "改変",
    );
    await expect(
      prepareJobWorkspace({ ...options, inputRevision }),
    ).rejects.toThrow("job_input_revision_mismatch");
  });
});
