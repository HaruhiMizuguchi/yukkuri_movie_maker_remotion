import "dotenv/config";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import PgBoss from "pg-boss";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  createFinalVideoEditingTimeline,
  moveClip,
  probeMediaDurationMs,
  resizeClip,
  setPlaybackRange,
  timelineToRemotionProps,
} from "@ymm/core";
import {
  AutomationModeSchema,
  AiProviderSchema,
  extractAiUsageRecords,
  ScriptSchema,
  summarizeAiUsage,
  TimelineDataSchema,
} from "@ymm/shared";
import { z } from "zod";
import {
  buildSafeAssetFilename,
  canAccessProject,
  createJobBodySchema,
  normalizeAssetRelativePath,
  normalizeAssetId,
  normalizeProjectRelativePath,
  normalizeTemplateId,
  readByteRange,
  resolveSafeChildPath,
  resolveWorkflowJobRequest,
  settingsBodySchema,
} from "./apiValidation";
import {
  createTemplate,
  computeProjectInputRevision,
  listProjectAssets,
  listTemplates,
  packageTemplateAssets,
  readOrCreateTimeline,
  readProjectScript,
  readSettings,
  saveProjectAsset,
  saveProjectScript,
  saveTimeline,
  writeSettings,
} from "./storage";
import { buildSettingsDiagnostics } from "./settingsDiagnostics";
import {
  clearApiKey,
  getApiKeyStatuses,
  resolveApiKeys,
  saveApiKey,
  type ApiKeyStatuses,
} from "./secretStore";
import { resolveApiWorkspaceRoot } from "./workspaceRoot";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});
const env = envSchema.parse(process.env);

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });
const workspaceRoot = resolveApiWorkspaceRoot(import.meta.url);
const workflowOutputRoot =
  process.env.YMM_WORKFLOW_OUTPUT_ROOT ?? workspaceRoot;

const app = Fastify({ logger: true });
await app.register(multipart, {
  limits: {
    files: 1,
    fileSize: 250 * 1024 * 1024,
    fields: 12,
  },
});
app.setErrorHandler((error, req, reply) => {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      error: "validation_error",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  const typedError = error as { statusCode?: number; code?: string };
  if (
    typedError.statusCode === 413 ||
    typedError.code === "FST_REQ_FILE_TOO_LARGE"
  ) {
    return reply.code(413).send({ error: "payload_too_large" });
  }
  req.log.error({ err: error }, "request_failed");
  return reply
    .code(
      typedError.statusCode && typedError.statusCode < 500
        ? typedError.statusCode
        : 500,
    )
    .send({
      error:
        typedError.statusCode && typedError.statusCode < 500
          ? (typedError.code ?? "request_failed")
          : "internal_error",
    });
});

app.get("/health", async () => {
  let database = false;
  let queue = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
    await boss.getQueueSize("yukkuri.render");
    queue = true;
  } catch {
    database = false;
    queue = false;
  }
  const [worker, diagnostics] = await Promise.all([
    readWorkerHeartbeat(),
    buildSettingsDiagnostics(),
  ]);
  return {
    ok: database && queue,
    components: {
      database,
      queue,
      worker,
      aivisSpeech: diagnostics.aivisSpeech,
      gemini: diagnostics.googleApiKey,
      openai: diagnostics.openaiApiKey,
      anthropic: diagnostics.anthropicApiKey,
    },
  };
});

const projectIdParamSchema = z.object({ projectId: z.string().uuid() });
const jobIdParamSchema = z.object({ jobId: z.string().uuid() });

const createProjectBodySchema = z.object({
  theme: z.string().optional(),
  mode: AutomationModeSchema.default("full"),
  templateId: z.string().optional(),
});

const createAssetBodySchema = z.object({
  id: z.string().optional(),
  type: z.enum(["audio", "subtitle", "image", "video", "script", "metadata"]),
  name: z.string(),
  usage: z
    .enum(["background", "character", "bgm", "se", "reference", "other"])
    .optional(),
  relativePath: z.string().optional(),
});

const templateAssetSchema = z.object({
  id: z.string(),
  type: z.enum(["audio", "subtitle", "image", "video", "script", "metadata"]),
  name: z.string(),
  usage: z
    .enum(["background", "character", "bgm", "se", "reference", "other"])
    .optional(),
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

app.get("/api/dashboard", async (req) => {
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  const [projectCount, runningJobCount, failedJobCount] = await Promise.all([
    prisma.project.count({
      where: { ownerId: requestUserId ?? "__missing__" },
    }),
    prisma.job.count({
      where: {
        status: "RUNNING",
        project: { ownerId: requestUserId ?? "__missing__" },
      },
    }),
    prisma.job.count({
      where: {
        status: "FAILED",
        project: { ownerId: requestUserId ?? "__missing__" },
      },
    }),
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
    where: { ownerId: requestUserId ?? "__missing__" },
    orderBy: { createdAt: "desc" },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const withOwner = projects.map((project) => ({
    id: project.id,
    theme: project.theme,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    latestJob: project.jobs[0] ?? null,
    ownerId: project.ownerId,
  }));

  return toJsonSafeValue(withOwner);
});

app.post("/api/projects", async (req, reply) => {
  const body = createProjectBodySchema.parse(req.body ?? {});
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  if (!requestUserId) {
    return reply.code(401).send({ error: "authentication_required" });
  }

  const templates = body.templateId ? await listTemplates(workspaceRoot) : [];
  const template = body.templateId
    ? templates.find(
        (candidate) => candidate.id === normalizeTemplateId(body.templateId!),
      )
    : undefined;
  if (body.templateId && !template) {
    return reply.code(404).send({ error: "template_not_found" });
  }
  const defaultProjectSettings = await readSettings(workspaceRoot);
  const projectSettings = {
    apiKeys: {},
    outputPreset: template?.outputPreset ?? defaultProjectSettings.outputPreset,
  };
  const automationMode = template?.automationProfile?.mode ?? body.mode;

  const project = await prisma.project.create({
    data: {
      theme: body.theme ?? null,
      ownerId: requestUserId,
      automationMode,
      settingsJson: projectSettings as Prisma.InputJsonValue,
    },
  });

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
    await applyTemplateAssets(project.id, template.id, template.assets ?? []);
  }

  return reply.code(201).send({
    projectId: project.id,
    theme: project.theme,
    mode: automationMode,
    ownerId: requestUserId,
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
  const timeline = script
    ? await readOrCreateTimeline(workspaceRoot, projectId, script)
    : null;
  const assets = await listProjectAssets(workspaceRoot, projectId);
  const logs = await readWorkflowLogs(projectId);
  const usageRecordsByJob = jobs.map((job) =>
    job.steps.flatMap((step) => extractAiUsageRecords(step.outputJson)),
  );
  const projectUsageRecords = usageRecordsByJob.flat();
  const parsedProjectSettings = settingsBodySchema.safeParse(
    access.project.settingsJson,
  );
  const safeProjectSettings = parsedProjectSettings.success
    ? parsedProjectSettings.data
    : await readSettings(workspaceRoot);

  return toJsonSafeValue({
    project: {
      ...access.project,
      settingsJson: safeProjectSettings,
    },
    ownerId: access.ownerId,
    jobs,
    script,
    timeline,
    assets,
    aiUsageSummary: {
      project: summarizeAiUsage(projectUsageRecords),
      latestJob: jobs[0] ? summarizeAiUsage(usageRecordsByJob[0] ?? []) : null,
    },
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

  const queued = await createAndEnqueueJob(access.project, workflowRequest);
  if (!queued.ok) {
    return reply
      .code(503)
      .send({ error: "queue_unavailable", jobId: queued.jobId });
  }

  return reply.code(201).send({ projectId, jobId: queued.jobId });
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
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  if (!canAccessProject(job.project.ownerId, requestUserId)) {
    return reply.code(403).send({ error: "forbidden" });
  }

  return toJsonSafeValue(job);
});

app.get("/api/jobs/:jobId/files/:fileId", async (req, reply) => {
  const { jobId } = jobIdParamSchema.parse(req.params);
  const { fileId } = z.object({ fileId: z.string().uuid() }).parse(req.params);
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { job: { include: { project: true } } },
  });
  if (!file || file.jobId !== jobId) {
    return reply.code(404).send({ error: "not_found" });
  }
  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  if (!canAccessProject(file.job.project.ownerId, requestUserId)) {
    return reply.code(403).send({ error: "forbidden" });
  }
  const targetPath = resolveSafeChildPath(
    workflowOutputRoot,
    file.relativePath,
  );
  if (!(await fileExists(targetPath))) {
    return reply.code(404).send({ error: "not_found" });
  }
  return sendLocalFile(req, reply, targetPath);
});

app.post("/api/jobs", async (req, reply) => {
  const body = z
    .object({ theme: z.string().optional() })
    .merge(createJobBodySchema)
    .parse(req.body ?? {});
  const workflowRequest = resolveWorkflowJobRequest(body);

  const requestUserId = getRequestUserId(req.headers["x-user-id"]);
  if (!requestUserId) {
    return reply.code(401).send({ error: "authentication_required" });
  }
  const settings = await readSettings(workspaceRoot);
  const project = await prisma.project.create({
    data: {
      theme: body.theme ?? null,
      ownerId: requestUserId,
      automationMode: workflowRequest.mode,
      settingsJson: settings as Prisma.InputJsonValue,
    },
  });
  const queued = await createAndEnqueueJob(project, workflowRequest);
  if (!queued.ok) {
    return reply
      .code(503)
      .send({ error: "queue_unavailable", jobId: queued.jobId });
  }
  return reply.code(201).send({ projectId: project.id, jobId: queued.jobId });
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
  return sendLocalFile(req, reply, targetPath);
});

app.post("/api/projects/:projectId/assets", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }

  const multipartUpload = req.isMultipart()
    ? await readMultipartAsset(req, projectId)
    : null;
  const body = createAssetBodySchema.parse(
    multipartUpload?.fields ?? req.body ?? {},
  );

  const assetId = normalizeAssetId(
    body.id ?? multipartUpload?.assetId ?? `asset-${Date.now()}`,
  );
  let relativePath = body.relativePath
    ? normalizeAssetRelativePath(projectId, body.relativePath)
    : undefined;

  if (multipartUpload) {
    const fileName = buildSafeAssetFilename(assetId, multipartUpload.extension);
    const usageDirectory = assetUsageDirectory(body.usage);
    const filePath = path.join(
      workspaceRoot,
      "projects",
      projectId,
      "input",
      "assets",
      usageDirectory,
      fileName,
    );
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.rename(multipartUpload.tempPath, filePath);
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

app.post("/api/projects/:projectId/timeline/import-final", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const script = await readProjectScript(workspaceRoot, projectId);
  if (!script) {
    return reply.code(404).send({ error: "script_not_found" });
  }

  const finalPath = path.join(
    workflowOutputRoot,
    "projects",
    projectId,
    "final",
    "final.mp4",
  );
  try {
    await fs.access(finalPath);
  } catch {
    return reply.code(404).send({ error: "final_video_not_found" });
  }

  const [current, durationMs] = await Promise.all([
    readOrCreateTimeline(workspaceRoot, projectId, script),
    probeMediaDurationMs(finalPath),
  ]);
  const timeline = createFinalVideoEditingTimeline(current, {
    assetPath: "final/final.mp4",
    durationMs,
    sourceName: "完成動画（再編集元）",
  });
  await saveTimeline(workspaceRoot, projectId, timeline);
  req.log.info(
    { projectId, durationMs, sourcePath: "final/final.mp4" },
    "final_video_imported_to_timeline",
  );
  return reply.code(200).send({ timeline, durationMs });
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
  const parsedSettings = settingsBodySchema.safeParse(
    access.project.settingsJson,
  );
  const settings = parsedSettings.success
    ? parsedSettings.data
    : await readSettings(workspaceRoot);
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

const toPublicApiKeyStatuses = (statuses: ApiKeyStatuses) => ({
  googleApiKey: statuses.google,
  openaiApiKey: statuses.openai,
  anthropicApiKey: statuses.anthropic,
});

app.get("/api/settings/secrets", async () =>
  toPublicApiKeyStatuses(await getApiKeyStatuses(workspaceRoot)),
);

app.put("/api/settings/secrets/:provider", async (req, reply) => {
  const { provider } = z
    .object({ provider: AiProviderSchema })
    .parse(req.params);
  const { apiKey } = z
    .object({ apiKey: z.string().trim().min(10).max(512) })
    .parse(req.body ?? {});
  await saveApiKey(workspaceRoot, provider, apiKey);
  return reply.code(200).send({
    ok: true,
    ...toPublicApiKeyStatuses(await getApiKeyStatuses(workspaceRoot)),
  });
});

app.delete("/api/settings/secrets/:provider", async (req, reply) => {
  const { provider } = z
    .object({ provider: AiProviderSchema })
    .parse(req.params);
  await clearApiKey(workspaceRoot, provider);
  return reply.code(200).send({
    ok: true,
    ...toPublicApiKeyStatuses(await getApiKeyStatuses(workspaceRoot)),
  });
});

app.get("/api/projects/:projectId/settings", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const parsed = settingsBodySchema.safeParse(access.project.settingsJson);
  return parsed.success ? parsed.data : readSettings(workspaceRoot);
});

app.put("/api/projects/:projectId/settings", async (req, reply) => {
  const { projectId } = projectIdParamSchema.parse(req.params);
  const access = await getProjectAccess(projectId, req.headers["x-user-id"]);
  if (!access.ok) {
    return reply.code(access.statusCode).send({ error: access.error });
  }
  const settings = settingsBodySchema.parse(req.body ?? {});
  await prisma.project.update({
    where: { id: projectId },
    data: { settingsJson: settings as Prisma.InputJsonValue },
  });
  return reply.code(200).send({ ok: true });
});

app.get("/api/settings/diagnostics", async () => {
  const [apiKeys, apiKeyStatuses] = await Promise.all([
    resolveApiKeys(workspaceRoot),
    getApiKeyStatuses(workspaceRoot),
  ]);
  return buildSettingsDiagnostics({
    apiKeys,
    apiKeySources: {
      google: apiKeyStatuses.google.source,
      openai: apiKeyStatuses.openai.source,
      anthropic: apiKeyStatuses.anthropic.source,
    },
  });
});

app.get("/api/templates", async () => {
  return listTemplates(workspaceRoot);
});

app.post("/api/templates", async (req, reply) => {
  const template = z
    .object({
      id: z.string(),
      sourceProjectId: z.string().uuid().optional(),
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

  const safeTemplate = {
    ...template,
    id: normalizeTemplateId(template.id),
  };

  let packagedAssets = safeTemplate.assets;
  if (safeTemplate.assets?.length) {
    if (!safeTemplate.sourceProjectId) {
      return reply.code(400).send({ error: "source_project_required" });
    }
    const access = await getProjectAccess(
      safeTemplate.sourceProjectId,
      req.headers["x-user-id"],
    );
    if (!access.ok) {
      return reply.code(access.statusCode).send({ error: access.error });
    }
    const sourceAssets = safeTemplate.assets.map((asset) => ({
      ...asset,
      relativePath: normalizeAssetRelativePath(
        safeTemplate.sourceProjectId!,
        asset.relativePath,
      ),
    }));
    packagedAssets = await packageTemplateAssets(
      workspaceRoot,
      safeTemplate.id,
      sourceAssets,
    );
  }

  const { sourceProjectId: _sourceProjectId, ...storedTemplate } = safeTemplate;
  await createTemplate(workspaceRoot, {
    ...storedTemplate,
    assets: packagedAssets,
  });
  return reply.code(201).send({ ok: true, id: safeTemplate.id });
});

const createAndEnqueueJob = async (
  project: NonNullable<Awaited<ReturnType<typeof prisma.project.findUnique>>>,
  workflowRequest: ReturnType<typeof resolveWorkflowJobRequest>,
): Promise<{ ok: true; jobId: string } | { ok: false; jobId: string }> => {
  const parsedSettings = settingsBodySchema.safeParse(project.settingsJson);
  const settings = parsedSettings.success
    ? parsedSettings.data
    : await readSettings(workspaceRoot);
  const inputRevision = await computeProjectInputRevision(
    workspaceRoot,
    project.id,
    settings,
  );
  const runMode = workflowRequest.runMode ?? "resume";
  const job = await prisma.job.create({
    data: {
      projectId: project.id,
      mode: workflowRequest.mode,
      runMode,
      ...(workflowRequest.skipSteps
        ? { skipSteps: workflowRequest.skipSteps as Prisma.InputJsonValue }
        : {}),
      ...(workflowRequest.forceSteps
        ? { forceSteps: workflowRequest.forceSteps as Prisma.InputJsonValue }
        : {}),
      settingsJson: settings as Prisma.InputJsonValue,
      inputRevision,
    },
  });
  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: "PENDING",
      automationMode: workflowRequest.mode,
    },
  });

  try {
    const queueJobId = await boss.send("yukkuri.render", {
      jobId: job.id,
      runMode,
      skipSteps: workflowRequest.skipSteps,
      forceSteps: workflowRequest.forceSteps,
    });
    if (!queueJobId) {
      throw new Error("pg-boss did not accept the job");
    }
    return { ok: true, jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$transaction([
      prisma.job.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: `Queue submission failed: ${message}`,
          completedAt: new Date(),
        },
      }),
      prisma.project.update({
        where: { id: project.id },
        data: { status: "FAILED" },
      }),
    ]);
    return { ok: false, jobId: job.id };
  }
};

const readWorkflowLogs = async (projectId: string): Promise<string[]> => {
  const logPath = path.join(
    workspaceRoot,
    "projects",
    projectId,
    "logs",
    "workflow.log",
  );
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

const readMultipartAsset = async (
  req: FastifyRequest,
  projectId: string,
): Promise<{
  fields: Record<string, string>;
  assetId: string;
  extension: string;
  tempPath: string;
}> => {
  const assetId = `asset-${randomUUID()}`;
  const tempDirectory = path.join(
    workspaceRoot,
    "projects",
    projectId,
    "tmp",
    "uploads",
  );
  const tempPath = path.join(tempDirectory, `${assetId}.upload`);
  await fs.mkdir(tempDirectory, { recursive: true });
  const fields: Record<string, string> = {};
  let extension = "";
  let fileReceived = false;

  try {
    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (fileReceived) {
          throw new Error("Only one asset file is allowed.");
        }
        extension = path.extname(part.filename).slice(1).toLowerCase();
        validateUploadedAsset(extension, part.mimetype);
        await pipeline(part.file, createWriteStream(tempPath, { flags: "wx" }));
        fileReceived = true;
      } else {
        fields[part.fieldname] = String(part.value ?? "");
      }
    }
    if (!fileReceived) {
      throw new Error("Asset file is required for multipart upload.");
    }
    return { fields, assetId, extension, tempPath };
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
};

const validateUploadedAsset = (extension: string, mimeType: string): void => {
  const allowedMimeByExtension: Record<string, string[]> = {
    png: ["image/png"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    webp: ["image/webp"],
    wav: ["audio/wav", "audio/x-wav"],
    mp3: ["audio/mpeg"],
    m4a: ["audio/mp4", "audio/x-m4a"],
    mp4: ["video/mp4"],
    webm: ["video/webm"],
    ass: ["text/plain", "application/octet-stream"],
    srt: ["text/plain", "application/x-subrip"],
    vtt: ["text/vtt", "text/plain"],
    json: ["application/json", "text/json"],
  };
  if (!allowedMimeByExtension[extension]?.includes(mimeType.toLowerCase())) {
    throw new Error("Uploaded file extension and MIME type are not allowed.");
  }
};

const sendLocalFile = async (
  req: FastifyRequest,
  reply: FastifyReply,
  targetPath: string,
): Promise<FastifyReply> => {
  const stat = await fs.stat(targetPath);
  const range = readByteRange(req.headers.range, stat.size);
  const download =
    (req.query as { download?: string } | undefined)?.download === "1";
  reply.header("Accept-Ranges", "bytes");
  reply.header(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${path.basename(targetPath).replaceAll('"', "")}"`,
  );
  reply.type(guessContentType(targetPath));

  if (range === "invalid") {
    return reply
      .code(416)
      .header("Content-Range", `bytes */${stat.size}`)
      .send();
  }
  if (range) {
    reply.code(206);
    reply.header(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${stat.size}`,
    );
    reply.header("Content-Length", String(range.end - range.start + 1));
    return reply.send(createReadStream(targetPath, range));
  }
  reply.header("Content-Length", String(stat.size));
  return reply.send(createReadStream(targetPath));
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
  templateId: string,
  assets: Array<{
    id: string;
    type: "audio" | "subtitle" | "image" | "video" | "script" | "metadata";
    name: string;
    relativePath: string;
    usage?: "background" | "character" | "bgm" | "se" | "reference" | "other";
    createdAt: string;
  }>,
): Promise<void> => {
  const sourcePrefix = `outputs/system/template-assets/${normalizeTemplateId(templateId)}/`;
  for (const asset of assets) {
    const sourceRelativePath = normalizeProjectRelativePath(asset.relativePath);
    if (!sourceRelativePath.startsWith(sourcePrefix)) {
      throw new Error(
        "Template asset escaped the packaged template asset directory.",
      );
    }
    const sourcePath = resolveSafeChildPath(workspaceRoot, sourceRelativePath);
    const usageDirectory = assetUsageDirectory(asset.usage);
    const targetRelativePath = path
      .join(
        "projects",
        projectId,
        "input",
        "assets",
        usageDirectory,
        path.basename(sourceRelativePath),
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
      relativePath: (await fileExists(targetPath))
        ? targetRelativePath
        : sourceRelativePath,
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

const readWorkerHeartbeat = async (): Promise<{
  reachable: boolean;
  ageMs?: number;
}> => {
  try {
    const heartbeatPath = path.join(
      workspaceRoot,
      "outputs",
      "system",
      "worker-heartbeat.json",
    );
    const heartbeat = JSON.parse(await fs.readFile(heartbeatPath, "utf-8")) as {
      at?: string;
    };
    const ageMs = Date.now() - new Date(heartbeat.at ?? 0).getTime();
    return {
      reachable: Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 20_000,
      ageMs,
    };
  } catch {
    return { reachable: false };
  }
};

// APIは127.0.0.1限定の単一ユーザーアプリとして扱い、任意ヘッダーによるなりすましを許可しない。
const getRequestUserId = (_headerValue: unknown): string => "default";

const getProjectAccess = async (
  projectId: string,
  requestUserIdHeader: unknown,
): Promise<
  | {
      ok: true;
      project: NonNullable<
        Awaited<ReturnType<typeof prisma.project.findUnique>>
      >;
      ownerId: string | null;
    }
  | { ok: false; statusCode: 403 | 404; error: "forbidden" | "not_found" }
> => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return { ok: false, statusCode: 404, error: "not_found" };
  }

  const ownerId = project.ownerId;
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
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        toJsonSafeValue(nestedValue),
      ]),
    );
  }
  return value;
};

async function main() {
  await boss.start();
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen({ port, host: "127.0.0.1" });
  const shutdown = async () => {
    await app.close();
    await boss.stop({ graceful: true, timeout: 30_000 });
    await prisma.$disconnect();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
