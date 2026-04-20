import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const buildCustomerJourneyVisualCommands = ({ update = false } = {}) => [
  "corepack pnpm test:e2e:journey",
  `node scripts/visualRegression.mjs${update ? " --update" : ""}`,
];

export async function runCustomerJourneyVisual(argv = process.argv.slice(2)) {
  const update = argv.includes("--update");
  process.env.E2E_RUN_ID ??= createRunId();
  for (const command of buildCustomerJourneyVisualCommands({ update })) {
    await runCommand(command);
  }
}

const runCommand = (command) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      shell: true,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });

const createRunId = () =>
  new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 15);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCustomerJourneyVisual().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
