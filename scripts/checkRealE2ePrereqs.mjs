import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function checkRealE2ePrereqs() {
  const checks = [];
  const databaseUrl = process.env.DATABASE_URL;
  checks.push({
    name: "DATABASE_URL",
    ok: Boolean(databaseUrl?.trim()),
    detail: databaseUrl ? redactDatabaseUrl(databaseUrl) : "missing",
  });

  if (databaseUrl) {
    const endpoint = parsePostgresEndpoint(databaseUrl);
    const tcpOk = endpoint ? await canConnectTcp(endpoint.host, endpoint.port, 3000) : false;
    checks.push({
      name: "postgres_tcp",
      ok: tcpOk,
      detail: endpoint ? `${endpoint.host}:${endpoint.port}` : "invalid DATABASE_URL",
    });
  }

  checks.push(await checkCommand("ffmpeg", ["-version"]));
  checks.push(await checkCommand("corepack", ["pnpm", "--version"]));

  const docker = await checkCommand("docker", ["info"]);
  checks.push({
    ...docker,
    name: "docker_daemon_optional",
    required: false,
  });

  const report = {
    createdAt: new Date().toISOString(),
    ok: checks.filter((check) => check.required !== false).every((check) => check.ok),
    checks,
    hints: [
      "PostgreSQLが未起動の場合は docker compose -f docker-compose.e2e.yml up -d を実行する",
      "DB起動後は corepack pnpm db:push でPrismaスキーマを反映する",
      "実API E2Eは YMM_TTS_PROVIDER=mock と YMM_DISABLE_REMOTION=true でWorkerまで通す",
    ],
  };

  const reportPath = path.join("outputs", "test_evidence", "real_api_e2e", "preflight.json");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  return report;
}

export function parsePostgresEndpoint(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname || "localhost",
      port: Number(url.port || 5432),
    };
  } catch {
    return null;
  }
}

export function redactDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.password) {
      url.password = "***";
    }
    if (url.username) {
      url.username = "***";
    }
    return url.toString();
  } catch {
    return "invalid";
  }
}

const canConnectTcp = (host, port, timeoutMs) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const close = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => close(true));
    socket.on("timeout", () => close(false));
    socket.on("error", () => close(false));
  });

const checkCommand = (command, args) =>
  new Promise((resolve) => {
    const commandLine = [command, ...args].join(" ");
    const child = spawn(commandLine, {
      cwd: process.cwd(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ name: command, ok: false, detail: error.message, required: true });
    });
    child.on("close", (code) => {
      resolve({
        name: command,
        ok: code === 0,
        detail: code === 0 ? "ok" : stderr.trim().slice(0, 300),
        required: true,
      });
    });
  });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkRealE2ePrereqs()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.ok ? 0 : 1);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
