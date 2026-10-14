-- Being a member of a workspace means being able to read it: the shapes that
-- sync members, invitations and the workspace itself are scoped by membership
-- alone. Roles saved without `workspace: read` get it added; rows that are not
-- valid JSON objects are left as they are (they grant nothing anyway).
DO $$
DECLARE
  role_row RECORD;
  parsed jsonb;
  actions jsonb;
BEGIN
  FOR role_row IN SELECT id, permission FROM "workspace_role" LOOP
    BEGIN
      parsed := role_row.permission::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF jsonb_typeof(parsed) <> 'object' THEN
      CONTINUE;
    END IF;
    actions := CASE
      WHEN jsonb_typeof(parsed -> 'workspace') = 'array' THEN parsed -> 'workspace'
      ELSE '[]'::jsonb
    END;
    IF actions ? 'read' THEN
      CONTINUE;
    END IF;
    UPDATE "workspace_role"
    SET "permission" = jsonb_set(parsed, '{workspace}', actions || '["read"]'::jsonb)::text
    WHERE id = role_row.id;
  END LOOP;
END
$$;
