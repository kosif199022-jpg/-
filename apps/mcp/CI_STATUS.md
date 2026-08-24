# CI status

Validated on GitHub Actions with Node.js 24:

- committed-secret gate: PASS
- dependency resolution: PASS
- `wrangler types`: PASS
- TypeScript strict typecheck: PASS
- `npm audit --audit-level=high`: PASS
- `wrangler deploy --dry-run`: PASS
- parent ALTAREEQ contract/unit/web/Worker/PostgreSQL/RLS jobs: PASS

Live Cloudflare account provisioning and OAuth login are intentionally not claimed until the real account resources, public origin, KV namespace and secrets are configured.
