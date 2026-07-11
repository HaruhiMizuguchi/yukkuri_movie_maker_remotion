import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { syncLatestAtomically } from "./atomicLatest";

describe("syncLatestAtomically", () => {
  it("新しいrunをlatestへ置換して一時ディレクトリを残さない", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ymm-latest-"));
    const runDir = path.join(root, "run-2");
    const latestDir = path.join(root, "latest");
    await fs.mkdir(runDir, { recursive: true });
    await fs.mkdir(latestDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "value.txt"), "new", "utf-8");
    await fs.writeFile(path.join(latestDir, "value.txt"), "old", "utf-8");
    await syncLatestAtomically({ runDir, latestDir });
    await expect(
      fs.readFile(path.join(latestDir, "value.txt"), "utf-8"),
    ).resolves.toBe("new");
    expect(
      (await fs.readdir(root)).filter((name) => name.startsWith(".latest-")),
    ).toEqual([]);
  });

  it("Windowsで一時的にrenameが拒否されても再試行する", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ymm-latest-retry-"));
    const runDir = path.join(root, "run-1");
    const latestDir = path.join(root, "latest");
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "value.txt"), "new", "utf-8");
    const originalRename = fs.rename.bind(fs);
    let transientFailures = 0;
    const renameSpy = vi
      .spyOn(fs, "rename")
      .mockImplementation(async (source, target) => {
        if (
          String(source).includes(".latest-staging-") &&
          transientFailures < 2
        ) {
          transientFailures += 1;
          const error = new Error(
            "temporarily locked",
          ) as NodeJS.ErrnoException;
          error.code = "EPERM";
          throw error;
        }
        return originalRename(source, target);
      });

    try {
      await syncLatestAtomically({ runDir, latestDir });
    } finally {
      renameSpy.mockRestore();
    }

    expect(transientFailures).toBe(2);
    await expect(
      fs.readFile(path.join(latestDir, "value.txt"), "utf-8"),
    ).resolves.toBe("new");
  });
});
