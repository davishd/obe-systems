import { execFile } from "node:child_process";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { z } from "zod";
import { loadConfig } from "./config.ts";
import { formatAccounts, getAccounts } from "./schwab/accounts.ts";
import {
  createAuthorization,
  exchangeCode,
  parseCallback,
} from "./schwab/auth.ts";
import { SchwabError } from "./schwab/errors.ts";
import {
  formatStatus,
  loginExpiresAt,
  readTokens,
  writeTokens,
} from "./schwab/tokens.ts";

const TOKENS_PATH = "tokens.json";

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

const auth = program
  .command("auth")
  .description("Log in to Schwab and check the saved login");

auth
  .command("login")
  .description("Log in to Schwab in the browser and save new tokens")
  .action(async () => {
    const config = loadConfig();
    const { url, state } = createAuthorization(config);
    console.log(`Log in to Schwab at:\n${url}\n`);
    execFile("open", [url], () => {});
    const prompt = createInterface({ input: stdin, output: stdout });
    const pasted = await prompt
      .question("Paste the URL within 30 seconds: ")
      .finally(() => prompt.close());
    const tokens = await exchangeCode(config, parseCallback(pasted, state));
    await writeTokens(TOKENS_PATH, tokens);
    console.log(`Logged in until ${loginExpiresAt(tokens).toLocaleString()}.`);
  });

auth
  .command("status")
  .description("Show when the access token and the 7-day login expire")
  .action(async () => {
    console.log(formatStatus(await readTokens(TOKENS_PATH)));
  });

program
  .command("accounts")
  .description("Show each linked Schwab account and its balances")
  .action(async () => {
    const session = { config: loadConfig(), tokensPath: TOKENS_PATH };
    console.log(formatAccounts(await getAccounts(session)));
  });

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(`Invalid configuration\n${z.prettifyError(error)}`);
  } else if (error instanceof SchwabError) {
    console.error(error.message);
  } else {
    throw error;
  }
  process.exitCode = 1;
}
