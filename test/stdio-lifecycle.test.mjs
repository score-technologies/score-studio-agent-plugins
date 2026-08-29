import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

test("stdio server stays alive while its host input remains open", async () => {
  const child = spawn(process.execPath, ["dist/stdio.js"], {
    cwd: process.cwd(),
    env: { ...process.env, SCORESTUDIO_TOKEN: "lifecycle-test-token" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  try {
    await delay(150);
    assert.equal(child.exitCode, null);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
});
