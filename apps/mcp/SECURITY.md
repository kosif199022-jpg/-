# Security invariants

1. No Cloudflare token value may be logged, returned, persisted in OAuth props, or committed.
2. Every write tool enforces its MCP scope server-side.
3. GitHub login allowlist is fail-closed.
4. OAuth consent and upstream state expire and are one-time.
5. The Cloudflare API origin is fixed to api.cloudflare.com/client/v4.
6. Tool annotations are hints only; authorization is enforced in code.
