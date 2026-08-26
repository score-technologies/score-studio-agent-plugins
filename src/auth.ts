import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

import { DEFAULT_SCORESTUDIO_URL } from "./server.js";

const CLIENT_ID = "score-studio-cli";
const DEFAULT_SCOPE = "openid offline_access scorestudio:identity scorestudio:datasets:read scorestudio:models:read scorestudio:evaluations:read scorestudio:training:write scorestudio:evaluations:write scorestudio:deployments:verify scorestudio:workflows:run";

export type StoredCredential = {
  type: "api_key";
  token: string;
} | {
  type: "oauth";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenEndpoint: string;
  clientId: string;
  resource: string;
};

type OAuthMetadata = { authorization_endpoint: string; token_endpoint: string; revocation_endpoint?: string };

export function credentialPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.SCORESTUDIO_CONFIG_DIR) return join(env.SCORESTUDIO_CONFIG_DIR, "credentials.json");
  if (process.platform === "win32") return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "ScoreStudio", "credentials.json");
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "score-studio", "credentials.json");
}

export function oauthResource(baseUrl: string, env: NodeJS.ProcessEnv = process.env): string {
  return env.SCORESTUDIO_OAUTH_RESOURCE ?? baseUrl.replace(/\/+$/, "");
}

export async function loadCredential(path = credentialPath()): Promise<StoredCredential | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as StoredCredential;
    if (value.type === "api_key" && value.token) return value;
    if (value.type === "oauth" && value.accessToken && value.tokenEndpoint) return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return undefined;
}

export async function saveCredential(value: StoredCredential, path = credentialPath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function logout(path = credentialPath()): Promise<boolean> {
  try {
    await unlink(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function discover(baseUrl: string): Promise<OAuthMetadata> {
  const override = process.env.SCORESTUDIO_OAUTH_ISSUER?.replace(/\/$/, "");
  const issuer = override ?? baseUrl.replace(/\/$/, "");
  const metadataUrl = process.env.SCORESTUDIO_OAUTH_METADATA_URL ?? `${issuer}/.well-known/oauth-authorization-server`;
  try {
    const response = await fetch(metadataUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      const metadata = await response.json() as Partial<OAuthMetadata>;
      if (metadata.authorization_endpoint && metadata.token_endpoint) return metadata as OAuthMetadata;
    }
  } catch {
    // Fall back to the conventional Score Studio endpoints for local deployments.
  }
  return {
    authorization_endpoint: `${issuer}/v1/oauth/authorize`,
    token_endpoint: `${issuer}/v1/oauth/token`,
    revocation_endpoint: `${issuer}/v1/oauth/revoke`,
  };
}

function openBrowser(url: string): void {
  const [command, args] = process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : ["xdg-open", [url]];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

async function exchangeToken(endpoint: string, values: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error_description ?? payload.error ?? `OAuth request failed (${response.status})`));
  return payload;
}

export async function oauthLogin(baseUrl = process.env.SCORESTUDIO_URL ?? DEFAULT_SCORESTUDIO_URL): Promise<StoredCredential> {
  const metadata = await discover(baseUrl);
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  // The stdio MCP process calls the Score Studio API directly. Hosted remote
  // MCP servers use their own resource/audience and do not share this flow.
  const resource = oauthResource(baseUrl);
  const clientId = process.env.SCORESTUDIO_OAUTH_CLIENT_ID ?? CLIENT_ID;

  let callbackResolve!: (value: string) => void;
  let callbackReject!: (reason: Error) => void;
  const callback = new Promise<string>((resolve, reject) => { callbackResolve = resolve; callbackReject = reject; });
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/callback") { response.writeHead(404).end(); return; }
    if (url.searchParams.get("state") !== state) {
      response.writeHead(400, { "content-type": "text/plain" }).end("Invalid OAuth state. You may close this window.");
      callbackReject(new Error("OAuth state mismatch"));
      return;
    }
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    if (error || !code) {
      response.writeHead(400, { "content-type": "text/plain" }).end("Authorization was not completed. You may close this window.");
      callbackReject(new Error(error ?? "Authorization code missing"));
      return;
    }
    response.writeHead(200, { "content-type": "text/plain" }).end("Score Studio login complete. You may close this window.");
    callbackResolve(code);
  });
  await new Promise<void>((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not open OAuth callback listener");
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;
  const authorize = new URL(metadata.authorization_endpoint);
  for (const [key, value] of Object.entries({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256", state, scope: DEFAULT_SCOPE, resource })) authorize.searchParams.set(key, value);
  console.error("Opening your browser to sign in to Score Studio…");
  openBrowser(authorize.toString());
  const timeout = setTimeout(() => callbackReject(new Error("OAuth login timed out")), 5 * 60_000);
  try {
    const code = await callback;
    const token = await exchangeToken(metadata.token_endpoint, { grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource });
    if (typeof token.access_token !== "string") throw new Error("OAuth response did not contain an access token");
    return {
      type: "oauth", accessToken: token.access_token,
      ...(typeof token.refresh_token === "string" ? { refreshToken: token.refresh_token } : {}),
      ...(typeof token.expires_in === "number" ? { expiresAt: Date.now() + token.expires_in * 1000 } : {}),
      tokenEndpoint: metadata.token_endpoint, clientId, resource,
    };
  } finally {
    clearTimeout(timeout);
    server.close();
  }
}

async function refresh(credential: Extract<StoredCredential, { type: "oauth" }>): Promise<Extract<StoredCredential, { type: "oauth" }>> {
  if (!credential.refreshToken) throw new Error("OAuth session expired; run `score-studio auth login` again");
  const token = await exchangeToken(credential.tokenEndpoint, { grant_type: "refresh_token", refresh_token: credential.refreshToken, client_id: credential.clientId, resource: credential.resource });
  if (typeof token.access_token !== "string") throw new Error("OAuth refresh did not return an access token");
  return {
    ...credential,
    accessToken: token.access_token,
    refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : credential.refreshToken,
    ...(typeof token.expires_in === "number" ? { expiresAt: Date.now() + token.expires_in * 1000 } : {}),
  };
}

async function promptApiKey(): Promise<StoredCredential> {
  process.stderr.write("Paste your Score Studio API key: ");
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  try {
    const token = (await rl.question("")).trim();
    process.stderr.write("\n");
    if (!token) throw new Error("API key cannot be empty");
    return { type: "api_key", token };
  } finally { rl.close(); muted.destroy(); }
}

const AUTH_METHODS = ["Browser OAuth", "API key"] as const;

export function nextAuthSelection(current: number, key: "up" | "down"): number {
  const offset = key === "up" ? -1 : 1;
  return (current + offset + AUTH_METHODS.length) % AUTH_METHODS.length;
}

async function selectAuthMethod(): Promise<"oauth" | "api_key"> {
  const input = process.stdin;
  const output = process.stderr;
  let selected = 0;
  let rendered = false;

  const render = () => {
    if (rendered) output.write(`\x1b[${AUTH_METHODS.length}A`);
    for (const [index, label] of AUTH_METHODS.entries()) {
      output.write(`\r\x1b[2K${index === selected ? "❯" : " "} ${label}\n`);
    }
    rendered = true;
  };

  output.write("Sign in with:\n\x1b[?25l");
  render();
  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();

  try {
    return await new Promise<"oauth" | "api_key">((resolve, reject) => {
      const onKeypress = (_character: string | undefined, key: { name?: string; ctrl?: boolean }) => {
        if (key.ctrl && key.name === "c") {
          input.off("keypress", onKeypress);
          reject(new Error("Authentication cancelled"));
          return;
        }
        if (key.name === "up" || key.name === "down") {
          selected = nextAuthSelection(selected, key.name);
          render();
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          input.off("keypress", onKeypress);
          resolve(selected === 0 ? "oauth" : "api_key");
        }
      };
      input.on("keypress", onKeypress);
    });
  } finally {
    input.setRawMode(wasRaw);
    input.pause();
    output.write("\x1b[?25h");
  }
}

export async function interactiveLogin(): Promise<StoredCredential> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error("Authentication is required. Run `score-studio auth login` in a terminal or set SCORESTUDIO_TOKEN.");
  const method = await selectAuthMethod();
  const credential = method === "api_key" ? await promptApiKey() : await oauthLogin();
  await saveCredential(credential);
  console.error("Authentication saved securely.");
  return credential;
}

export async function resolveToken(options: { interactive?: boolean } = {}): Promise<string> {
  if (process.env.SCORESTUDIO_TOKEN) return process.env.SCORESTUDIO_TOKEN;
  let credential = await loadCredential();
  if (!credential) {
    if (options.interactive === false) throw new Error("Authentication is required; set SCORESTUDIO_TOKEN or run `score-studio auth login`.");
    credential = await interactiveLogin();
  }
  if (credential.type === "api_key") return credential.token;
  if (credential.expiresAt && credential.expiresAt <= Date.now() + 60_000) {
    credential = await refresh(credential);
    await saveCredential(credential);
  }
  return credential.accessToken;
}
