import { describe, expect, it, vi } from "vitest";
import { withProjectAdvisoryLock } from "./projectLock";

describe("project advisory lock", () => {
  it("処理の前後で同一プロジェクトのDBロックを取得・解放する", async () => {
    const query = vi.fn().mockResolvedValue({});
    const end = vi.fn().mockResolvedValue(undefined);
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      query,
      end,
    };
    const result = await withProjectAdvisoryLock(
      "postgresql://example",
      "project-1",
      async () => "done",
      () => client,
    );
    expect(result).toBe("done");
    expect(query.mock.calls[0]?.[0]).toContain("pg_advisory_lock");
    expect(query.mock.calls.at(-1)?.[0]).toContain("pg_advisory_unlock");
    expect(end).toHaveBeenCalled();
  });
});
