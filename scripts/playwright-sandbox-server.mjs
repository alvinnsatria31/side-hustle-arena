/**
 * The dev server the local browser suite drives.
 *
 * Deliberately NOT `playwright-dev-server.mjs`: that one loads `.env`, which
 * points at the shared cloud development database and the real object store.
 * A browser suite writes fixture users, weeks and submissions, so it runs
 * against the isolated sandbox instead — `localEnvironment()` refuses anything
 * that is not a loopback `arena_local`, and blanks every external credential,
 * so this process cannot reach a provider even by accident.
 */
import { spawn } from "node:child_process";
import { localEnvironment } from "./local-env.mjs";

const env = localEnvironment();
const origin = new URL(env.ARENA_ORIGIN);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "-p", origin.port || "3001"], {
  env, shell: false, stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
