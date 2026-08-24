# Architecture

`OAuthProvider` terminates MCP OAuth 2.1 and delegates authenticated `/mcp` traffic to `McpApiHandler`. `McpApiHandler` creates a fresh stateless MCP server per request and injects the authenticated props into the Agents SDK auth context. Tools call a bounded Cloudflare API adapter whose origin is fixed to `api.cloudflare.com/client/v4`.

The boundary deliberately separates:

- human authorization: OAuth + GitHub allowlist;
- MCP tool authorization: explicit `cloudflare:*` scopes;
- Cloudflare account authorization: least-privilege Worker secret token;
- ALTAREEQ financial authority: not exposed by this MCP server.

No financial journal-posting, audit-opinion, materiality-approval, or adjustment-approval capability is exposed here.
