import { McpServer } from "@modelcontextprotocol/server";
import { getMcpAuthContext } from "agents/mcp/server";
import { z } from "zod";
import {
  CloudflareApiError,
  createR2Bucket,
  listAccounts,
  listHyperdrives,
  listR2Buckets,
  listWorkers,
  resolveAccountId,
  verifyToken,
  type CloudflareEnv,
} from "./cloudflare";

export interface AuthProps extends Record<string, unknown> {
  userId: string;
  login: string;
  scopes: string[];
}

export interface McpEnv extends CloudflareEnv {
  MCP_PUBLIC_ORIGIN: string;
  ALLOWED_GITHUB_LOGINS: string;
}

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function safeError(error: unknown) {
  if (error instanceof CloudflareApiError) {
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, status: error.status, apiCode: error.apiCode }) }] };
  }
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: "INTERNAL_TOOL_ERROR" }) }] };
}

function currentAuth(): AuthProps {
  const context = getMcpAuthContext();
  const props = context?.props as Partial<AuthProps> | undefined;
  if (!props?.userId || !props.login || !Array.isArray(props.scopes)) throw new CloudflareApiError("MCP_AUTH_CONTEXT_REQUIRED", 401);
  return { userId: props.userId, login: props.login, scopes: props.scopes.map(String) };
}

function requireScope(scope: string): AuthProps {
  const auth = currentAuth();
  if (!auth.scopes.includes(scope)) throw new CloudflareApiError("MCP_SCOPE_REQUIRED", 403);
  return auth;
}

const accountInput = { accountId: z.string().regex(/^[a-f0-9]{32}$/i).optional() };
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export function createAltareeqMcpServer(env: McpEnv): McpServer {
  const server = new McpServer({ name: "altareeq-cloudflare-mcp", version: "0.1.0" });

  server.registerTool(
    "altareeq_mcp_status",
    {
      description: "Return the authenticated ALTAREEQ MCP identity and non-secret configuration status.",
      inputSchema: {},
      annotations: readAnnotations,
    },
    async () => {
      try {
        const auth = currentAuth();
        return text({
          authenticated: true,
          login: auth.login,
          scopes: auth.scopes,
          cloudflareTokenConfigured: Boolean(env.CLOUDFLARE_API_TOKEN),
          defaultAccountConfigured: Boolean(env.CLOUDFLARE_ACCOUNT_ID),
          targetWorker: env.ALTAREEQ_TARGET_WORKER,
          targetR2Bucket: env.ALTAREEQ_R2_BUCKET,
          targetHyperdrive: env.ALTAREEQ_HYPERDRIVE_NAME,
        });
      } catch (error) { return safeError(error); }
    },
  );

  server.registerTool(
    "cloudflare_verify_connection",
    { description: "Verify the server-side Cloudflare API token without exposing it.", inputSchema: {}, annotations: readAnnotations },
    async () => {
      try { requireScope("cloudflare:read"); return text(await verifyToken(env)); }
      catch (error) { return safeError(error); }
    },
  );

  server.registerTool(
    "cloudflare_list_accounts",
    { description: "List Cloudflare accounts visible to the project token.", inputSchema: {}, annotations: readAnnotations },
    async () => {
      try { requireScope("cloudflare:read"); return text(await listAccounts(env)); }
      catch (error) { return safeError(error); }
    },
  );

  server.registerTool(
    "cloudflare_list_workers",
    { description: "List Workers in the selected Cloudflare account.", inputSchema: accountInput, annotations: readAnnotations },
    async ({ accountId }) => {
      try { requireScope("cloudflare:read"); const id = await resolveAccountId(env, accountId); return text(await listWorkers(env, id)); }
      catch (error) { return safeError(error); }
    },
  );

  server.registerTool(
    "cloudflare_list_r2_buckets",
    { description: "List R2 buckets in the selected Cloudflare account.", inputSchema: accountInput, annotations: readAnnotations },
    async ({ accountId }) => {
      try { requireScope("cloudflare:read"); const id = await resolveAccountId(env, accountId); return text(await listR2Buckets(env, id)); }
      catch (error) { return safeError(error); }
    },
  );

  server.registerTool(
    "cloudflare_list_hyperdrives",
    { description: "List Hyperdrive configurations in the selected Cloudflare account.", inputSchema: accountInput, annotations: readAnnotations },
    async ({ accountId }) => {
      try { requireScope("cloudflare:read"); const id = await resolveAccountId(env, accountId); return text(await listHyperdrives(env, id)); }
      catch (error) { return safeError(error); }
    },
  );

  server.registerTool(
    "altareeq_deployment_readiness",
    { description: "Check whether the ALTAREEQ Worker, R2 bucket and Hyperdrive targets exist in the selected account.", inputSchema: accountInput, annotations: readAnnotations },
    async ({ accountId }) => {
      try {
        requireScope("cloudflare:read");
        const id = await resolveAccountId(env, accountId);
        const [workers, buckets, hyperdrives] = await Promise.all([listWorkers(env, id), listR2Buckets(env, id), listHyperdrives(env, id)]);
        const workerReady = workers.some((w) => w.id === env.ALTAREEQ_TARGET_WORKER);
        const r2Ready = buckets.some((b) => b.name === env.ALTAREEQ_R2_BUCKET);
        const hyperdriveReady = hyperdrives.some((h) => h.name === env.ALTAREEQ_HYPERDRIVE_NAME);
        const blockers = [!workerReady && "TARGET_WORKER_MISSING", !r2Ready && "TARGET_R2_BUCKET_MISSING", !hyperdriveReady && "TARGET_HYPERDRIVE_MISSING"].filter(Boolean);
        return text({ ready: blockers.length === 0, workerReady, r2Ready, hyperdriveReady, blockers });
      } catch (error) { return safeError(error); }
    },
  );

  server.registerTool(
    "cloudflare_create_altareeq_r2_bucket",
    {
      description: "Create an ALTAREEQ-prefixed R2 bucket if it does not already exist. Requires cloudflare:r2:write.",
      inputSchema: {
        ...accountInput,
        name: z.string().min(3).max(64),
        locationHint: z.string().min(2).max(16).optional(),
        storageClass: z.enum(["Standard", "InfrequentAccess"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ accountId, name, locationHint, storageClass }) => {
      try {
        requireScope("cloudflare:r2:write");
        const id = await resolveAccountId(env, accountId);
        const existing = (await listR2Buckets(env, id)).find((bucket) => bucket.name === name);
        if (existing) return text({ created: false, bucket: existing });
        const bucket = await createR2Bucket(env, id, { name, ...(locationHint ? { locationHint } : {}), ...(storageClass ? { storageClass } : {}) });
        return text({ created: true, bucket });
      } catch (error) { return safeError(error); }
    },
  );

  return server;
}
