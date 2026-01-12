import "dotenv/config";

// 超最小のCLI雛形。現時点ではドキュメント参照用のプレースホルダです。
// 将来的に `run`, `config:test`, `cost:report` などのサブコマンドを実装していきます。

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";

if (cmd === "help") {
  // eslint-disable-next-line no-console
  console.log(`yukkuri CLI (skeleton)

Commands (planned):
  run --dev-mode
  config:test
  cost:report --month YYYY-MM
`);
  process.exit(0);
}

// eslint-disable-next-line no-console
console.error(`Unknown command: ${cmd}`);
process.exit(1);

