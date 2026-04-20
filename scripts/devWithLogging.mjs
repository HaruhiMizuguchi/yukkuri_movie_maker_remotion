import { spawn } from 'node:child_process';
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEV_WORKSPACE_COMMANDS = [
  'corepack pnpm -C apps/web dev',
  'corepack pnpm -C apps/api dev',
  'corepack pnpm -C apps/worker dev',
];

export const createLogTimestamp = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
};

export const buildDevLogPaths = (baseDirectory = process.cwd(), date = new Date()) => {
  const logDirectory = join(baseDirectory, 'logs', 'dev');
  const timestamp = createLogTimestamp(date);
  return {
    logDirectory,
    runLogPath: join(logDirectory, `dev-${timestamp}.log`),
    latestLogPath: join(logDirectory, 'latest.log'),
  };
};

export const buildConcurrentDevCommand = () =>
  `corepack pnpm exec concurrently -k -n WEB,API,WORKER ${DEV_WORKSPACE_COMMANDS.map((item) => `"${item}"`).join(' ')}`;

const run = () => {
  const now = new Date();
  const { logDirectory, runLogPath, latestLogPath } = buildDevLogPaths(process.cwd(), now);
  mkdirSync(logDirectory, { recursive: true });
  writeFileSync(runLogPath, '');
  writeFileSync(latestLogPath, '');
  const writeLog = (message) => {
    const text = Buffer.isBuffer(message) ? message.toString('utf-8') : String(message);
    appendFileSync(runLogPath, text);
    appendFileSync(latestLogPath, text);
  };

  const command = buildConcurrentDevCommand();

  writeLog(`[${now.toISOString()}] dev start${'\n'}`);
  writeLog(`[${now.toISOString()}] command: ${command}${'\n'}`);
  writeLog(`[${now.toISOString()}] runLogPath: ${runLogPath}${'\n'}`);
  writeLog(`[${now.toISOString()}] latestLogPath: ${latestLogPath}${'\n'}`);

  const child = spawn(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    writeLog(chunk);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    writeLog(chunk);
  });

  child.on('error', (error) => {
    const message = `[${new Date().toISOString()}] spawn error: ${error.message}${'\n'}`;
    process.stderr.write(message);
    writeLog(message);
    process.exit(1);
  });

  child.on('close', (code, signal) => {
    const closeCode = code ?? 1;
    const message = `[${new Date().toISOString()}] dev exit code=${closeCode} signal=${signal ?? 'none'}${'\n'}`;
    writeLog(message);
    process.exit(closeCode);
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
