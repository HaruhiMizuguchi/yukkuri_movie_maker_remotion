import React, { useMemo, useState } from "react";

type CreateJobResponse = { projectId: string; jobId: string };

export function App() {
  const [theme, setTheme] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const apiBase = useMemo(() => "http://127.0.0.1:3001", []);

  async function createJob() {
    const res = await fetch(`${apiBase}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: theme || undefined, mode: "full" }),
    });
    const json = (await res.json()) as CreateJobResponse;
    setJobId(json.jobId);
    setLastResponse(json);
  }

  async function refreshJob() {
    if (!jobId) return;
    const res = await fetch(`${apiBase}/api/jobs/${jobId}`);
    const json = await res.json();
    setLastResponse(json);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Yukkuri Movie Maker (Remotion) - Web GUI</h1>
      <p style={{ color: "#555" }}>
        ここは最小の雛形です。ジョブ作成→Workerが処理→進捗/結果を参照、の流れをまず繋げます。
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="テーマ（任意）"
          style={{ flex: 1, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
        <button onClick={createJob} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333" }}>
          生成開始
        </button>
        <button
          onClick={refreshJob}
          disabled={!jobId}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #aaa" }}
        >
          状態更新
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#666" }}>jobId: {jobId ?? "(none)"}</div>
        <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 8, overflowX: "auto" }}>
          {JSON.stringify(lastResponse, null, 2)}
        </pre>
      </div>
    </div>
  );
}

