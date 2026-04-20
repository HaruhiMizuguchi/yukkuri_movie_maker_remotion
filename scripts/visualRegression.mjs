import { mkdir, readdir, readFile, copyFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export const DEFAULT_BASELINE_DIR = path.join("e2e", "visual-baselines");
export const DEFAULT_DIFF_DIR = path.join("outputs", "test_evidence", "visual_regression");
export const DEFAULT_THRESHOLD_RATIO = 0.01;

export async function findLatestManifestPaths(
  evidenceRoot = path.join("outputs", "test_evidence", "customer_journey")
) {
  if (!existsSync(evidenceRoot)) {
    return [];
  }
  const runDirs = await readdir(evidenceRoot, { withFileTypes: true });
  const manifestCandidates = [];
  for (const runDir of runDirs.filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    const runPath = path.join(evidenceRoot, runDir);
    const projectDirs = await readdir(runPath, { withFileTypes: true });
    for (const manifestPath of projectDirs
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(runPath, entry.name, "visual-regression-manifest.json"))
      .filter((candidatePath) => existsSync(candidatePath))) {
      manifestCandidates.push({
        manifestPath,
        projectName: path.basename(path.dirname(manifestPath)),
        mtimeMs: (await stat(manifestPath)).mtimeMs,
      });
    }
  }

  const latestByProject = new Map();
  for (const candidate of manifestCandidates.sort((left, right) => right.mtimeMs - left.mtimeMs)) {
    if (!latestByProject.has(candidate.projectName)) {
      latestByProject.set(candidate.projectName, candidate.manifestPath);
    }
  }
  return Array.from(latestByProject.values()).sort();
}

export async function loadManifest(manifestPath) {
  const raw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.checkpoints)) {
    throw new Error(`manifest checkpoints are missing: ${manifestPath}`);
  }
  return manifest;
}

export async function compareManifest(manifestPath, options = {}) {
  const manifest = await loadManifest(manifestPath);
  const baselineDir = options.baselineDir ?? DEFAULT_BASELINE_DIR;
  const diffDir = options.diffDir ?? DEFAULT_DIFF_DIR;
  const thresholdRatio = options.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO;
  const update = options.update ?? false;
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const projectName = sanitizePathSegment(manifest.projectName ?? path.basename(path.dirname(manifestPath)));
  const results = [];

  for (const checkpoint of manifest.checkpoints) {
    const id = sanitizePathSegment(checkpoint.id);
    const currentPath = path.resolve(workspaceRoot, checkpoint.screenshotPath);
    const baselinePath = path.resolve(workspaceRoot, baselineDir, projectName, `${id}.png`);
    const diffPath = path.resolve(workspaceRoot, diffDir, projectName, `${id}.diff.png`);

    if (!existsSync(currentPath)) {
      results.push({
        id: checkpoint.id,
        status: "failed",
        reason: "current_screenshot_missing",
        currentPath: toPortablePath(path.relative(workspaceRoot, currentPath)),
        baselinePath: toPortablePath(path.relative(workspaceRoot, baselinePath)),
      });
      continue;
    }

    if (update || !existsSync(baselinePath)) {
      if (!update) {
        results.push({
          id: checkpoint.id,
          status: "failed",
          reason: "baseline_missing",
          currentPath: toPortablePath(path.relative(workspaceRoot, currentPath)),
          baselinePath: toPortablePath(path.relative(workspaceRoot, baselinePath)),
        });
        continue;
      }
      await mkdir(path.dirname(baselinePath), { recursive: true });
      await copyFile(currentPath, baselinePath);
      results.push({
        id: checkpoint.id,
        status: "updated",
        currentPath: toPortablePath(path.relative(workspaceRoot, currentPath)),
        baselinePath: toPortablePath(path.relative(workspaceRoot, baselinePath)),
      });
      continue;
    }

    const comparison = await comparePngFiles(currentPath, baselinePath, diffPath);
    const status = comparison.diffRatio <= thresholdRatio ? "passed" : "failed";
    results.push({
      id: checkpoint.id,
      status,
      reason: status === "failed" ? "diff_ratio_exceeded" : undefined,
      diffRatio: comparison.diffRatio,
      diffPixels: comparison.diffPixels,
      totalPixels: comparison.totalPixels,
      width: comparison.width,
      height: comparison.height,
      thresholdRatio,
      currentPath: toPortablePath(path.relative(workspaceRoot, currentPath)),
      baselinePath: toPortablePath(path.relative(workspaceRoot, baselinePath)),
      diffPath: toPortablePath(path.relative(workspaceRoot, diffPath)),
    });
  }

  const failedCount = results.filter((result) => result.status === "failed").length;
  return {
    manifestPath: toPortablePath(path.relative(workspaceRoot, path.resolve(workspaceRoot, manifestPath))),
    projectName,
    thresholdRatio,
    update,
    failedCount,
    results,
  };
}

export async function comparePngFiles(currentPath, baselinePath, diffPath) {
  const [current, baseline] = await Promise.all([readPng(currentPath), readPng(baselinePath)]);
  if (current.width !== baseline.width || current.height !== baseline.height) {
    await mkdir(path.dirname(diffPath), { recursive: true });
    await writeFile(
      `${diffPath}.dimension-mismatch.txt`,
      `current=${current.width}x${current.height}\nbaseline=${baseline.width}x${baseline.height}\n`,
      "utf-8"
    );
    return {
      width: current.width,
      height: current.height,
      totalPixels: Math.max(current.width * current.height, baseline.width * baseline.height),
      diffPixels: Number.POSITIVE_INFINITY,
      diffRatio: Number.POSITIVE_INFINITY,
    };
  }

  const diff = new PNG({ width: current.width, height: current.height });
  const diffPixels = pixelmatch(
    current.data,
    baseline.data,
    diff.data,
    current.width,
    current.height,
    { threshold: 0.1 }
  );
  await mkdir(path.dirname(diffPath), { recursive: true });
  await writeFile(diffPath, PNG.sync.write(diff));
  const totalPixels = current.width * current.height;
  return {
    width: current.width,
    height: current.height,
    totalPixels,
    diffPixels,
    diffRatio: totalPixels === 0 ? 1 : diffPixels / totalPixels,
  };
}

export async function runVisualRegressionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const manifests = args.manifest
    ? [args.manifest]
    : await findLatestManifestPaths(args.evidenceRoot);
  if (manifests.length === 0) {
    throw new Error("visual-regression-manifest.json was not found");
  }

  const reports = [];
  for (const manifestPath of manifests) {
    reports.push(
      await compareManifest(manifestPath, {
        baselineDir: args.baselineDir,
        diffDir: args.diffDir,
        thresholdRatio: args.thresholdRatio,
        update: args.update,
      })
    );
  }

  const report = {
    createdAt: new Date().toISOString(),
    reports,
    failedCount: reports.reduce((sum, item) => sum + item.failedCount, 0),
  };
  const reportPath = path.join(args.diffDir, "visual-regression-report.json");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  if (report.failedCount > 0) {
    throw new Error(`visual regression failed: ${report.failedCount} checkpoint(s)`);
  }
  return report;
}

export function parseArgs(argv) {
  const args = {
    baselineDir: DEFAULT_BASELINE_DIR,
    diffDir: DEFAULT_DIFF_DIR,
    evidenceRoot: path.join("outputs", "test_evidence", "customer_journey"),
    manifest: null,
    thresholdRatio: DEFAULT_THRESHOLD_RATIO,
    update: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--update") {
      args.update = true;
    } else if (item === "--manifest") {
      args.manifest = argv[++index];
    } else if (item === "--evidence-root") {
      args.evidenceRoot = argv[++index];
    } else if (item === "--baseline-dir") {
      args.baselineDir = argv[++index];
    } else if (item === "--diff-dir") {
      args.diffDir = argv[++index];
    } else if (item === "--threshold-ratio") {
      args.thresholdRatio = Number(argv[++index]);
    }
  }

  if (!Number.isFinite(args.thresholdRatio) || args.thresholdRatio < 0) {
    throw new Error(`invalid --threshold-ratio: ${args.thresholdRatio}`);
  }
  return args;
}

const readPng = async (targetPath) => PNG.sync.read(await readFile(targetPath));

const sanitizePathSegment = (value) => String(value).replace(/[^a-z0-9._-]/gi, "_");

const toPortablePath = (targetPath) => targetPath.replaceAll("\\", "/");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVisualRegressionCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
