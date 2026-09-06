import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.env.SESSION_SECRET && process.env.SSESSION_SECRET) {
  process.env.SESSION_SECRET = process.env.SSESSION_SECRET;
}

const origin = new URL(process.env.ARENA_ORIGIN ?? "http://localhost:3001");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", origin.port || "3001"], {
  env: process.env,
  shell: false,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
