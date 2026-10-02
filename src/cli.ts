import { Command } from "commander";
import { z } from "zod";
import { loadConfig } from "./config.ts";

const program = new Command().name("obe");

program
  .command("config")
  .description("Show the loaded settings and whether each secret is set")
  .action(() => {
    const config = loadConfig();
    const status = (secret: string) => (secret ? "set" : "not set");
    console.log(`SCHWAB_API_BASE_URL  ${config.SCHWAB_API_BASE_URL}`);
    console.log(`SCHWAB_CALLBACK_URL  ${config.SCHWAB_CALLBACK_URL}`);
    console.log(`SCHWAB_APP_KEY       ${status(config.SCHWAB_APP_KEY)}`);
    console.log(`SCHWAB_APP_SECRET    ${status(config.SCHWAB_APP_SECRET)}`);
  });

try {
  program.parse();
} catch (error) {
  if (!(error instanceof z.ZodError)) throw error;
  console.error(`Invalid configuration\n${z.prettifyError(error)}`);
  process.exitCode = 1;
}
