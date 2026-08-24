# Architecture

ALTAREEQ is a clean-room modular monolith. Domain arithmetic and state transitions live in packages; the Cloudflare Worker is an application boundary; PostgreSQL owns authoritative relational state.

## Dependency direction

`contracts/primitives -> accounting -> reconciliation/audit/report projections`

`knowledge -> AI advisory` is separate. `accounting`, `reconciliation` and `tax` may never depend on AI for authoritative values. UI/design may consume projections but domain packages may not depend on presentation.

## ERP completion domains

The source repositories are audit-heavy and ERP-light. ALTAREEQ therefore adds explicit domains for AR, AP, sales cycle, procurement cycle, treasury, fixed assets, inventory, financial close, accounting dimensions and multi-currency. These are recorded in the contract as required domains and are not considered complete simply because synthetic fixtures existed in KOSIF.
