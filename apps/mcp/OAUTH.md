# OAuth boundary

The MCP server is the OAuth authorization server for MCP clients. Human identity is resolved upstream through GitHub after explicit ALTAREEQ consent.

The authorization flow is fail-closed:

1. Validate the MCP authorization request with the OAuth provider.
2. Persist a one-time consent record with a ten-minute TTL.
3. Require same-browser CSRF binding.
4. On approval, use an HMAC-signed one-time GitHub state bound to the browser.
5. Resolve the GitHub login and enforce `ALLOWED_GITHUB_LOGINS`.
6. Complete the MCP authorization with only the granted scopes and identity props.
7. Never persist the GitHub access token in MCP authorization props.

The Cloudflare API token is a separate Worker secret and is never part of OAuth props.
