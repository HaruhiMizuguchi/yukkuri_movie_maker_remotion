import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const guideRoot = path.join(process.cwd(), "docs", "user_guide");
const guidePath = path.join(guideRoot, "full_auto_operation_guide.html");

describe("全自動操作HTML手順書", () => {
  it("修正後の開始表示と完成確認までの手順を含む", async () => {
    const html = await fs.readFile(guidePath, "utf-8");

    expect(html).toContain("この内容で全自動制作を開始");
    expect(html).toContain("全自動で完成動画の生成を開始しました");
    expect(html).toContain("完成動画をダウンロード");
    expect(html).toContain(
      "プロジェクトは作成されましたが、自動生成を開始できませんでした",
    );
  });

  it("参照する実画面スクリーンショットがすべて有効なJPEGである", async () => {
    const html = await fs.readFile(guidePath, "utf-8");
    const imagePaths = [...html.matchAll(/<img\s+src="([^"]+\.jpg)"/g)].map(
      (match) => match[1],
    );

    expect(imagePaths).toHaveLength(5);
    for (const relativePath of imagePaths) {
      const bytes = await fs.readFile(path.join(guideRoot, relativePath));
      expect(bytes.length).toBeGreaterThan(20_000);
      expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    }
  });
});
