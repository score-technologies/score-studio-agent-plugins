import { createHash } from "node:crypto";

type CacheEntry = { accessToken: string; expiresAt: number };
type Fetch = typeof globalThis.fetch;

export interface InternalTokenExchangeOptions {
  apiBaseUrl: string;
  apiResource?: string;
  internalToken: string;
  fetch?: Fetch;
  now?: () => number;
}

export function protectedResourceMetadataUrl(apiBaseUrl: string, env: NodeJS.ProcessEnv = process.env): string {
  const issuer = (env.SCORESTUDIO_OAUTH_ISSUER ?? apiBaseUrl).replace(/\/+$/, "");
  return env.SCORESTUDIO_MCP_RESOURCE_METADATA_URL ?? `${issuer}/.well-known/oauth-protected-resource/mcp`;
}

export class InternalTokenExchange {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<string>>();
  private readonly fetch: Fetch;
  private readonly now: () => number;

  constructor(private readonly options: InternalTokenExchangeOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
  }

  async exchange(subjectToken: string): Promise<string> {
    const key = createHash("sha256").update(subjectToken).digest("base64url");
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now() + 30_000) return cached.accessToken;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const request = this.request(subjectToken, key).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async request(subjectToken: string, key: string): Promise<string> {
    const apiBaseUrl = this.options.apiBaseUrl.replace(/\/+$/, "");
    const apiResource = (this.options.apiResource ?? apiBaseUrl).replace(/\/+$/, "");
    const response = await this.fetch(`${apiBaseUrl}/v1/oauth/token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "X-OAuth-Exchange-Secret": this.options.internalToken },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: subjectToken,
        subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
        requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
        resource: apiResource,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof payload.access_token !== "string") throw new Error(`MCP token exchange failed (${response.status})`);
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 300;
    this.cache.set(key, { accessToken: payload.access_token, expiresAt: this.now() + expiresIn * 1000 });
    return payload.access_token;
  }
}
