BEGIN;
CREATE TABLE IF NOT EXISTS retention_policies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid REFERENCES organizations(id),entity_type text NOT NULL,version integer NOT NULL,retain_days integer NOT NULL CHECK(retain_days>=0),effective_from timestamptz NOT NULL,UNIQUE(organization_id,entity_type,version));
CREATE TABLE IF NOT EXISTS legal_holds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),entity_type text NOT NULL,entity_id uuid,reason text NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','released')),created_by uuid NOT NULL REFERENCES users(id),released_by uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),released_at timestamptz);
CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum_sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
COMMIT;
