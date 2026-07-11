import { describe, expect, it, vi } from "vitest";
import { executeCli } from "./cli";

describe("executeCli", () => {
  it("runでテーマと自動化モードをAPIへ送る", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ projectId: "project-1", jobId: "job-1" }),
          {
            status: 201,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const output: string[] = [];

    const exitCode = await executeCli(
      ["run", "--theme", "宇宙", "--mode", "scriptOnly"],
      {
        fetch: fetchMock,
        stdout: (line) => output.push(line),
        stderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ theme: "宇宙", mode: "scriptOnly" }),
      }),
    );
    expect(output.join("\n")).toContain("job-1");
  });

  it("APIエラーを終了コード1と分かるメッセージにする", async () => {
    const errors: string[] = [];
    const exitCode = await executeCli(["health"], {
      fetch: async () =>
        new Response(JSON.stringify({ error: "database_down" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      stdout: vi.fn(),
      stderr: (line) => errors.push(line),
    });

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("database_down");
  });
});
