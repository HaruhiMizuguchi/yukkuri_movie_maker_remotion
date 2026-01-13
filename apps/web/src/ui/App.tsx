import React, { useState } from "react";

type CreateJobResponse = { projectId: string; jobId: string };

type ApiError = { error: string; message?: string };

type LastResponse = CreateJobResponse | ApiError | Record<string, unknown> | null;

export function App() {
  const [theme, setTheme] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<LastResponse>(null);

  async function createJob() {
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme || undefined, mode: "full" }),
      });
      const json = (await res.json()) as CreateJobResponse | ApiError;
      setLastResponse(json);
      if (res.ok && "jobId" in json) {
        setJobId(json.jobId);
      }
    } catch (err) {
      setLastResponse({ error: "network_error", message: String(err) });
    }
  }

  async function refreshJob() {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const json = (await res.json()) as Record<string, unknown>;
      setLastResponse(json);
    } catch (err) {
      setLastResponse({ error: "network_error", message: String(err) });
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>ゆっくり動画メーカー (Remotion) - Web GUI</h1>
      <p style={{ color: "#555" }}>
        レンダリングジョブを作成し、API/ワーカーの状態を確認する最小構成のGUIです。
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="テーマ（任意）"
          style={{ flex: 1, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
        <button onClick={createJob} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333" }}>
          ジョブ作成
        </button>
        <button
          onClick={refreshJob}
          disabled={!jobId}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #aaa" }}
        >
          更新
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#666" }}>jobId: {jobId ?? "（未作成）"}</div>
        <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 8, overflowX: "auto" }}>
          {JSON.stringify(lastResponse, null, 2)}
        </pre>
      </div>
    </div>
  );
}
