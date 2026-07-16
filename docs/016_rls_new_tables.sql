-- target_roles: users can only see/manage their own
ALTER TABLE target_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY target_roles_select_own ON target_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY target_roles_insert_own ON target_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY target_roles_delete_own ON target_roles
  FOR DELETE USING (auth.uid() = user_id);

-- accomplishment_role_matches: readable if the user owns the underlying
-- accomplishment. No direct insert/update policy for authenticated users —
-- this table is written only by the worker's service-role connection,
-- matching the pattern established for accomplishments in migration 009.
ALTER TABLE accomplishment_role_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY arm_select_own ON accomplishment_role_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM accomplishments a
      WHERE a.id = accomplishment_role_matches.accomplishment_id
      AND a.user_id = auth.uid()
    )
  );
