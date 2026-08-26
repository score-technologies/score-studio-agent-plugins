export interface ScoreStudioClientOptions {
  baseUrl: string;
  token: string | (() => Promise<string>);
  timeoutMs?: number;
}

export class ScoreStudioApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ScoreStudioApiError";
  }
}

export class ScoreStudioClient {
  private readonly baseUrl: string;
  private readonly token: string | (() => Promise<string>);
  private readonly timeoutMs: number;

  constructor(options: ScoreStudioClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async request(
    method: "GET" | "POST",
    path: string,
    options: { query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {},
  ): Promise<unknown> {
    const url = new URL(path, `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const token = typeof this.token === "function" ? await this.token() : this.token;
    const requestInit: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    };
    if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);
    const response = await fetch(url, requestInit);

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const problem = typeof payload === "object" && payload !== null
        ? payload as Record<string, unknown>
        : {};
      throw new ScoreStudioApiError(
        response.status,
        String(problem.code ?? problem.title ?? "request_failed"),
        String(problem.detail ?? problem.message ?? response.statusText),
        payload,
      );
    }
    return payload;
  }
}
