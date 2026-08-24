import { AuthorizationError, type AuthRequest, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface AuthEnv {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  MCP_PUBLIC_ORIGIN: string;
  ALLOWED_GITHUB_LOGINS: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
}

interface PendingAuthorization {
  oauthReqInfo: AuthRequest;
  grantedScopes: string[];
  createdAt: number;
}

const CONSENT_TTL_SECONDS = 600;
const SUPPORTED_SCOPES = new Set(["cloudflare:read", "cloudflare:r2:write"]);
const encoder = new TextEncoder();

function requirePublicOrigin(env: AuthEnv): URL {
  const url = new URL(env.MCP_PUBLIC_ORIGIN);
  if (url.protocol !== "https:" || url.hostname === "invalid.example") throw new Error("MCP_PUBLIC_ORIGIN_NOT_CONFIGURED");
  return url;
}

function allowedLogins(env: AuthEnv): Set<string> {
  return new Set(env.ALLOWED_GITHUB_LOGINS.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function parseCookies(request: Request): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) result.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return result;
}

function cookie(name: string, value: string, maxAge = CONSENT_TTL_SECONDS): string {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error("COOKIE_ENCRYPTION_KEY_TOO_SHORT");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function base64Url(bytes: ArrayBuffer): string {
  const values = new Uint8Array(bytes);
  let binary = "";
  for (const value of values) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signState(env: AuthEnv, value: string): Promise<string> {
  const key = await importHmacKey(env.COOKIE_ENCRYPTION_KEY);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return `${value}.${base64Url(signature)}`;
}

async function verifyState(env: AuthEnv, signed: string): Promise<string> {
  const index = signed.lastIndexOf(".");
  if (index < 1) throw new Error("INVALID_OAUTH_STATE");
  const value = signed.slice(0, index);
  const signature = fromBase64Url(signed.slice(index + 1));
  const key = await importHmacKey(env.COOKIE_ENCRYPTION_KEY);
  const valid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(value));
  if (!valid) throw new Error("INVALID_OAUTH_STATE");
  return value;
}

async function jsonPost(url: string, form: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) throw new Error("UPSTREAM_OAUTH_EXCHANGE_FAILED");
  return await response.json() as Record<string, unknown>;
}

function redirectAuthorizationError(error: unknown, oauthReqInfo?: AuthRequest): Response {
  if (error instanceof AuthorizationError && oauthReqInfo?.redirectUri) {
    const target = new URL(oauthReqInfo.redirectUri);
    target.searchParams.set("error", error.errorCode);
    if (error.description) target.searchParams.set("error_description", error.description);
    if (oauthReqInfo.state) target.searchParams.set("state", oauthReqInfo.state);
    return Response.redirect(target.toString(), 302);
  }
  return new Response("Authorization failed", { status: 400, headers: { "cache-control": "no-store" } });
}

export function createAuthHandler(): ExportedHandler<AuthEnv> {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);

      if (url.pathname === "/authorize" && request.method === "GET") {
        let oauthReqInfo: AuthRequest | undefined;
        try {
          requirePublicOrigin(env);
          oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
          const consentId = crypto.randomUUID();
          const csrf = crypto.randomUUID();
          const requested = oauthReqInfo.scope?.filter((scope) => SUPPORTED_SCOPES.has(scope)) ?? ["cloudflare:read"];
          const pending: PendingAuthorization = { oauthReqInfo, grantedScopes: requested.length ? requested : ["cloudflare:read"], createdAt: Date.now() };
          await env.OAUTH_KV.put(`consent:${consentId}`, JSON.stringify(pending), { expirationTtl: CONSENT_TTL_SECONDS });
          const clientName = escapeHtml(oauthReqInfo.clientId || "MCP client");
          const scopes = pending.grantedScopes.map(escapeHtml).join("، ");
          return new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>تفويض ALTAREEQ MCP</title><style>body{font-family:system-ui;max-width:720px;margin:4rem auto;padding:1rem;line-height:1.8}button{min-height:44px;padding:.7rem 1.1rem;font:inherit}code{direction:ltr;unicode-bidi:isolate}</style><h1>تفويض ALTAREEQ Cloudflare MCP</h1><p>العميل: <code>${clientName}</code></p><p>الصلاحيات المطلوبة: <code>${scopes}</code></p><form method="post" action="/authorize"><input type="hidden" name="consent_id" value="${escapeHtml(consentId)}"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><button name="decision" value="approve">متابعة إلى GitHub</button> <button name="decision" value="deny">رفض</button></form></html>`, {
            headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store", "set-cookie": cookie("__Host-altareeq_csrf", csrf) },
          });
        } catch (error) {
          return redirectAuthorizationError(error, oauthReqInfo);
        }
      }

      if (url.pathname === "/authorize" && request.method === "POST") {
        const form = await request.formData();
        const consentId = String(form.get("consent_id") || "");
        const csrf = String(form.get("csrf") || "");
        const cookies = parseCookies(request);
        if (!consentId || !csrf || cookies.get("__Host-altareeq_csrf") !== csrf) return new Response("Invalid CSRF", { status: 403 });
        const raw = await env.OAUTH_KV.get(`consent:${consentId}`);
        await env.OAUTH_KV.delete(`consent:${consentId}`);
        if (!raw) return new Response("Authorization expired", { status: 400 });
        const pending = JSON.parse(raw) as PendingAuthorization;
        if (form.get("decision") !== "approve") {
          return redirectAuthorizationError(new AuthorizationError("access_denied", "The user denied access"), pending.oauthReqInfo);
        }

        try {
          const nonce = crypto.randomUUID();
          const browserBinding = crypto.randomUUID();
          await env.OAUTH_KV.put(`github-state:${nonce}`, JSON.stringify({ pending, browserBinding }), { expirationTtl: CONSENT_TTL_SECONDS });
          const signedState = await signState(env, nonce);
          const origin = requirePublicOrigin(env);
          const upstream = new URL("https://github.com/login/oauth/authorize");
          upstream.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
          upstream.searchParams.set("redirect_uri", new URL("/callback", origin).toString());
          upstream.searchParams.set("scope", "read:user");
          upstream.searchParams.set("state", signedState);
          return new Response(null, { status: 302, headers: { location: upstream.toString(), "set-cookie": cookie("__Host-altareeq_state", browserBinding) } });
        } catch (error) {
          return redirectAuthorizationError(error, pending.oauthReqInfo);
        }
      }

      if (url.pathname === "/callback" && request.method === "GET") {
        try {
          const origin = requirePublicOrigin(env);
          const signedState = url.searchParams.get("state") || "";
          const code = url.searchParams.get("code") || "";
          if (!code) return new Response("Missing OAuth code", { status: 400 });
          const nonce = await verifyState(env, signedState);
          const raw = await env.OAUTH_KV.get(`github-state:${nonce}`);
          await env.OAUTH_KV.delete(`github-state:${nonce}`);
          if (!raw) return new Response("OAuth state expired", { status: 400 });
          const { pending, browserBinding } = JSON.parse(raw) as { pending: PendingAuthorization; browserBinding: string };
          if (parseCookies(request).get("__Host-altareeq_state") !== browserBinding) return new Response("OAuth browser binding failed", { status: 403 });

          const tokenData = await jsonPost("https://github.com/login/oauth/access_token", new URLSearchParams({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: new URL("/callback", origin).toString(),
          }));
          const accessToken = String(tokenData.access_token || "");
          if (!accessToken) throw new Error("UPSTREAM_OAUTH_TOKEN_MISSING");
          const profileResponse = await fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json", "user-agent": "ALTAREEQ-MCP" } });
          if (!profileResponse.ok) throw new Error("GITHUB_PROFILE_FAILED");
          const profile = await profileResponse.json() as { login?: string };
          const login = String(profile.login || "").toLowerCase();
          if (!login || !allowedLogins(env).has(login)) return new Response("GitHub identity is not allowed", { status: 403 });

          const completion = await env.OAUTH_PROVIDER.completeAuthorization({
            request: pending.oauthReqInfo,
            userId: login,
            metadata: { label: `GitHub:${login}` },
            scope: pending.grantedScopes,
            props: { userId: login, login, scopes: pending.grantedScopes },
          });
          return new Response(null, { status: 302, headers: { location: completion.redirectTo, "set-cookie": cookie("__Host-altareeq_state", "", 0) } });
        } catch {
          return new Response("OAuth callback failed", { status: 400, headers: { "cache-control": "no-store" } });
        }
      }

      return new Response("ALTAREEQ MCP authorization", { status: 404 });
    },
  };
}
