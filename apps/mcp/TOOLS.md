# Tool policy

| Tool | Scope | Mutation | Notes |
| --- | --- | --- | --- |
| altareeq_mcp_status | authenticated | no | Non-secret configuration status |
| cloudflare_verify_connection | cloudflare:read | no | Verifies project token |
| cloudflare_list_accounts | cloudflare:read | no | Account discovery |
| cloudflare_list_workers | cloudflare:read | no | Worker inventory |
| cloudflare_list_r2_buckets | cloudflare:read | no | R2 inventory |
| cloudflare_list_hyperdrives | cloudflare:read | no | Hyperdrive inventory |
| altareeq_deployment_readiness | cloudflare:read | no | Checks named ALTAREEQ targets |
| cloudflare_create_altareeq_r2_bucket | cloudflare:r2:write | additive | Idempotent; only `altareeq-*` names |

No tool can proxy an arbitrary Cloudflare path or arbitrary HTTP origin.
