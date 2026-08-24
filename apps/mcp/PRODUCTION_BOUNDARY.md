# Production boundary

This package is production-oriented code but is not a live Cloudflare connection until account-specific resources are provisioned.

`wrangler deploy --dry-run` proves bundling/configuration compatibility only. A production-ready claim additionally requires a real KV namespace, final HTTPS origin, GitHub OAuth App, Worker secrets, least-privilege Cloudflare API token, live OAuth login, tool-call smoke tests, and final ChatGPT custom-MCP registration.
