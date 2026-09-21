import { describe, expect, it } from "vitest";

import { styles, styleText } from "./styles";

describe("ビジュアルテーマ", () => {
  it("落ち着いた暗色サーフェスと単一の紫アクセントを定義する", () => {
    expect(styleText).toContain("--bg: #0b0b0f");
    expect(styleText).toContain("--surface: #14151b");
    expect(styleText).toContain("--surface-raised: #1a1b22");
    expect(styleText).toContain("--accent: #8b5cf6");
    expect(styleText).toContain("--border-subtle: rgba(255, 255, 255, 0.08)");
    expect(styleText).not.toContain("--accent: #22d3ee");
  });

  it("日本語を読みやすいシステムUI書体と明瞭なフォーカスを使う", () => {
    expect(styleText).toContain('font-family: Inter, "Noto Sans JP"');
    expect(styleText).toContain("outline: 3px solid rgba(167, 139, 250, 0.82)");
    expect(styleText).toContain("color-scheme: dark");
  });

  it("主要な面と操作を共通トークンへ接続する", () => {
    expect(styles.panel?.background).toBe("var(--surface)");
    expect(styles.panel?.border).toBe("1px solid var(--border-subtle)");
    expect(styles.primaryButton?.background).toContain("var(--accent)");
    expect(styles.input?.background).toBe("var(--surface-base)");
  });
});
