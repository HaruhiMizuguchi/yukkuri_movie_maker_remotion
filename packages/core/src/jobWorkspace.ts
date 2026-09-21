import { createHash, randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { syncLatestAtomically } from "./atomicLatest";
import type { PrismaClient } from "@prisma/client";

export const withProjectInputLock = <T>(
  prisma: PrismaClient,
  projectId: string,
  task: () => Promise<T>,
): Promise<T> =>
  prisma.$transaction(
    async (tx) => {
      // 生成全体の排他とは別に、短い入力保存・snapshot・公開操作を同期する。
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`input:${projectId}`}, 0))::text`;
      return task();
    },
    { maxWait: 120000, timeout: 120000 },
  );

type JobPaths = {
  workspaceRoot: string;
  outputRoot: string;
  projectId: string;
  jobId: string;
};
type Manifest = {
  revision: string;
  settings: unknown;
  sourceRevision: string;
  theme?: string | null;
};

const paths = (options: JobPaths) => {
  for (const id of [options.projectId, options.jobId]) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id))
      throw new Error("invalid_job_workspace_id");
  }
  const project = path.resolve(
    options.outputRoot,
    "projects",
    options.projectId,
  );
  const directory = path.join(project, "jobs", options.jobId);
  return {
    project,
    directory,
    snapshot: path.join(directory, "snapshot"),
    work: path.join(directory, "work"),
  };
};

const exists = async (file: string) =>
  fs.stat(file).then(
    () => true,
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );

const files = async (directory: string): Promise<string[]> => {
  if (!(await exists(directory))) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? files(file) : Promise.resolve([file]);
    }),
  );
  return nested.flat().sort();
};

const fingerprint = async (
  root: string,
  directories: string[],
  settings: unknown = {},
) => {
  const hash = createHash("sha256").update(JSON.stringify(settings));
  for (const directory of directories) {
    for (const file of await files(path.join(root, directory))) {
      hash.update(path.relative(root, file).replaceAll("\\", "/"));
      // 大きな動画もメモリーに一括展開せず検証する。
      for await (const chunk of createReadStream(file)) hash.update(chunk);
    }
  }
  return hash.digest("hex");
};

const copyIfPresent = async (source: string, destination: string) => {
  if (!(await exists(source))) return;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, dereference: true });
};

export async function captureJobInputs(
  options: JobPaths & { settings: unknown; theme?: string | null },
): Promise<string> {
  const target = paths(options);
  const source = path.resolve(
    options.workspaceRoot,
    "projects",
    options.projectId,
  );
  const sourceRevision = await fingerprint(source, ["input", "intermediate"]);
  await fs.mkdir(target.snapshot, { recursive: true });
  if (await exists(path.join(target.directory, "manifest.json")))
    throw new Error("job_snapshot_already_exists");
  for (const name of ["input", "intermediate"])
    await copyIfPresent(
      path.join(source, name),
      path.join(target.snapshot, name),
    );
  // 再レンダリングに必要な直近成果物だけを取り込み、過去run/jobsを再帰コピーしない。
  const steps = new Set<string>();
  for (const root of [source, target.project]) {
    if (await exists(path.join(root, "output"))) {
      for (const entry of await fs.readdir(path.join(root, "output"), {
        withFileTypes: true,
      }))
        if (entry.isDirectory()) steps.add(entry.name);
    }
  }
  for (const step of steps) {
    const generated = path.join(target.project, "output", step, "latest");
    await copyIfPresent(
      (await exists(generated))
        ? generated
        : path.join(source, "output", step, "latest"),
      path.join(target.snapshot, "output", step, "latest"),
    );
  }
  await copyIfPresent(
    path.join(target.project, "final"),
    path.join(target.snapshot, "final"),
  );
  const manual = path.join(target.snapshot, "input", "manual-script.json");
  if (await exists(manual))
    await copyIfPresent(
      manual,
      path.join(target.snapshot, "output/script_generation/latest/script.json"),
    );
  await copyIfPresent(
    path.join(options.workspaceRoot, "assets"),
    path.join(target.snapshot, "_workspace/assets"),
  );

  // JSON内のプロジェクト絶対参照や外部素材もジョブ専用コピーへ向ける。
  const rewrite = async (value: unknown, key = ""): Promise<unknown> => {
    if (Array.isArray(value))
      return Promise.all(value.map((item) => rewrite(item, key)));
    if (value && typeof value === "object")
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async ([name, item]) => [
            name,
            await rewrite(item, name),
          ]),
        ),
      );
    if (
      typeof value !== "string" ||
      !/(path|src)$/i.test(key) ||
      /^https?:/i.test(value)
    )
      return value;
    const normalized = value.replaceAll("\\", "/");
    let relative = normalized.startsWith(`projects/${options.projectId}/`)
      ? normalized.slice(`projects/${options.projectId}/`.length)
      : null;
    for (const root of [source, target.project]) {
      const prefix = root.replaceAll("\\", "/") + "/";
      if (normalized.startsWith(prefix))
        relative = normalized.slice(prefix.length);
    }
    if (relative && (await exists(path.join(target.snapshot, relative))))
      return path.join(target.work, relative);
    if (normalized.startsWith("assets/"))
      return path.join(target.work, "_workspace", normalized);
    // 単純なプロジェクト相対参照は各工程の新しい成果物へ引き続き解決する。
    if (!path.isAbsolute(value) && !relative) return value;
    const original = path.isAbsolute(value)
      ? value
      : path.resolve(options.outputRoot, normalized);
    if (!(await exists(original)) || !(await fs.stat(original)).isFile())
      return value;
    const name =
      createHash("sha256").update(original).digest("hex") +
      path.extname(original);
    await copyIfPresent(
      original,
      path.join(target.snapshot, "_references", name),
    );
    return path.join(target.work, "_references", name);
  };
  for (const file of await files(target.snapshot)) {
    if (!file.endsWith(".json")) continue;
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    await fs.writeFile(file, JSON.stringify(await rewrite(value), null, 2));
  }
  if (sourceRevision !== (await fingerprint(source, ["input", "intermediate"])))
    throw new Error("project_inputs_changed_during_snapshot");
  const revision = `snapshot-v1:${await fingerprint(target.snapshot, ["."], { settings: options.settings, theme: options.theme })}`;
  const manifest: Manifest = {
    revision,
    settings: options.settings,
    sourceRevision,
    theme: options.theme,
  };
  await fs.writeFile(
    path.join(target.directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  return revision;
}

export async function prepareJobWorkspace(
  options: JobPaths & { inputRevision: string },
): Promise<string> {
  const target = paths(options);
  const manifest: Manifest = JSON.parse(
    await fs.readFile(path.join(target.directory, "manifest.json"), "utf8"),
  );
  const actual = `snapshot-v1:${await fingerprint(target.snapshot, ["."], { settings: manifest.settings, theme: manifest.theme })}`;
  if (
    options.inputRevision !== manifest.revision ||
    actual !== manifest.revision
  )
    throw new Error("job_input_revision_mismatch");
  if (!(await exists(target.work))) {
    const temporary = path.join(target.directory, `preparing-${randomUUID()}`);
    await fs.cp(target.snapshot, temporary, { recursive: true });
    await fs.rename(temporary, target.work);
  }
  return target.work;
}

export async function publishJobOutputs(options: JobPaths): Promise<void> {
  const target = paths(options);
  const manifest: Manifest = JSON.parse(
    await fs.readFile(path.join(target.directory, "manifest.json"), "utf8"),
  );
  const source = path.resolve(
    options.workspaceRoot,
    "projects",
    options.projectId,
  );
  for (const root of new Set([source, target.project])) {
    const output = path.join(target.work, "output");
    if (await exists(output))
      for (const entry of await fs.readdir(output, { withFileTypes: true })) {
        const latest = path.join(output, entry.name, "latest");
        if (entry.isDirectory() && (await exists(latest)))
          await syncLatestAtomically({
            runDir: latest,
            latestDir: path.join(root, "output", entry.name, "latest"),
          });
      }
    if (await exists(path.join(target.work, "final")))
      await syncLatestAtomically({
        runDir: path.join(target.work, "final"),
        latestDir: path.join(root, "final"),
      });
    await copyIfPresent(
      path.join(target.work, "logs/workflow.log"),
      path.join(root, "logs/workflow.log"),
    );
  }
  // 自動尺補正は公開するが、投入後にユーザーが保存した台本・タイムラインを戻さない。
  if (
    (await fingerprint(source, ["input", "intermediate"])) ===
    manifest.sourceRevision
  ) {
    const timeline = path.join(target.work, "intermediate/timeline.json");
    if (await exists(timeline)) {
      const prefix = target.work.replaceAll("\\", "/") + "/";
      const normalize = (value: unknown): unknown => {
        if (
          typeof value === "string" &&
          value.replaceAll("\\", "/").startsWith(prefix)
        ) {
          const relative = value.replaceAll("\\", "/").slice(prefix.length);
          return /^(input|output|final|intermediate)\//.test(relative)
            ? relative
            : value;
        }
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === "object")
          return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, normalize(item)]),
          );
        return value;
      };
      await fs.mkdir(path.join(source, "intermediate"), { recursive: true });
      await fs.writeFile(
        path.join(source, "intermediate/timeline.json"),
        JSON.stringify(
          normalize(JSON.parse(await fs.readFile(timeline, "utf8"))),
          null,
          2,
        ),
      );
    }
  }
}
