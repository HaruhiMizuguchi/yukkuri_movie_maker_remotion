import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { WORKFLOW_STEPS, type WorkflowStepName } from "@ymm/shared";

const CACHE_MANIFEST_NAME = ".cache-manifest.json";

export const computeWorkflowStepFingerprint = async ({
  projectRoot,
  stepName,
  signature,
}: {
  projectRoot: string;
  stepName: WorkflowStepName;
  signature: Record<string, unknown>;
}): Promise<string> => {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(sortObject(signature)));

  const stepIndex = WORKFLOW_STEPS.indexOf(stepName);
  const inputDirectories = [
    path.join(projectRoot, "input"),
    path.join(projectRoot, "intermediate"),
    ...WORKFLOW_STEPS.slice(0, Math.max(0, stepIndex)).map((dependency) =>
      path.join(projectRoot, "output", dependency, "latest"),
    ),
  ];

  for (const directoryPath of inputDirectories) {
    for (const filePath of await listFilesRecursively(directoryPath)) {
      hash.update(path.relative(projectRoot, filePath).replaceAll("\\", "/"));
      hash.update(await fs.readFile(filePath));
    }
  }

  return hash.digest("hex");
};

export const hasValidWorkflowCache = async (
  projectRoot: string,
  stepName: WorkflowStepName,
  targetPath: string,
  fingerprint: string,
): Promise<boolean> => {
  if (!(await fileExists(targetPath))) {
    return false;
  }
  try {
    const manifest = JSON.parse(
      await fs.readFile(getManifestPath(projectRoot, stepName), "utf-8"),
    ) as { fingerprint?: unknown };
    return manifest.fingerprint === fingerprint;
  } catch {
    return false;
  }
};

export const writeWorkflowCacheManifest = async (
  projectRoot: string,
  stepName: WorkflowStepName,
  fingerprint: string,
): Promise<void> => {
  const manifestPath = getManifestPath(projectRoot, stepName);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({ version: 1, fingerprint }, null, 2)}\n`,
    "utf-8",
  );
};

const getManifestPath = (
  projectRoot: string,
  stepName: WorkflowStepName,
): string =>
  path.join(projectRoot, "output", stepName, "latest", CACHE_MANIFEST_NAME);

const listFilesRecursively = async (
  directoryPath: string,
): Promise<string[]> => {
  if (!(await fileExists(directoryPath))) {
    return [];
  }
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== CACHE_MANIFEST_NAME)
      .map(async (entry) => {
        const entryPath = path.join(directoryPath, entry.name);
        return entry.isDirectory()
          ? listFilesRecursively(entryPath)
          : [entryPath];
      }),
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortObject(nested)]),
    );
  }
  return value;
};
