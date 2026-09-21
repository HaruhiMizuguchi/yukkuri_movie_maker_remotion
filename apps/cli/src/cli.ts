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
  automation status                   自動運用の設定・投稿・分析状態を確認
  automation collect                  YouTube視聴データを今すぐ収集
  automation themes                   次回テーマ候補を今すぐ評価
  automation run                      閉ループ自動運用を今すぐ1回実行
  automation config [options]         自動運用設定を表示・更新

Automation config options:
  --enabled <true|false> --interval-hours <hours>
  --next-run-at <ISO|null> --privacy <private|unlisted|public>
  --publish-delay-minutes <minutes> --daily-upload-limit <count>
  --mock-when-unavailable <true|false> --topic-seed <テーマ>

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
    if (command === "automation") {
      const subcommand = args[1] ?? "status";
      if (subcommand === "status") {
        stdout(
          formatJson(
            await requestJson(fetchFn, `${apiBase}/api/automation/status`),
          ),
        );
        return 0;
      }
      if (["collect", "themes", "run"].includes(subcommand)) {
        const result = await requestJson(
          fetchFn,
          `${apiBase}/api/automation/${subcommand}`,
          { method: "POST" },
        );
        stdout(formatJson(result));
        return 0;
      }
      if (subcommand === "config") {
        const current = await requestJson(
          fetchFn,
          `${apiBase}/api/automation/config`,
        );
        const hasUpdates = args.slice(2).some((arg) => arg.startsWith("--"));
        if (!hasUpdates) {
          stdout(formatJson(current));
          return 0;
        }
        const config = updateAutomationConfigFromArgs(current, args.slice(2));
        const updated = await requestJson(
          fetchFn,
          `${apiBase}/api/automation/config`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(config),
          },
        );
        stdout(formatJson(updated));
        return 0;
      }
      throw new Error(`不明なautomationコマンドです: ${subcommand}`);
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

const updateAutomationConfigFromArgs = (
  current: unknown,
  args: string[],
): Record<string, unknown> => {
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    throw new Error("自動運用設定の取得結果が不正です。");
  }
  const config = { ...(current as Record<string, unknown>) };
  delete config.id;
  delete config.createdAt;
  delete config.updatedAt;
  const booleanOption = (name: string): boolean | undefined => {
    const value = getOption(args, name);
    if (value === undefined) return undefined;
    if (value !== "true" && value !== "false") {
      throw new Error(`${name} はtrueまたはfalseで指定してください。`);
    }
    return value === "true";
  };
  const numberOption = (name: string): number | undefined => {
    const value = getOption(args, name);
    if (value === undefined) return undefined;
    const number = Number(value);
    if (!Number.isInteger(number)) {
      throw new Error(`${name} は整数で指定してください。`);
    }
    return number;
  };
  const enabled = booleanOption("--enabled");
  const mockWhenApiUnavailable = booleanOption("--mock-when-unavailable");
  const intervalHours = numberOption("--interval-hours");
  const publishDelayMinutes = numberOption("--publish-delay-minutes");
  const dailyUploadLimit = numberOption("--daily-upload-limit");
  const nextRunAt = getOption(args, "--next-run-at");
  const privacyStatus = getOption(args, "--privacy");
  const topicSeed = getOption(args, "--topic-seed");
  if (
    privacyStatus &&
    !["private", "unlisted", "public"].includes(privacyStatus)
  ) {
    throw new Error("--privacy はprivate/unlisted/publicで指定してください。");
  }
  return {
    ...config,
    ...(enabled !== undefined ? { enabled } : {}),
    ...(mockWhenApiUnavailable !== undefined ? { mockWhenApiUnavailable } : {}),
    ...(intervalHours !== undefined ? { intervalHours } : {}),
    ...(publishDelayMinutes !== undefined ? { publishDelayMinutes } : {}),
    ...(dailyUploadLimit !== undefined ? { dailyUploadLimit } : {}),
    ...(nextRunAt !== undefined
      ? { nextRunAt: nextRunAt === "null" ? null : nextRunAt }
      : {}),
    ...(privacyStatus ? { defaultPrivacyStatus: privacyStatus } : {}),
    ...(topicSeed ? { topicSeed } : {}),
  };
};

const formatJson = (value: unknown): string => JSON.stringify(value, null, 2);
