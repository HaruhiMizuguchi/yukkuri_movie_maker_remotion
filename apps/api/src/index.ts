import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import PgBoss from "pg-boss";
import { PrismaClient } from "@prisma/client";
import { moveClip, resizeClip, setPlaybackRange, timelineToRemotionProps } from "@ymm/core";
import { ScriptSchema, TimelineDataSchema } from "@ymm/shared";
import { z } from "zod";
import {
  createTemplate,
  listProjectAssets,
  listTemplates,
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

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});
const env = envSchema.parse(process.env);

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });
const workspaceRoot = process.cwd();

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

const projectIdParamSchema = z.object({ projectId: z.string().uuid() });
const jobIdParamSchema = z.object({ jobId: z.string().uuid() });

const createProjectBodySchema = z.object({
  theme: z.string().optional(),
  mode: z.string().default("full"),
  templateId: z.string().optional(),
  userId: z.string().optional(),
});

const createJobBodySchema = z.object({
  mode: z.string().default("full"),
  runMode: z.enum(["full", "resume"]).optional(),
  skipSteps: z.array(z.string()).optional(),
});

const createAssetBodySchema = z.object({
  id: z.string().optional(),
  type: z.enum(["audio", "subtitle", "image", "video", "script", "metadata"]),
  name: z.string(),
  relativePath: z.string().optional(),
  contentBase64: z.string().optional(),
  extension: z.string().optional(),
});

const updateTimelineOperationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("move"),
    trackId: z.string(),
    clipId: z.string(),
    newStartMs: z.number().int(),
  }),
  z.object({
    operation: z.literal("resize"),
    trackId: z.string(),
    clipId: z.string(),
    newDurationMs: z.number().int(),
  }),
  z.object({
    operation: z.literal("playbackRange"),
    inMs: z.number().int(),
    outMs: z.number().int(),
  }),
]);

app.get("/api/dashboard", async () => {
  const [projectCount, runningJobCount, failedJobCount] = await Promise.all([
    prisma.project.count(),
    prisma.job.count({ where: { status: "RUNNING" } }),
    prisma.job.count({ where: { status: "FAILED" } }),
  ]);

  return {
    projectCount,
    runningJobCount,
    failedJobCount,
  };
});

app.get("/api/projects", async (req) => {
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const withOwner = await Promise.all(
    projects.map(async (project) => ({
      id: project.id,
      theme: project.theme,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      latestJob: project.jobs[0] ?? null,
      ownerId: await readProjectOwner(workspaceRoot, project.id),
    }))
  );

  if (!requestUserId) {
    return withOwner;
  }
  return withOwner.filter((project) => project.ownerId === requestUserId);
});

app.post("/api/projects", async (req, reply) => {
  const body = createProjectBodySchema.parse(req.body ?? {});
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);

  const project = await prisma.project.create({
    data: {
      theme: body.theme ?? null,
    },
  });
  const ownerId = body.userId ?? requestUserId ?? "default";
  await saveProjectOwner(workspaceRoot, project.id, ownerId);

  if (body.templateId) {
    const templates = await listTemplates(workspaceRoot);
    const template = templates.find((candidate) => candidate.id === body.templateId);
    if (template) {
      await saveProjectScript(workspaceRoot, project.id, {
        title: `${template.name} テンプレート`,
        theme: String(template.scriptSeed.theme ?? body.theme ?? "テンプレート"),
        lines: [
          { speaker: "reimu", text: "テンプレートを読み込みました。" },
          { speaker: "marisa", text: "台本を編集してからレンダリングできるぜ。" },
        ],
      });
      await saveTimeline(workspaceRoot, project.id, template.timelinePreset);
    }
  }

  return reply.code(201).send({
    projectId: project.id,
    theme: project.theme,
    mode: body.mode,
    ownerId,
  });
});

app.get("/api/projects/:projectId", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    return reply.code(404).send({ error: "not_found" });
  }
  const ownerId = await readProjectOwner(workspaceRoot, project.id);
  if (requestUserId && ownerId && requestUserId !== ownerId) {
    return reply.code(403).send({ error: "forbidden" });
  }

  const jobs = await prisma.job.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { steps: true, files: true },
  });

  const script = await readProjectScript(workspaceRoot, projectId);
  const timeline = script ? await readOrCreateTimeline(workspaceRoot, projectId, script) : null;
  const assets = await listProjectAssets(workspaceRoot, projectId);
  const logs = await readWorkflowLogs(projectId);

  return {
    project,
    ownerId,
    jobs,
    script,
    timeline,
    assets,
    logs,
  };
});

app.post("/api/projects/:projectId/jobs", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const body = createJobBodySchema.parse(req.body ?? {});

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return reply.code(404).send({ error: "not_found" });
  }

  const job = await prisma.job.create({
    data: {
      projectId,
      mode: body.mode,
    },
  });

  await boss.send("yukkuri.render", {
    jobId: job.id,
    runMode: body.runMode,
    skipSteps: body.skipSteps,
  });

  return reply.code(201).send({ projectId, jobId: job.id });
});

app.get("/api/jobs/:jobId", async (req, reply) => {
  const { jobId } = jobIdParamSchema.parse(req.params);
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { steps: true, files: true, project: true },
  });

  if (!job) {
    return reply.code(404).send({ error: "not_found" });
  }

  return job;
});

app.post("/api/jobs", async (req, reply) => {
  const body = z
    .object({
      theme: z.string().optional(),
      mode: z.string().optional().default("full"),
    })
    .parse(req.body ?? {});

  const project = await prisma.project.create({ data: { theme: body.theme ?? null } });
  const job = await prisma.job.create({
    data: {
      projectId: project.id,
      mode: body.mode,
    },
  });

  await boss.send("yukkuri.render", { jobId: job.id });
  return reply.code(201).send({ projectId: project.id, jobId: job.id });
});

app.get("/api/projects/:projectId/script", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const script = await readProjectScript(workspaceRoot, projectId);
  if (!script) {
    return reply.code(404).send({ error: "not_found" });
  }
  return script;
});

app.put("/api/projects/:projectId/script", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const script = ScriptSchema.parse(req.body ?? {});
  await saveProjectScript(workspaceRoot, projectId, script);
  return reply.code(200).send({ ok: true });
});

app.get("/api/projects/:projectId/assets", async (req) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  return listProjectAssets(workspaceRoot, projectId);
});

app.post("/api/projects/:projectId/assets", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const body = createAssetBodySchema.parse(req.body ?? {});

  const assetId = body.id ?? `asset-${Date.now()}`;
  let relativePath = body.relativePath;

  if (body.contentBase64) {
    const extension = body.extension ?? "bin";
    const filePath = path.join(
      workspaceRoot,
      "projects",
      projectId,
      "input",
      "assets",
      `${assetId}.${extension}`
    );
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(body.contentBase64, "base64"));
    relativePath = path.relative(workspaceRoot, filePath).replaceAll("\\", "/");
  }

  if (!relativePath) {
    return reply.code(400).send({ error: "relativePath_or_content_required" });
  }

  await saveProjectAsset(workspaceRoot, projectId, {
    id: assetId,
    type: body.type,
    name: body.name,
    relativePath,
    createdAt: new Date().toISOString(),
  });

  return reply.code(201).send({ ok: true, assetId, relativePath });
});

app.get("/api/projects/:projectId/timeline", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const script = await readProjectScript(workspaceRoot, projectId);
  if (!script) {
    return reply.code(404).send({ error: "script_not_found" });
  }
  const timeline = await readOrCreateTimeline(workspaceRoot, projectId, script);
  return timeline;
});

app.put("/api/projects/:projectId/timeline", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const timeline = TimelineDataSchema.parse(req.body ?? {});
  await saveTimeline(workspaceRoot, projectId, timeline);
  return reply.code(200).send({ ok: true });
});

app.post("/api/projects/:projectId/timeline/operations", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const script = await readProjectScript(workspaceRoot, projectId);
  if (!script) {
    return reply.code(404).send({ error: "script_not_found" });
  }

  const operation = updateTimelineOperationSchema.parse(req.body ?? {});
  const current = await readOrCreateTimeline(workspaceRoot, projectId, script);

  let updated = current;
  if (operation.operation === "move") {
    updated = moveClip(current, {
      trackId: operation.trackId,
      clipId: operation.clipId,
      newStartMs: operation.newStartMs,
    });
  } else if (operation.operation === "resize") {
    updated = resizeClip(current, {
      trackId: operation.trackId,
      clipId: operation.clipId,
      newDurationMs: operation.newDurationMs,
    });
  } else {
    updated = setPlaybackRange(current, {
      inMs: operation.inMs,
      outMs: operation.outMs,
    });
  }

  await saveTimeline(workspaceRoot, projectId, updated);
  return updated;
});

app.get("/api/projects/:projectId/preview", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const script = await readProjectScript(workspaceRoot, projectId);
  if (!script) {
    return reply.code(404).send({ error: "script_not_found" });
  }
  const timeline = await readOrCreateTimeline(workspaceRoot, projectId, script);
  return {
    timeline,
    remotionProps: timelineToRemotionProps(timeline),
  };
});

app.get("/api/settings", async () => {
  return readSettings(workspaceRoot);
});

app.put("/api/settings", async (req, reply) => {
  const settings = z
    .object({
      apiKeys: z.object({
        google: z.string().optional(),
        openai: z.string().optional(),
        stability: z.string().optional(),
      }),
      outputPreset: z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        fps: z.number().int().positive(),
      }),
    })
    .parse(req.body ?? {});

  await writeSettings(workspaceRoot, settings);
  return reply.code(200).send({ ok: true });
});

app.get("/api/templates", async () => {
  return listTemplates(workspaceRoot);
});

app.post("/api/templates", async (req, reply) => {
  const template = z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      scriptSeed: z.record(z.unknown()),
      timelinePreset: TimelineDataSchema,
    })
    .parse(req.body ?? {});

  await createTemplate(workspaceRoot, template);
  return reply.code(201).send({ ok: true, id: template.id });
});

const readWorkflowLogs = async (projectId: string): Promise<string[]> => {
  const logPath = path.join(workspaceRoot, "projects", projectId, "logs", "workflow.log");
  try {
    const text = await fs.readFile(logPath, "utf-8");
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(-200);
  } catch {
    return [];
  }
};

const getRequestUserId = (headerValue: unknown): string | null => {
  if (typeof headerValue !== "string") {
    return null;
  }
  const trimmed = headerValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

async function main() {
  await boss.start();
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen({ port, host: "127.0.0.1" });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
