-- The database role Electric connects as: replication plus read rights on the
-- synced tables, nothing else. Idempotent. Production creates the same role by
-- hand with a real password (docs/runbook.md); the password here is local-only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'electric') THEN
    CREATE ROLE electric LOGIN REPLICATION PASSWORD 'electric_local_dev';
  END IF;
END
$$;
