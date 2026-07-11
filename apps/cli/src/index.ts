import "dotenv/config";
import { executeCli } from "./cli";

process.exitCode = await executeCli(process.argv.slice(2));
