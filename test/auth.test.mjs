import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { credentialPath, loadCredential, logout, oauthResource, resolveToken, saveCredential } from "../dist/auth.js";

test("stores and removes credentials with owner-only permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "score-studio-auth-"));
  const path = join(directory, "nested", "credentials.json");
  await saveCredential({ type: "api_key", token: "secret-test-token" }, path);
  assert.deepEqual(await loadCredential(path), { type: "api_key", token: "secret-test-token" });
  if (process.platform !== "win32") assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(await logout(path), true);
  assert.equal(await logout(path), false);
});

test("uses an environment token before saved credentials", async () => {
  const previous = process.env.SCORESTUDIO_TOKEN;
  process.env.SCORESTUDIO_TOKEN = "environment-token";
  try { assert.equal(await resolveToken({ interactive: false }), "environment-token"); }
  finally {
    if (previous === undefined) delete process.env.SCORESTUDIO_TOKEN;
    else process.env.SCORESTUDIO_TOKEN = previous;
  }
});

test("config directory can be overridden", () => {
  assert.equal(credentialPath({ SCORESTUDIO_CONFIG_DIR: "/tmp/custom-score-config" }), "/tmp/custom-score-config/credentials.json");
});

test("OAuth audience defaults to the normalized API URL and supports an override", () => {
  assert.equal(oauthResource("https://api.scorestudio.ai///", {}), "https://api.scorestudio.ai");
  assert.equal(
    oauthResource("http://127.0.0.1:8000/", { SCORESTUDIO_OAUTH_RESOURCE: "https://custom.example/resource" }),
    "https://custom.example/resource",
  );
});
