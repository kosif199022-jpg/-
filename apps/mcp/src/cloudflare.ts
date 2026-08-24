export interface CloudflareEnv {
  CLOUDFLARE_API_BASE: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  ALTAREEQ_TARGET_WORKER: string;
  ALTAREEQ_R2_BUCKET: string;
  ALTAREEQ_HYPERDRIVE_NAME: string;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
}

export class CloudflareApiError extends Error {
  readonly status: number;
  readonly apiCode: number | undefined;

  constructor(message: string, status: number, apiCode?: number) {
    super(message);
    this.name = "CloudflareApiError";
    this.status = status;
    this.apiCode = apiCode;
  }
}

function assertRelativeApiPath(path: string): void {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("..")) {
    throw new CloudflareApiError("INVALID_CLOUDFLARE_API_PATH", 400);
  }
}

function baseUrl(env: CloudflareEnv): URL {
  const url = new URL(env.CLOUDFLARE_API_BASE);
  if (url.protocol !== "https:" || url.hostname !== "api.cloudflare.com" || url.pathname.replace(/\/$/, "") !== "/client/v4") {
    throw new CloudflareApiError("CLOUDFLARE_API_BASE_NOT_ALLOWED", 500);
  }
  return url;
}

async function readBoundedJson<T>(response: Response, maxBytes = 1_000_000): Promise<T> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new CloudflareApiError("CLOUDFLARE_RESPONSE_TOO_LARGE", 502);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new CloudflareApiError("CLOUDFLARE_RESPONSE_TOO_LARGE", 502);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new CloudflareApiError("CLOUDFLARE_INVALID_JSON", 502);
  }
}

export async function cfRequest<T>(
  env: CloudflareEnv,
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  assertRelativeApiPath(path);
  if (!env.CLOUDFLARE_API_TOKEN) throw new CloudflareApiError("CLOUDFLARE_API_TOKEN_NOT_CONFIGURED", 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const base = baseUrl(env);
    const url = new URL(base.pathname.replace(/\/$/, "") + path, base.origin);
    const init: RequestInit = {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...options.headers,
      },
      signal: controller.signal,
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    const response = await fetch(url, init);

    const envelope = await readBoundedJson<CloudflareEnvelope<T>>(response);
    if (!response.ok || !envelope.success || envelope.result === undefined) {
      const first = envelope.errors?.[0];
      throw new CloudflareApiError(first?.message || "CLOUDFLARE_API_ERROR", response.status, first?.code);
    }
    return envelope.result;
  } catch (error) {
    if (error instanceof CloudflareApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new CloudflareApiError("CLOUDFLARE_API_TIMEOUT", 504);
    throw new CloudflareApiError("CLOUDFLARE_API_UNAVAILABLE", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export interface CloudflareAccount { id: string; name: string; }
export interface CloudflareWorker { id?: string; etag?: string; modified_on?: string; }
export interface R2Bucket { name: string; creation_date?: string; location?: string; storage_class?: string; }
export interface HyperdriveConfig { id: string; name: string; origin?: { host?: string; database?: string }; }

export async function verifyToken(env: CloudflareEnv): Promise<unknown> {
  return cfRequest(env, "/user/tokens/verify");
}

export async function listAccounts(env: CloudflareEnv): Promise<CloudflareAccount[]> {
  return cfRequest(env, "/accounts?per_page=50");
}

export async function resolveAccountId(env: CloudflareEnv, requested?: string): Promise<string> {
  const selected = (requested || env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (selected) {
    if (!/^[a-f0-9]{32}$/i.test(selected)) throw new CloudflareApiError("INVALID_CLOUDFLARE_ACCOUNT_ID", 400);
    return selected;
  }
  const accounts = await listAccounts(env);
  if (accounts.length !== 1) throw new CloudflareApiError("CLOUDFLARE_ACCOUNT_ID_REQUIRED", 409);
  return accounts[0]!.id;
}

export async function listWorkers(env: CloudflareEnv, accountId: string): Promise<CloudflareWorker[]> {
  return cfRequest(env, `/accounts/${encodeURIComponent(accountId)}/workers/scripts`);
}

export async function listR2Buckets(env: CloudflareEnv, accountId: string): Promise<R2Bucket[]> {
  return cfRequest(env, `/accounts/${encodeURIComponent(accountId)}/r2/buckets`);
}

export async function listHyperdrives(env: CloudflareEnv, accountId: string): Promise<HyperdriveConfig[]> {
  return cfRequest(env, `/accounts/${encodeURIComponent(accountId)}/hyperdrive/configs`);
}

export function validateAltareeqBucketName(name: string): string {
  const value = name.trim();
  if (!/^altareeq-[a-z0-9][a-z0-9.-]{1,55}[a-z0-9]$/.test(value)) {
    throw new CloudflareApiError("INVALID_ALTAREEQ_BUCKET_NAME", 400);
  }
  return value;
}

export async function createR2Bucket(
  env: CloudflareEnv,
  accountId: string,
  input: { name: string; locationHint?: string; storageClass?: "Standard" | "InfrequentAccess" },
): Promise<R2Bucket> {
  const name = validateAltareeqBucketName(input.name);
  const body: Record<string, string> = { name };
  if (input.locationHint) body.locationHint = input.locationHint;
  if (input.storageClass) body.storageClass = input.storageClass;
  return cfRequest(env, `/accounts/${encodeURIComponent(accountId)}/r2/buckets`, { method: "POST", body });
}
