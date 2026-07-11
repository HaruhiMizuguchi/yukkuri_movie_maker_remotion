type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type CliDependencies = {
  fetch?: FetchLike;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  apiBase?: string;
};

const helpText = `yukkuri CLI

Commands:
  health                              API/DB/Workerの状態を確認
  run --theme <テーマ> [--mode <mode>] 新規プロジェクトとジョブを作成
  job <jobId>                         ジョブ状態を確認
  config:test                         APIキー・AivisSpeechの接続診断

Modes: full | scriptOnly | renderOnly | custom`;

export const executeCli = async (
  args: string[],
  dependencies: CliDependencies = {},
): Promise<number> => {
  const fetchFn = dependencies.fetch ?? fetch;
  const stdout = dependencies.stdout ?? console.log;
  const stderr = dependencies.stderr ?? console.error;
  const apiBase = (
    dependencies.apiBase ??
    process.env.YMM_API_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
  const command = args[0] ?? "help";

  try {
    if (command === "help" || command === "--help" || command === "-h") {
      stdout(helpText);
      return 0;
    }
    if (command === "health") {
      stdout(formatJson(await requestJson(fetchFn, `${apiBase}/health`)));
      return 0;
    }
    if (command === "config:test") {
      stdout(
        formatJson(
          await requestJson(fetchFn, `${apiBase}/api/settings/diagnostics`),
        ),
      );
      return 0;
    }
    if (command === "job") {
      const jobId = requireValue(args[1], "jobId");
      stdout(
        formatJson(await requestJson(fetchFn, `${apiBase}/api/jobs/${jobId}`)),
      );
      return 0;
    }
    if (command === "run") {
      const theme = getOption(args, "--theme") ?? "ゆっくり解説";
      const mode = getOption(args, "--mode") ?? "full";
      if (!["full", "scriptOnly", "renderOnly", "custom"].includes(mode)) {
        throw new Error(`不正なmodeです: ${mode}`);
      }
      const result = await requestJson(fetchFn, `${apiBase}/api/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme, mode }),
      });
      stdout(formatJson(result));
      return 0;
    }
    throw new Error(`不明なコマンドです: ${command}\n\n${helpText}`);
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
};

const requestJson = async (
  fetchFn: FetchLike,
  url: string,
  init?: RequestInit,
): Promise<unknown> => {
  const response = await fetchFn(url, init);
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const reason =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `${response.status} ${response.statusText}`;
    throw new Error(`APIリクエストに失敗しました: ${reason}`);
  }
  return body;
};

const getOption = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? requireValue(args[index + 1], name) : undefined;
};

const requireValue = (value: string | undefined, label: string): string => {
  if (!value || value.startsWith("--"))
    throw new Error(`${label} を指定してください。`);
  return value;
};

const formatJson = (value: unknown): string => JSON.stringify(value, null, 2);
