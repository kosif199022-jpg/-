# ALTAREEQ Cloudflare MCP

Remote, project-scoped MCP gateway for ALTAREEQ. It exposes narrowly scoped Cloudflare account inspection and ALTAREEQ provisioning/readiness tools over Streamable HTTP at `/mcp`.

The server is intentionally not a generic Cloudflare proxy. Human access is authenticated through OAuth 2.1, Cloudflare credentials remain server-side, and write tools require an explicit MCP scope.
