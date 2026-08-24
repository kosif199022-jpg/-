BEGIN;
CREATE OR REPLACE FUNCTION altareeq_current_org() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('altareeq.organization_id',true),'')::uuid $$;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;

-- Direct tenant-owned tables. Global knowledge/retention rows with NULL organization_id remain readable but are not writable through tenant policies.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fiscal_periods','accounts','journals','command_idempotency','posting_events','business_audit_events',
    'audit_engagements','human_decisions','customers','vendors','sales_invoices','customer_receipts','purchase_invoices','vendor_payments','fixed_assets',
    'ai_runs','workflows','legal_holds','accounting_dimensions','accounting_dimension_values','exchange_rates','bank_accounts','recurring_journal_templates','close_runs',
    'inventory_items','warehouses','inventory_movements','purchase_requests','purchase_orders','goods_receipts','budget_versions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I',t);
    EXECUTE format('CREATE POLICY tenant_scope ON %I USING (organization_id=altareeq_current_org()) WITH CHECK (organization_id=altareeq_current_org())',t);
  END LOOP;
END $$;

ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_sources FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_source_scope ON knowledge_sources;
CREATE POLICY knowledge_source_scope ON knowledge_sources USING (organization_id IS NULL OR organization_id=altareeq_current_org()) WITH CHECK (organization_id=altareeq_current_org());
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY; ALTER TABLE retention_policies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retention_scope ON retention_policies;
CREATE POLICY retention_scope ON retention_policies USING (organization_id IS NULL OR organization_id=altareeq_current_org()) WITH CHECK (organization_id=altareeq_current_org());

-- Child tables inherit tenant scope through their authoritative parent.
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY; ALTER TABLE journal_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journal_line_scope ON journal_lines;
CREATE POLICY journal_line_scope ON journal_lines USING (EXISTS(SELECT 1 FROM journals j WHERE j.id=journal_id AND j.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM journals j WHERE j.id=journal_id AND j.organization_id=altareeq_current_org()));
ALTER TABLE receipt_allocations ENABLE ROW LEVEL SECURITY; ALTER TABLE receipt_allocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipt_allocation_scope ON receipt_allocations;
CREATE POLICY receipt_allocation_scope ON receipt_allocations USING (EXISTS(SELECT 1 FROM customer_receipts r WHERE r.id=receipt_id AND r.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM customer_receipts r WHERE r.id=receipt_id AND r.organization_id=altareeq_current_org()));
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY; ALTER TABLE payment_allocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_allocation_scope ON payment_allocations;
CREATE POLICY payment_allocation_scope ON payment_allocations USING (EXISTS(SELECT 1 FROM vendor_payments p WHERE p.id=payment_id AND p.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM vendor_payments p WHERE p.id=payment_id AND p.organization_id=altareeq_current_org()));
ALTER TABLE asset_depreciation_entries ENABLE ROW LEVEL SECURITY; ALTER TABLE asset_depreciation_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_depreciation_scope ON asset_depreciation_entries;
CREATE POLICY asset_depreciation_scope ON asset_depreciation_entries USING (EXISTS(SELECT 1 FROM fixed_assets a WHERE a.id=asset_id AND a.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM fixed_assets a WHERE a.id=asset_id AND a.organization_id=altareeq_current_org()));
ALTER TABLE close_tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE close_tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS close_task_scope ON close_tasks;
CREATE POLICY close_task_scope ON close_tasks USING (EXISTS(SELECT 1 FROM close_runs c WHERE c.id=close_run_id AND c.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM close_runs c WHERE c.id=close_run_id AND c.organization_id=altareeq_current_org()));
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY; ALTER TABLE budget_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_line_scope ON budget_lines;
CREATE POLICY budget_line_scope ON budget_lines USING (EXISTS(SELECT 1 FROM budget_versions b WHERE b.id=budget_version_id AND b.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM budget_versions b WHERE b.id=budget_version_id AND b.organization_id=altareeq_current_org()));

ALTER TABLE audit_blockers ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_blockers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_blocker_scope ON audit_blockers;
CREATE POLICY audit_blocker_scope ON audit_blockers USING (EXISTS(SELECT 1 FROM audit_engagements e WHERE e.id=engagement_id AND e.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM audit_engagements e WHERE e.id=engagement_id AND e.organization_id=altareeq_current_org()));
ALTER TABLE audit_gates ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_gates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_gate_scope ON audit_gates;
CREATE POLICY audit_gate_scope ON audit_gates USING (EXISTS(SELECT 1 FROM audit_engagements e WHERE e.id=engagement_id AND e.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM audit_engagements e WHERE e.id=engagement_id AND e.organization_id=altareeq_current_org()));
ALTER TABLE audit_stage_history ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_stage_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_history_scope ON audit_stage_history;
CREATE POLICY audit_history_scope ON audit_stage_history USING (EXISTS(SELECT 1 FROM audit_engagements e WHERE e.id=engagement_id AND e.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM audit_engagements e WHERE e.id=engagement_id AND e.organization_id=altareeq_current_org()));

ALTER TABLE knowledge_source_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_source_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_version_scope ON knowledge_source_versions;
CREATE POLICY knowledge_version_scope ON knowledge_source_versions USING (EXISTS(SELECT 1 FROM knowledge_sources s WHERE s.id=source_id AND (s.organization_id IS NULL OR s.organization_id=altareeq_current_org()))) WITH CHECK (EXISTS(SELECT 1 FROM knowledge_sources s WHERE s.id=source_id AND s.organization_id=altareeq_current_org()));
ALTER TABLE knowledge_blocks ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_blocks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_block_scope ON knowledge_blocks;
CREATE POLICY knowledge_block_scope ON knowledge_blocks USING (EXISTS(SELECT 1 FROM knowledge_source_versions v JOIN knowledge_sources s ON s.id=v.source_id WHERE v.id=source_version_id AND (s.organization_id IS NULL OR s.organization_id=altareeq_current_org()))) WITH CHECK (EXISTS(SELECT 1 FROM knowledge_source_versions v JOIN knowledge_sources s ON s.id=v.source_id WHERE v.id=source_version_id AND s.organization_id=altareeq_current_org()));
ALTER TABLE citations ENABLE ROW LEVEL SECURITY; ALTER TABLE citations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citation_scope ON citations;
CREATE POLICY citation_scope ON citations USING (EXISTS(SELECT 1 FROM knowledge_source_versions v JOIN knowledge_sources s ON s.id=v.source_id WHERE v.id=source_version_id AND (s.organization_id IS NULL OR s.organization_id=altareeq_current_org()))) WITH CHECK (EXISTS(SELECT 1 FROM knowledge_source_versions v JOIN knowledge_sources s ON s.id=v.source_id WHERE v.id=source_version_id AND s.organization_id=altareeq_current_org()));

ALTER TABLE workflow_checkpoints ENABLE ROW LEVEL SECURITY; ALTER TABLE workflow_checkpoints FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workflow_checkpoint_scope ON workflow_checkpoints;
CREATE POLICY workflow_checkpoint_scope ON workflow_checkpoints USING (EXISTS(SELECT 1 FROM workflows w WHERE w.id=workflow_id AND w.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM workflows w WHERE w.id=workflow_id AND w.organization_id=altareeq_current_org()));
ALTER TABLE signed_approvals ENABLE ROW LEVEL SECURITY; ALTER TABLE signed_approvals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS signed_approval_scope ON signed_approvals;
CREATE POLICY signed_approval_scope ON signed_approvals USING (EXISTS(SELECT 1 FROM workflows w WHERE w.id=workflow_id AND w.organization_id=altareeq_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM workflows w WHERE w.id=workflow_id AND w.organization_id=altareeq_current_org()));
COMMIT;
