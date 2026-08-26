#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { interactiveLogin, logout, resolveToken } from "./auth.js";
import { buildServer } from "./server.js";

async function main() {
  const [group, command] = process.argv.slice(2);
  if (group === "auth") {
    if (command === "login") {
      await interactiveLogin();
      return;
    }
    if (command === "logout") {
      console.error(await logout() ? "Logged out of Score Studio." : "No saved Score Studio login was found.");
      return;
    }
    throw new Error("Usage: score-studio auth <login|logout>");
  }
  if (group) throw new Error("Usage: score-studio [auth <login|logout>]");
  await resolveToken({ interactive: Boolean(process.stdin.isTTY && process.stderr.isTTY) });
  // The interactive auth selector temporarily pauses stdin while restoring
  // terminal mode. MCP stdio needs a flowing input stream to stay attached to
  // its host after first-run authentication completes.
  process.stdin.resume();
  serveStdio(() => buildServer({ tokenProvider: () => resolveToken({ interactive: false }) }), { onerror: (error) => console.error(error) });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
