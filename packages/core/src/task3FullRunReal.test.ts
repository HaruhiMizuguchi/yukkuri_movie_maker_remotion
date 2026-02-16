import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  createDefaultWorkflowImplementations,
  runWorkflow,
  type WorkflowContext,
} from "./index";

const loadAivisBaseUrl = async (): Promise<string | null> => {
  if (process.env.AIVIS_SPEECH_BASE_URL?.trim()) {
    return process.env.AIVIS_SPEECH_BASE_URL.trim();
  }

  try {
    const envText = await fs.readFile(path.join(process.cwd(), ".env"), "utf-8");
    const line = envText
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith("AIVIS_SPEECH_BASE_URL="));
    if (!line) {
      return null;
    }
    const value = line.split("=", 2)[1]?.trim();
    return value || null;
  } catch {
    return null;
  }
};

const runCommand = async (command: string, args: string[], cwd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`${command} failed: ${stderr}`));
    });
  });

const ensureAssetFromCandidates = async (
  candidates: string[],
  destinationPath: string
): Promise<string> => {
  for (const candidate of candidates) {
    try {
      await fs.stat(candidate);
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.copyFile(candidate, destinationPath);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(`Asset was not found. destination=${destinationPath}`);
};

const createPrismaMock = (projectId: string, theme: string) => {
  const workflowUpdates: Array<any> = [];
  const prisma: any = {
    workflowStep: {
      findMany: async () => [],
      upsert: async () => ({}),
      update: async (payload: any) => {
        workflowUpdates.push(payload);
        return payload;
      },
    },
    projectFile: {
      createMany: async ({ data }: { data: any[] }) => ({ count: data.length }),
    },
    job: {
      findUnique: async () => ({
        id: "job-task3-full-real",
        projectId,
        mode: "full",
        project: { id: projectId, theme },
      }),
    },
  };
  return { prisma, workflowUpdates };
};

describe("task3 full run real", () => {
  it("Aivis実接続でscriptからfinal.mp4まで通し生成できる", async () => {
    const aivisBaseUrl = await loadAivisBaseUrl();
    if (!aivisBaseUrl) {
      throw new Error("AIVIS_SPEECH_BASE_URL is missing.");
    }

    const speakerResponse = await fetch(`${aivisBaseUrl.replace(/\/$/, "")}/speakers`);
    if (!speakerResponse.ok) {
      throw new Error(`Aivis speaker API failed: ${speakerResponse.status}`);
    }

    const runId = `full-run-${Date.now()}`;
    const projectId = `project-${Date.now()}`;
    const outputRoot = path.join(process.cwd(), "outputs", "test_evidence", "task3_quality", runId);
    const projectRoot = path.join(outputRoot, "projects", projectId);

    // 立ち絵と背景は既存の証跡素材から選び、fallback生成を避ける。
    const characterSource = await ensureAssetFromCandidates(
      [
        path.join(
          process.cwd(),
          "outputs",
          "test_evidence",
          "task3_quality",
          "video-1771213093985",
          "projects",
          "project-1771213093985",
          "input",
          "assets",
          "characters",
          "main.png"
        ),
        path.join(
          process.cwd(),
          "outputs",
          "test_evidence",
          "task3_quality",
          "video-1771213086220",
          "projects",
          "project-1771213086220",
          "input",
          "assets",
          "characters",
          "main.png"
        ),
      ],
      path.join(projectRoot, "input", "assets", "characters", "main.png")
    );

    const backgroundSource = await ensureAssetFromCandidates(
      [
        path.join(
          process.cwd(),
          "outputs",
          "test_evidence",
          "task6",
          "run-1770918656039",
          "projects",
          "project-1770918656039",
          "output",
          "background_generation",
          "latest",
          "background.png"
        ),
        path.join(
          process.cwd(),
          "outputs",
          "test_evidence",
          "task3_quality",
          "video-1771213093985",
          "projects",
          "project-1771213093985",
          "output",
          "video_composition",
          "latest",
          "background.png"
        ),
      ],
      path.join(projectRoot, "input", "assets", "backgrounds", "main.png")
    );

    const { prisma, workflowUpdates } = createPrismaMock(
      projectId,
      "Aivis実接続で作る通し検証動画"
    );
    const ctx = {
      jobId: "job-task3-full-real",
      prisma,
      outputRoot,
    } as WorkflowContext;

    await runWorkflow(
      ctx,
      createDefaultWorkflowImplementations({
        outputRoot,
        ttsProvider: "aivis",
        aivisBaseUrl,
        allowMockTtsFallback: false,
        requireCharacterAsset: true,
      }),
      { mode: "full" }
    );

    const finalPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "final_encoding",
      "latest",
      "final.mp4"
    );
    const compositionPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "video_composition",
      "latest",
      "composition.json"
    );
    const timestampsPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "tts_generation",
      "latest",
      "timestamps.json"
    );

    const [finalStat, compositionRaw, timestampsRaw] = await Promise.all([
      fs.stat(finalPath),
      fs.readFile(compositionPath, "utf-8"),
      fs.readFile(timestampsPath, "utf-8"),
    ]);
    const composition = JSON.parse(compositionRaw) as { characterImagePath: string };
    const timestamps = JSON.parse(timestampsRaw) as Array<{ endMs: number }>;

    const videoCodec = await runCommand(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        finalPath,
      ],
      process.cwd()
    );

    const ttsStepCompleted = workflowUpdates.find(
      (payload) =>
        payload?.where?.jobId_stepName?.stepName === "tts_generation" &&
        payload?.data?.status === "COMPLETED"
    );

    expect(finalStat.size).toBeGreaterThan(50000);
    expect(videoCodec).toBe("h264");
    expect(composition.characterImagePath).toContain("input/assets/characters/main.png");
    expect(timestamps.length).toBeGreaterThanOrEqual(2);
    expect(timestamps[timestamps.length - 1]?.endMs ?? 0).toBeGreaterThan(1500);
    expect(ttsStepCompleted?.data?.outputJson?.provider).toBe("aivis");

    await fs.writeFile(
      path.join(outputRoot, "run_summary.json"),
      `${JSON.stringify(
        {
          runId,
          projectId,
          characterSource,
          backgroundSource,
          finalPath,
          finalSizeBytes: finalStat.size,
          compositionPath,
          timestampsPath,
        },
        null,
        2
      )}\n`,
      "utf-8"
    );
  }, 300000);
});
