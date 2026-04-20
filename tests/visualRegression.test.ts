import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { compareManifest, parseArgs } from "../scripts/visualRegression.mjs";

const createWorkspace = async () => {
  const root = path.join(process.cwd(), "outputs", "test_evidence", "visual-regression-unit", `run-${Date.now()}`);
  await fs.mkdir(root, { recursive: true });
  return root;
};

const writeSolidPng = async (targetPath: string, color: [number, number, number, number]) => {
  const image = new PNG({ width: 4, height: 4 });
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = color[0];
    image.data[index + 1] = color[1];
    image.data[index + 2] = color[2];
    image.data[index + 3] = color[3];
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, PNG.sync.write(image));
};

describe("visualRegression", () => {
  it("引数を解析できる", () => {
    expect(
      parseArgs([
        "--update",
        "--manifest",
        "manifest.json",
        "--threshold-ratio",
        "0.02",
      ])
    ).toMatchObject({
      update: true,
      manifest: "manifest.json",
      thresholdRatio: 0.02,
    });
  });

  it("updateでベースラインを作成し、その後の差分を検出できる", async () => {
    const root = await createWorkspace();
    const screenshotPath = path.join(root, "current.png");
    const manifestPath = path.join(root, "visual-regression-manifest.json");
    const baselineDir = path.join(root, "baseline");
    const diffDir = path.join(root, "diff");

    await writeSolidPng(screenshotPath, [10, 20, 30, 255]);
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify({
        projectName: "unit",
        checkpoints: [
          {
            id: "screen",
            label: "画面",
            screenshotPath: path.relative(process.cwd(), screenshotPath).replaceAll("\\", "/"),
            expectedObservations: ["単色画像"],
          },
        ],
      })}\n`,
      "utf-8"
    );

    const updated = await compareManifest(manifestPath, {
      baselineDir,
      diffDir,
      update: true,
    });
    expect(updated.failedCount).toBe(0);
    expect(updated.results[0].status).toBe("updated");

    const passed = await compareManifest(manifestPath, {
      baselineDir,
      diffDir,
      thresholdRatio: 0,
    });
    expect(passed.failedCount).toBe(0);
    expect(passed.results[0].status).toBe("passed");

    await writeSolidPng(screenshotPath, [200, 20, 30, 255]);
    const failed = await compareManifest(manifestPath, {
      baselineDir,
      diffDir,
      thresholdRatio: 0,
    });
    expect(failed.failedCount).toBe(1);
    expect(failed.results[0].reason).toBe("diff_ratio_exceeded");
  });
});
