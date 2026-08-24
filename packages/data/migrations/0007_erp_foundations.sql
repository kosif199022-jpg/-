BEGIN;
CREATE TABLE IF NOT EXISTS accounting_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), dimension_key text NOT NULL, display_name text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), UNIQUE(organization_id,dimension_key)
);
CREATE TABLE IF NOT EXISTS accounting_dimension_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), dimension_id uuid NOT NULL REFERENCES accounting_dimensions(id), value_code text NOT NULL, display_name text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), UNIQUE(dimension_id,value_code)
);
CREATE TABLE IF NOT EXISTS journal_line_dimensions (
  journal_line_id uuid NOT NULL REFERENCES journal_lines(id) ON DELETE RESTRICT, dimension_id uuid NOT NULL REFERENCES accounting_dimensions(id), value_id uuid NOT NULL REFERENCES accounting_dimension_values(id), PRIMARY KEY(journal_line_id,dimension_id)
);
CREATE TABLE IF NOT EXISTS currencies (
  code char(3) PRIMARY KEY, minor_unit smallint NOT NULL CHECK(minor_unit BETWEEN 0 AND 6), display_name text NOT NULL
);
INSERT INTO currencies(code,minor_unit,display_name) VALUES('SAR',2,'Saudi Riyal') ON CONFLICT(code) DO NOTHING;
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), rate_date date NOT NULL, from_currency char(3) NOT NULL REFERENCES currencies(code), to_currency char(3) NOT NULL REFERENCES currencies(code), numerator bigint NOT NULL CHECK(numerator>0), denominator bigint NOT NULL CHECK(denominator>0), source text NOT NULL, UNIQUE(organization_id,rate_date,from_currency,to_currency,source)
);
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), account_id uuid NOT NULL REFERENCES accounts(id), bank_name text NOT NULL, iban_masked text, currency_code char(3) NOT NULL REFERENCES currencies(code), status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), UNIQUE(organization_id,account_id)
);
CREATE TABLE IF NOT EXISTS recurring_journal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), template_key text NOT NULL, description text NOT NULL, schedule_rule text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','retired')), UNIQUE(organization_id,template_key)
);
CREATE TABLE IF NOT EXISTS close_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), period_id uuid NOT NULL REFERENCES fiscal_periods(id), close_type text NOT NULL CHECK(close_type IN ('soft','final','reopen')), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_progress','blocked','approved','completed','cancelled')), initiated_by uuid NOT NULL REFERENCES users(id), approved_by uuid REFERENCES users(id), rationale text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, CHECK(approved_by IS NULL OR approved_by<>initiated_by)
);
CREATE TABLE IF NOT EXISTS close_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), close_run_id uuid NOT NULL REFERENCES close_runs(id) ON DELETE CASCADE, task_key text NOT NULL, display_name text NOT NULL, required boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','passed','failed','waived')), evidence_reference text, UNIQUE(close_run_id,task_key)
);
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), sku text NOT NULL, name text NOT NULL, unit_code text NOT NULL, costing_policy text NOT NULL CHECK(costing_policy IN ('fifo','weighted_average','specific_identification')), status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), UNIQUE(organization_id,sku)
);
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), code text NOT NULL, name text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), UNIQUE(organization_id,code)
);
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), item_id uuid NOT NULL REFERENCES inventory_items(id), warehouse_id uuid NOT NULL REFERENCES warehouses(id), movement_date date NOT NULL, movement_type text NOT NULL CHECK(movement_type IN ('receipt','issue','transfer_in','transfer_out','count_adjustment')), quantity_microunits bigint NOT NULL CHECK(quantity_microunits<>0), unit_cost_minor bigint CHECK(unit_cost_minor>=0), source_type text NOT NULL, source_id uuid, journal_id uuid REFERENCES journals(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), request_no text NOT NULL, requested_by uuid NOT NULL REFERENCES users(id), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','closed')), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,request_no)
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), po_no text NOT NULL, vendor_id uuid NOT NULL REFERENCES vendors(id), request_id uuid REFERENCES purchase_requests(id), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','part_received','received','closed','cancelled')), approved_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,po_no)
);
CREATE TABLE IF NOT EXISTS goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), receipt_no text NOT NULL, purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id), receipt_date date NOT NULL, received_by uuid NOT NULL REFERENCES users(id), status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','reversed')), UNIQUE(organization_id,receipt_no)
);
CREATE TABLE IF NOT EXISTS budget_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), version_key text NOT NULL, name text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','locked','superseded')), approved_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,version_key)
);
CREATE TABLE IF NOT EXISTS budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), budget_version_id uuid NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE, period_id uuid NOT NULL REFERENCES fiscal_periods(id), account_id uuid NOT NULL REFERENCES accounts(id), amount_minor bigint NOT NULL, dimensions jsonb NOT NULL DEFAULT '{}'::jsonb
);
COMMIT;
