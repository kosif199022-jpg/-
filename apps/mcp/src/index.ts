import { WorkerEntrypoint } from "cloudflare:workers";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import { createAuthHandler, type AuthEnv } from "./auth";
import { createAltareeqMcpServer, type AuthProps, type McpEnv } from "./server";

interface Env extends AuthEnv, McpEnv {
  OAUTH_KV: KVNamespace;
}

function configuredOrigin(env: Env): URL {
  const url = new URL(env.MCP_PUBLIC_ORIGIN);
  if (url.protocol !== "https:" || url.hostname === "invalid.example") throw new Error("MCP_PUBLIC_ORIGIN_NOT_CONFIGURED");
  return url;
}

export class McpApiHandler extends WorkerEntrypoint<Env, AuthProps> {
  override async fetch(request: Request): Promise<Response> {
    const handler = createMcpHandler(
      () => createAltareeqMcpServer(this.env),
      {
        route: "/mcp",
        authContext: { props: this.ctx.props },
        legacy: "stateless",
        responseMode: "auto",
      },
    );
    return handler(request, this.env, this.ctx);
  }
}

const oauthHelpers = new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: McpApiHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  defaultHandler: {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      if (new URL(request.url).pathname === "/") {
        let resource = "/mcp";
        try { resource = new URL("/mcp", configuredOrigin(env)).toString(); } catch { /* fail-closed status only */ }
        return new Response(JSON.stringify({ service: "ALTAREEQ Cloudflare MCP", protocol: "MCP 2026-07-28", endpoint: resource, configured: resource.startsWith("https://") }), {
          headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store" },
        });
      }
      return createAuthHandler(oauthHelpers).fetch!(request, env, ctx);
    },
  },
  scopesSupported: ["cloudflare:read", "cloudflare:r2:write"],
  allowPlainPKCE: false,
  clientIdMetadataDocumentEnabled: true,
});

export default oauthHelpers;
