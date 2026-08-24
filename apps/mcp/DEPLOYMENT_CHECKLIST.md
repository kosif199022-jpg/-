# Production activation checklist

- [ ] Create OAuth KV namespace and replace placeholder namespace id.
- [ ] Deploy the MCP Worker once to obtain the final HTTPS origin.
- [ ] Create GitHub OAuth App with callback `<origin>/callback`.
- [ ] Store `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `COOKIE_ENCRYPTION_KEY`, and `CLOUDFLARE_API_TOKEN` as Worker secrets.
- [ ] Set the final `MCP_PUBLIC_ORIGIN`.
- [ ] Set `CLOUDFLARE_ACCOUNT_ID` if the token can access multiple accounts.
- [ ] Verify least-privilege token access through `cloudflare_verify_connection`.
- [ ] Run `altareeq_deployment_readiness`.
- [ ] Register `<origin>/mcp` as a custom OAuth MCP app in ChatGPT Developer Mode.
- [ ] Exercise read tools, then explicitly authorize `cloudflare:r2:write` only when provisioning is required.
