import "dotenv/config";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import PgBoss from "pg-boss";
import { PrismaClient } from "@prisma/client";
import { moveClip, resizeClip, setPlaybackRange, timelineToRemotionProps } from "@ymm/core";
import { ScriptSchema, TimelineDataSchema } from "@ymm/shared";
import { z } from "zod";
import {
  buildSafeAssetFilename,
  canAccessProject,
  createJobBodySchema,
  normalizeAssetId,
  normalizeProjectRelativePath,
  resolveSafeChildPath,
  resolveWorkflowJobRequest,
  settingsBodySchema,
} from "./apiValidation";
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
import { buildSettingsDiagnostics } from "./settingsDiagnostics";
import { resolveApiWorkspaceRoot } from "./workspaceRoot";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});
const env = envSchema.parse(process.env);

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });
const workspaceRoot = resolveApiWorkspaceRoot(import.meta.url);
const workflowOutputRoot = process.env.YMM_WORKFLOW_OUTPUT_ROOT ?? workspaceRoot;

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

const createAssetBodySchema = z.object({
  id: z.string().optional(),
  type: z.enum(["audio", "subtitle", "image", "video", "script", "metadata"]),
  name: z.string(),
  usage: z.enum(["background", "character", "bgm", "se", "reference", "other"]).optional(),
  relativePath: z.string().optional(),
  contentBase64: z.string().optional(),
  extension: z.string().optional(),
});

const templateAssetSchema = z.object({
  id: z.string(),
  type: z.enum(["audio", "subtitle", "image", "video", "script", "metadata"]),
  name: z.string(),
  usage: z.enum(["background", "character", "bgm", "se", "reference", "other"]).optional(),
  relativePath: z.string(),
  createdAt: z.string(),
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
    return toJsonSafeValue(withOwner);
  }
  return toJsonSafeValue(withOwner.filter((project) => project.ownerId === requestUserId));
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
      await applyTemplateAssets(project.id, template.assets ?? []);
      if (template.outputPreset) {
        await writeSettings(workspaceRoot, {
          apiKeys: {},
          outputPreset: template.outputPreset,
        });
      }
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
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
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

  return toJsonSafeValue({
    project: access.project,
    ownerId: access.ownerId,
    jobs,
    script,
    timeline,
    assets,
    logs,
  });
});

app.post("/api/projects/:projectId/jobs", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const body = createJobBodySchema.parse(req.body ?? {});
  const workflowRequest = resolveWorkflowJobRequest(body);

  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }

  const job = await prisma.job.create({
    data: {
      projectId,
      mode: workflowRequest.mode,
    },
  });

  await boss.send("yukkuri.render", {
    jobId: job.id,
    runMode: workflowRequest.runMode,
    skipSteps: workflowRequest.skipSteps,
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
  const ownerId = await readProjectOwner(workspaceRoot, job.projectId);
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  if (!canAccessProject(ownerId, requestUserId)) {
    return reply.code(403).send({ error: "forbidden" });
  }

  return toJsonSafeValue(job);
});

app.get("/api/jobs/:jobId/files/:fileId", async (req, reply) => {
  const { jobId } = jobIdParamSchema.parse(req.params);
  const { fileId } = z.object({ fileId: z.string().uuid() }).parse(req.params);
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { job: true },
  });
  if (!file || file.jobId !== jobId) {
    return reply.code(404).send({ error: "not_found" });
  }
  const ownerId = await readProjectOwner(workspaceRoot, file.job.projectId);
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  if (!canAccessProject(ownerId, requestUserId)) {
    return reply.code(403).send({ error: "forbidden" });
  }
  const targetPath = resolveSafeChildPath(workflowOutputRoot, file.relativePath);
  if (!(await fileExists(targetPath))) {
    return reply.code(404).send({ error: "not_found" });
  }
  return reply.type(guessContentType(targetPath)).send(createReadStream(targetPath));
});

app.post("/api/jobs", async (req, reply) => {
  const body = z
    .object({ theme: z.string().optional() })
    .merge(createJobBodySchema)
    .parse(req.body ?? {});
  const workflowRequest = resolveWorkflowJobRequest(body);

  const project = await prisma.project.create({ data: { theme: body.theme ?? null } });
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  await saveProjectOwner(workspaceRoot, project.id, requestUserId ?? "default");
  const job = await prisma.job.create({
    data: {
      projectId: project.id,
      mode: workflowRequest.mode,
    },
  });

  await boss.send("yukkuri.render", {
    jobId: job.id,
    runMode: workflowRequest.runMode,
    skipSteps: workflowRequest.skipSteps,
  });
  return reply.code(201).send({ projectId: project.id, jobId: job.id });
});

app.get("/api/projects/:projectId/script", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const script = await readProjectScript(workspaceRoot, projectId);
  if (!script) {
    return reply.code(404).send({ error: "not_found" });
  }
  return script;
});

app.put("/api/projects/:projectId/script", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const script = ScriptSchema.parse(req.body ?? {});
  await saveProjectScript(workspaceRoot, projectId, script);
  return reply.code(200).send({ ok: true });
});

app.get("/api/projects/:projectId/assets", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  return listProjectAssets(workspaceRoot, projectId);
});

app.get("/api/projects/:projectId/assets/:assetId/file", async (req, reply) => {
  const { projectId, assetId } = z
    .object({ projectId: z.string().uuid(), assetId: z.string() })
    .parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const assets = await listProjectAssets(workspaceRoot, projectId);
  const asset = assets.find((candidate) => candidate.id === assetId);
  if (!asset) {
    return reply.code(404).send({ error: "not_found" });
  }
  const targetPath = resolveSafeChildPath(workspaceRoot, asset.relativePath);
  if (!(await fileExists(targetPath))) {
    return reply.code(404).send({ error: "not_found" });
  }
  return reply.type(guessContentType(targetPath)).send(createReadStream(targetPath));
});

app.post("/api/projects/:projectId/assets", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const body = createAssetBodySchema.parse(req.body ?? {});
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }

  const assetId = normalizeAssetId(body.id ?? `asset-${Date.now()}`);
  let relativePath = body.relativePath ? normalizeProjectRelativePath(body.relativePath) : undefined;

  if (body.contentBase64) {
    const fileName = buildSafeAssetFilename(assetId, body.extension ?? "bin");
    const usageDirectory = assetUsageDirectory(body.usage);
    const filePath = path.join(
      workspaceRoot,
      "projects",
      projectId,
      "input",
      "assets",
      usageDirectory,
      fileName
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
    usage: body.usage ?? "other",
    createdAt: new Date().toISOString(),
  });

  return reply.code(201).send({ ok: true, assetId, relativePath });
});

app.get("/api/projects/:projectId/timeline", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const script = await readProjectScript(workspaceRoot, projectId);
  if (!script) {
    return reply.code(404).send({ error: "script_not_found" });
  }
  const timeline = await readOrCreateTimeline(workspaceRoot, projectId, script);
  return timeline;
});

app.put("/api/projects/:projectId/timeline", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const timeline = TimelineDataSchema.parse(req.body ?? {});
  await saveTimeline(workspaceRoot, projectId, timeline);
  return reply.code(200).send({ ok: true });
});

app.post("/api/projects/:projectId/timeline/operations", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
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
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const script = await readProjectScript(workspaceRoot, projectId);
  if (!script) {
    return reply.code(404).send({ error: "script_not_found" });
  }
  const timeline = await readOrCreateTimeline(workspaceRoot, projectId, script);
  const settings = await readSettings(workspaceRoot);
  return {
    timeline,
    outputPreset: settings.outputPreset,
    remotionProps: timelineToRemotionProps(timeline, settings.outputPreset.fps),
  };
});

app.get("/api/settings", async () => {
  return readSettings(workspaceRoot);
});

app.put("/api/settings", async (req, reply) => {
  const settings = settingsBodySchema.parse(req.body ?? {});

  await writeSettings(workspaceRoot, settings);
  return reply.code(200).send({ ok: true });
});

app.get("/api/settings/diagnostics", async () => buildSettingsDiagnostics());

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
      assets: z.array(templateAssetSchema).optional(),
      outputPreset: settingsBodySchema.shape.outputPreset.optional(),
      automationProfile: z
        .object({
          mode: z.enum(["full", "scriptOnly", "renderOnly", "custom"]),
          skipSteps: z.array(z.string()).optional(),
        })
        .optional(),
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

const assetUsageDirectory = (usage?: string): string => {
  if (usage === "background") {
    return "backgrounds";
  }
  if (usage === "character") {
    return "characters";
  }
  if (usage === "bgm" || usage === "se") {
    return "audio";
  }
  return "misc";
};

const guessContentType = (targetPath: string): string => {
  const extension = path.extname(targetPath).toLowerCase();
  if (extension === ".mp4") {
    return "video/mp4";
  }
  if (extension === ".webm") {
    return "video/webm";
  }
  if (extension === ".wav") {
    return "audio/wav";
  }
  if (extension === ".mp3") {
    return "audio/mpeg";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return "application/octet-stream";
};

const applyTemplateAssets = async (
  projectId: string,
  assets: Array<{
    id: string;
    type: "audio" | "subtitle" | "image" | "video" | "script" | "metadata";
    name: string;
    relativePath: string;
    usage?: "background" | "character" | "bgm" | "se" | "reference" | "other";
    createdAt: string;
  }>
): Promise<void> => {
  for (const asset of assets) {
    const sourceRelativePath = normalizeProjectRelativePath(asset.relativePath);
    const sourcePath = path.resolve(workspaceRoot, sourceRelativePath);
    const usageDirectory = assetUsageDirectory(asset.usage);
    const targetRelativePath = path
      .join(
        "projects",
        projectId,
        "input",
        "assets",
        usageDirectory,
        path.basename(sourceRelativePath)
      )
      .replaceAll("\\", "/");
    const targetPath = path.resolve(workspaceRoot, targetRelativePath);

    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.copyFile(sourcePath, targetPath);
    } catch {
      // テンプレート元の実ファイルが無い場合でも、素材台帳は保持して利用者が差し替えられるようにする。
    }

    await saveProjectAsset(workspaceRoot, projectId, {
      ...asset,
      id: normalizeAssetId(asset.id),
      relativePath: (await fileExists(targetPath)) ? targetRelativePath : sourceRelativePath,
    });
  }
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const getRequestUserId = (headerValue: unknown): string | null => {
  if (typeof headerValue !== "string") {
    return null;
  }
  const trimmed = headerValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getProjectAccess = async (
  projectId: string,
  requestUserIdHeader: unknown
): Promise<
  | {
      ok: true;
      project: NonNullable<Awaited<ReturnType<typeof prisma.project.findUnique>>>;
      ownerId: string | null;
    }
  | { ok: false; statusCode: 403 | 404; error: "forbidden" | "not_found" }
> => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return { ok: false, statusCode: 404, error: "not_found" };
  }

  const ownerId = await readProjectOwner(workspaceRoot, project.id);
  const requestUserId = getRequestUserId(requestUserIdHeader);
  if (!canAccessProject(ownerId, requestUserId)) {
    return { ok: false, statusCode: 403, error: "forbidden" };
  }

  return { ok: true, project, ownerId };
};

const toJsonSafeValue = (value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafeValue(item));
  }
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toJsonSafeValue(nestedValue)])
    );
  }
  return value;
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
