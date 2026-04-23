import "dotenv/config";

import { promises as fs } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const DEFAULT_OUTPUT_ROOT = path.join(
  WORKSPACE_ROOT,
  "outputs",
  "diagnostics",
  "script_generation_llm"
);
const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const DEFAULT_THEME = "疎通確認用の台本生成";
const DEFAULT_TIMEOUT_MS = 30_000;

const cliOptions = parseCliOptions(process.argv.slice(2));

if (cliOptions.dryRun) {
  console.log(
    JSON.stringify(
      {
        provider: "gemini",
        model: cliOptions.model,
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        outputs: [
          "report.json",
          "request.json",
          "raw_response.txt",
          "response.json",
          "extracted_text.txt",
          "generated_script.json",
        ],
      },
      null,
      2
    )
  );
  process.exit(0);
}

main()
  .then(async (report) => {
    await writeJson(report.reportPath, report);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.success ? 0 : 1;
  })
  .catch(async (error) => {
    const runId = createRunId();
    const outputDir = path.join(cliOptions.outputRoot, runId);
    await fs.mkdir(outputDir, { recursive: true });
    const reportPath = path.join(outputDir, "report.json");
    const rawResponsePath = path.join(outputDir, "raw_response.txt");
    await fs.writeFile(
      rawResponsePath,
      error instanceof Error ? error.stack ?? error.message : String(error),
      "utf-8"
    );
    const report = {
      runId,
      provider: "gemini",
      model: cliOptions.model,
      apiKeyConfigured: Boolean(process.env.GOOGLE_API_KEY?.trim()),
      requestAttempted: false,
      success: false,
      classification: "unexpected_error",
      classificationDetail: error instanceof Error ? error.message : String(error),
      responseStatus: null,
      errorStatus: null,
      workflowWouldFallback: true,
      outputDir,
      reportPath,
      requestPath: path.join(outputDir, "request.json"),
      rawResponsePath,
      responseJsonPath: null,
      extractedTextPath: null,
      generatedScriptPath: null,
      lineCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
    await writeJson(reportPath, report);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  });

async function main() {
  const runId = createRunId();
  const outputDir = path.join(cliOptions.outputRoot, runId);
  await fs.mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "report.json");
  const requestPath = path.join(outputDir, "request.json");
  const rawResponsePath = path.join(outputDir, "raw_response.txt");
  const responseJsonPath = path.join(outputDir, "response.json");
  const extractedTextPath = path.join(outputDir, "extracted_text.txt");
  const generatedScriptPath = path.join(outputDir, "generated_script.json");
  const startedAt = new Date().toISOString();
  const apiKey = process.env.GOOGLE_API_KEY?.trim() ?? "";
  const prompt = buildPrompt(cliOptions.theme);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cliOptions.model}:generateContent`;
  const requestPayload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5, responseMimeType: "application/json" },
  };

  await writeJson(requestPath, {
    provider: "gemini",
    model: cliOptions.model,
    endpoint,
    timeoutMs: cliOptions.timeoutMs,
    apiKeyConfigured: apiKey.length > 0,
    theme: cliOptions.theme,
    body: requestPayload,
  });

  if (!apiKey) {
    await fs.writeFile(
      rawResponsePath,
      "GOOGLE_API_KEY is not configured. The workflow would silently fall back to buildFallbackScript().\n",
      "utf-8"
    );
    return {
      runId,
      provider: "gemini",
      model: cliOptions.model,
      apiKeyConfigured: false,
      requestAttempted: false,
      success: false,
      classification: "missing_api_key",
      classificationDetail: "GOOGLE_API_KEY が未設定のため Gemini API を呼び出せません。",
      responseStatus: null,
      errorStatus: null,
      workflowWouldFallback: true,
      outputDir,
      reportPath,
      requestPath,
      rawResponsePath,
      responseJsonPath: null,
      extractedTextPath: null,
      generatedScriptPath: null,
      lineCount: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  let response = null;
  let rawResponse = "";
  let parsedResponse = null;

  try {
    response = await fetchWithTimeout(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    }, cliOptions.timeoutMs);
    rawResponse = await response.text();
  } catch (error) {
    const classification = classifyThrownError(error);
    await fs.writeFile(
      rawResponsePath,
      error instanceof Error ? error.stack ?? error.message : String(error),
      "utf-8"
    );
    return {
      runId,
      provider: "gemini",
      model: cliOptions.model,
      apiKeyConfigured: true,
      requestAttempted: true,
      success: false,
      classification: classification.kind,
      classificationDetail: classification.detail,
      responseStatus: null,
      errorStatus: null,
      workflowWouldFallback: true,
      outputDir,
      reportPath,
      requestPath,
      rawResponsePath,
      responseJsonPath: null,
      extractedTextPath: null,
      generatedScriptPath: null,
      lineCount: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  await fs.writeFile(rawResponsePath, rawResponse || "\n", "utf-8");
  try {
    parsedResponse = rawResponse ? JSON.parse(rawResponse) : null;
    if (parsedResponse) {
      await writeJson(responseJsonPath, parsedResponse);
    }
  } catch {
    parsedResponse = null;
  }

  if (!response.ok) {
    const failure = classifyHttpFailure(response.status, parsedResponse, rawResponse);
    return {
      runId,
      provider: "gemini",
      model: cliOptions.model,
      apiKeyConfigured: true,
      requestAttempted: true,
      success: false,
      classification: failure.kind,
      classificationDetail: failure.detail,
      responseStatus: response.status,
      errorStatus: parsedResponse?.error?.status ?? null,
      workflowWouldFallback: true,
      outputDir,
      reportPath,
      requestPath,
      rawResponsePath,
      responseJsonPath: parsedResponse ? responseJsonPath : null,
      extractedTextPath: null,
      generatedScriptPath: null,
      lineCount: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const text = extractCandidateText(parsedResponse);
  await fs.writeFile(extractedTextPath, text || "\n", "utf-8");
  if (!text) {
    return {
      runId,
      provider: "gemini",
      model: cliOptions.model,
      apiKeyConfigured: true,
      requestAttempted: true,
      success: false,
      classification: "empty_response",
      classificationDetail: "Gemini の candidates から本文を抽出できませんでした。",
      responseStatus: response.status,
      errorStatus: null,
      workflowWouldFallback: true,
      outputDir,
      reportPath,
      requestPath,
      rawResponsePath,
      responseJsonPath: parsedResponse ? responseJsonPath : null,
      extractedTextPath,
      generatedScriptPath: null,
      lineCount: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  let scriptJsonText = "";
  try {
    scriptJsonText = extractJson(text);
  } catch (error) {
    return {
      runId,
      provider: "gemini",
      model: cliOptions.model,
      apiKeyConfigured: true,
      requestAttempted: true,
      success: false,
      classification: "missing_json_block",
      classificationDetail: error instanceof Error ? error.message : String(error),
      responseStatus: response.status,
      errorStatus: null,
      workflowWouldFallback: true,
      outputDir,
      reportPath,
      requestPath,
      rawResponsePath,
      responseJsonPath: parsedResponse ? responseJsonPath : null,
      extractedTextPath,
      generatedScriptPath: null,
      lineCount: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  let parsedScript = null;
  try {
    parsedScript = JSON.parse(scriptJsonText);
  } catch (error) {
    return {
      runId,
      provider: "gemini",
      model: cliOptions.model,
      apiKeyConfigured: true,
      requestAttempted: true,
      success: false,
      classification: "schema_mismatch",
      classificationDetail: `JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
      responseStatus: response.status,
      errorStatus: null,
      workflowWouldFallback: true,
      outputDir,
      reportPath,
      requestPath,
      rawResponsePath,
      responseJsonPath: parsedResponse ? responseJsonPath : null,
      extractedTextPath,
      generatedScriptPath: null,
      lineCount: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const validation = validateScriptShape(parsedScript);
  if (!validation.ok) {
    return {
      runId,
      provider: "gemini",
      model: cliOptions.model,
      apiKeyConfigured: true,
      requestAttempted: true,
      success: false,
      classification: validation.kind,
      classificationDetail: validation.detail,
      responseStatus: response.status,
      errorStatus: null,
      workflowWouldFallback: true,
      outputDir,
      reportPath,
      requestPath,
      rawResponsePath,
      responseJsonPath: parsedResponse ? responseJsonPath : null,
      extractedTextPath,
      generatedScriptPath: null,
      lineCount: Array.isArray(parsedScript?.lines) ? parsedScript.lines.length : 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  await writeJson(generatedScriptPath, parsedScript);
  return {
    runId,
    provider: "gemini",
    model: cliOptions.model,
    apiKeyConfigured: true,
    requestAttempted: true,
    success: true,
    classification: "ok",
    classificationDetail: "台本JSONを正常に取得し、shape検証も通過しました。",
    responseStatus: response.status,
    errorStatus: null,
    workflowWouldFallback: false,
    outputDir,
    reportPath,
    requestPath,
    rawResponsePath,
    responseJsonPath: parsedResponse ? responseJsonPath : null,
    extractedTextPath,
    generatedScriptPath,
    lineCount: parsedScript.lines.length,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

function parseCliOptions(argv) {
  const options = {
    dryRun: false,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    model: DEFAULT_MODEL,
    theme: DEFAULT_THEME,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--output-root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--output-root requires a value.");
      }
      options.outputRoot = path.isAbsolute(value) ? value : path.resolve(WORKSPACE_ROOT, value);
      index += 1;
      continue;
    }
    if (arg === "--model") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--model requires a value.");
      }
      options.model = value;
      index += 1;
      continue;
    }
    if (arg === "--theme") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--theme requires a value.");
      }
      options.theme = value;
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--timeout-ms requires a positive number.");
      }
      options.timeoutMs = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function buildPrompt(theme) {
  return (
    "あなたはゆっくり解説の脚本家です。JSONのみで返答してください。" +
    "schema={title:string,theme:string,lines:[{speaker:string,text:string,emotion?:string}]}" +
    `テーマ: ${theme}`
  );
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Request timed out.")), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function classifyThrownError(error) {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      kind: "timeout",
      detail: `Gemini API request timed out after ${cliOptions.timeoutMs}ms.`,
    };
  }
  return {
    kind: "network_error",
    detail: error instanceof Error ? error.message : String(error),
  };
}

function classifyHttpFailure(status, parsedResponse, rawResponse) {
  const errorStatus = parsedResponse?.error?.status ?? "";
  const errorMessage = parsedResponse?.error?.message ?? rawResponse ?? "";
  if (status === 429 || errorStatus === "RESOURCE_EXHAUSTED") {
    return {
      kind: "quota_exhausted",
      detail: errorMessage || "Gemini API quota is exhausted.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: "authentication_error",
      detail: errorMessage || "Gemini API authentication failed.",
    };
  }
  if (status === 404 || /not found/i.test(errorMessage)) {
    return {
      kind: "model_not_found",
      detail: errorMessage || "Gemini model was not found.",
    };
  }
  if (status === 400) {
    return {
      kind: "invalid_request",
      detail: errorMessage || "Gemini API rejected the request.",
    };
  }
  return {
    kind: "service_unavailable",
    detail: errorMessage || `Gemini API returned HTTP ${status}.`,
  };
}

function extractCandidateText(body) {
  return (
    body?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || first >= last) {
    throw new Error("JSON block was not found in the candidate text.");
  }
  return trimmed.slice(first, last + 1);
}

function validateScriptShape(value) {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      kind: "schema_mismatch",
      detail: "Script root must be an object.",
    };
  }
  if (typeof value.title !== "string" || typeof value.theme !== "string") {
    return {
      ok: false,
      kind: "schema_mismatch",
      detail: "Script title/theme must be strings.",
    };
  }
  if (!Array.isArray(value.lines)) {
    return {
      ok: false,
      kind: "schema_mismatch",
      detail: "Script lines must be an array.",
    };
  }
  if (value.lines.length === 0) {
    return {
      ok: false,
      kind: "empty_script",
      detail: "Script lines is empty.",
    };
  }
  for (const [index, line] of value.lines.entries()) {
    if (!line || typeof line !== "object") {
      return {
        ok: false,
        kind: "schema_mismatch",
        detail: `Script line ${index} must be an object.`,
      };
    }
    if (typeof line.speaker !== "string" || typeof line.text !== "string") {
      return {
        ok: false,
        kind: "schema_mismatch",
        detail: `Script line ${index} must include speaker/text strings.`,
      };
    }
  }
  return { ok: true };
}

function createRunId() {
  const now = new Date();
  return [
    "run",
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}`,
    `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
      2,
      "0"
    )}${String(now.getSeconds()).padStart(2, "0")}`,
    String(now.getMilliseconds()).padStart(3, "0"),
  ].join("-");
}

async function writeJson(targetPath, payload) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}
