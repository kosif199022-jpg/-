# ALTAREEQ Cloudflare MCP

Project-scoped remote MCP gateway for **ALTAREEQ / الطريق**. It runs on Cloudflare Workers, exposes Streamable HTTP at `/mcp`, uses OAuth 2.1 for MCP clients, GitHub identity allowlisting for human authorization, and a server-side least-privilege Cloudflare API token.

## Tools

Read-only:
- `altareeq_mcp_status`
- `cloudflare_verify_connection`
- `cloudflare_list_accounts`
- `cloudflare_list_workers`
- `cloudflare_list_r2_buckets`
- `cloudflare_list_hyperdrives`
- `altareeq_deployment_readiness`

Write:
- `cloudflare_create_altareeq_r2_bucket` — requires `cloudflare:r2:write`, is additive/idempotent, and only accepts `altareeq-*` names.

This is intentionally not a generic Cloudflare proxy. For broad account administration use Cloudflare's managed MCP. This gateway is constrained to ALTAREEQ provisioning and readiness workflows.

## Security invariants

- OAuth 2.1/PKCE on the MCP boundary; plain PKCE disabled.
- Explicit consent before upstream GitHub login.
- CSRF protection and one-time KV consent/state records with ten-minute TTL.
- OAuth state is HMAC-SHA256 signed and bound to the same browser.
- GitHub login must match `ALLOWED_GITHUB_LOGINS`; an empty allowlist denies access.
- GitHub access tokens are used only to resolve identity and are never persisted in MCP grant props.
- `CLOUDFLARE_API_TOKEN` is a Worker secret and is never returned by tools or committed.
- Cloudflare API base is pinned to `https://api.cloudflare.com/client/v4`.
- Cloudflare API responses are bounded and outbound calls time out.
- Write scopes are enforced server-side. MCP tool annotations are advisory hints only.

## Bootstrap

1. `cd apps/mcp && npm install`
2. Create OAuth storage:
   `npx wrangler kv namespace create OAUTH_KV`
   Replace the zero KV id in `wrangler.jsonc` with the returned namespace id.
3. Create a GitHub OAuth App. Callback URL:
   `https://<your-mcp-host>/callback`
4. Store secrets with Wrangler; never put values in source control:
   - `npx wrangler secret put GITHUB_CLIENT_ID`
   - `npx wrangler secret put GITHUB_CLIENT_SECRET`
   - `npx wrangler secret put COOKIE_ENCRYPTION_KEY` (32+ random bytes)
   - `npx wrangler secret put CLOUDFLARE_API_TOKEN`
5. Set `MCP_PUBLIC_ORIGIN` to the final HTTPS Worker/custom-domain origin.
6. Set `CLOUDFLARE_ACCOUNT_ID` when the token can see more than one account.
7. Grant the Cloudflare API token only the permissions needed by enabled tools: account/Workers/R2/Hyperdrive read; add R2 write only when the bucket-creation tool is needed.
8. Validate: `npm run check`.
9. Deploy: `npm run deploy`.
10. In ChatGPT Developer Mode create a custom MCP app, enter `https://<your-mcp-host>/mcp`, choose OAuth, scan tools, then authorize.

Until the real KV id, public origin and secrets are configured, production use is intentionally blocked.
