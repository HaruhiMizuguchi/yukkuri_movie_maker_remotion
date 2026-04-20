import { spawn } from "node:child_process";
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const defaultOutputRoot = path.join(
  process.cwd(),
  "outputs",
  "test_evidence",
  "real_api_e2e",
  "latest"
);

export const REAL_E2E_SERVER_COMMANDS = [
  {
    name: "WEB",
    command: "corepack pnpm -C apps/web dev --host 127.0.0.1 --port 3000 --strictPort",
  },
  {
    name: "API",
    command: "corepack pnpm -C apps/api start",
  },
  {
    name: "WORKER",
    command: "corepack pnpm -C apps/worker start",
  },
];

export async function runRealE2eServers() {
  const outputRoot = process.env.YMM_WORKFLOW_OUTPUT_ROOT ?? defaultOutputRoot;
  const logDir = path.join(process.cwd(), "logs", "e2e-real");
  await mkdir(logDir, { recursive: true });
  await writeFile(path.join(logDir, "latest.log"), "");

  await runOneShot("corepack pnpm db:generate", logDir);
  await runOneShot("corepack pnpm db:push", logDir);

  const env = {
    ...process.env,
    YMM_WORKFLOW_OUTPUT_ROOT: outputRoot,
    YMM_TTS_PROVIDER: process.env.YMM_TTS_PROVIDER ?? "mock",
    YMM_ALLOW_MOCK_TTS_FALLBACK: process.env.YMM_ALLOW_MOCK_TTS_FALLBACK ?? "true",
    YMM_DISABLE_REMOTION: process.env.YMM_DISABLE_REMOTION ?? "true",
  };
  const children = REAL_E2E_SERVER_COMMANDS.map((item) => spawnServer(item, env, logDir));

  const stop = () => {
    for (const child of children) {
      if (!child.killed) {
        child.kill();
      }
    }
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await new Promise((_, reject) => {
    for (const child of children) {
      child.on("exit", (code, signal) => {
        stop();
        reject(new Error(`real e2e server exited code=${code} signal=${signal ?? "none"}`));
      });
    }
  });
}

const runOneShot = (command, logDir) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    wireLogs(child, "SETUP", logDir);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });

const spawnServer = ({ name, command }, env, logDir) => {
  const child = spawn(command, {
    cwd: process.cwd(),
    env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  wireLogs(child, name, logDir);
  return child;
};

const wireLogs = (child, name, logDir) => {
  const write = async (chunk, stream) => {
    const text = chunk.toString();
    const line = `[${new Date().toISOString()}] [${name}] [${stream}] ${text}`;
    process[stream === "stderr" ? "stderr" : "stdout"].write(line);
    await appendFile(path.join(logDir, "latest.log"), line, "utf-8");
  };
  child.stdout.on("data", (chunk) => {
    void write(chunk, "stdout");
  });
  child.stderr.on("data", (chunk) => {
    void write(chunk, "stderr");
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRealE2eServers().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
