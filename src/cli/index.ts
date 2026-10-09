import { execFile } from "node:child_process";
import { env, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { z } from "zod";
import { loadConfig } from "../config.ts";
import { getAccounts } from "../schwab/accounts.ts";
import {
  completeLogin,
  createAuthorization,
  getLoginStatus,
} from "../schwab/auth.ts";
import { LoginRequiredError, SchwabError } from "../schwab/errors.ts";
import { formatAccounts } from "./format-accounts.ts";
import { formatLoginStatus } from "./format-login-status.ts";

const TOKENS_PATH = "tokens.json";

const program = new Command().name("obe");

program
  .command("config")
  .description("Show the loaded settings and whether each secret is set")
  .action(() => {
    const config = loadConfig(env);
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
    const config = loadConfig(env);
    const { url, state } = createAuthorization(config);
    console.log(`Log in to Schwab at:\n${url}\n`);
    execFile("open", [url], () => {});
    const prompt = createInterface({ input: stdin, output: stdout });
    const callbackUrl = await prompt
      .question("Paste the URL within 30 seconds: ")
      .finally(() => prompt.close());
    const session = { config, tokensPath: TOKENS_PATH };
    const status = await completeLogin(session, callbackUrl, state);
    console.log(`Logged in until ${status.loginExpiresAt.toLocaleString()}.`);
  });

auth
  .command("status")
  .description("Show when the access token and the 7-day login expire")
  .action(async () => {
    const status = await getLoginStatus(TOKENS_PATH);
    console.log(formatLoginStatus(status));
  });

program
  .command("accounts")
  .description("Show each linked Schwab account and its balances")
  .action(async () => {
    const config = loadConfig(env);
    const session = { config, tokensPath: TOKENS_PATH };
    const accounts = await getAccounts(session);
    console.log(formatAccounts(accounts));
  });

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(`Invalid configuration\n${z.prettifyError(error)}`);
  } else if (error instanceof LoginRequiredError) {
    console.error(`${error.message} Run \`pnpm cli auth login\`.`);
  } else if (error instanceof SchwabError) {
    console.error(error.message);
  } else {
    throw error;
  }
  process.exitCode = 1;
}
