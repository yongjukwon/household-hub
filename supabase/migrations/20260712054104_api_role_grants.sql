-- Table-level DML grants for the PostgREST API roles.
--
-- Newer Supabase stacks (CLI 2.109.x local images; verified against a
-- pristine `supabase init` scaffold on 2026-07-11) no longer grant
-- SELECT/INSERT/UPDATE/DELETE on public-schema tables to the API roles by
-- default — fresh tables carry only TRUNCATE/REFERENCES/TRIGGER for
-- anon/authenticated/service_role. Phases 0–1 were built and verified on the
-- old CLI (2.20.12), whose default privileges included full DML, so nothing
-- in earlier migrations granted anything explicitly. Without these grants
-- every REST query fails with 42501 "permission denied" before RLS is even
-- consulted.
--
-- RLS remains the actual access-control layer (see is_household_member and
-- each table's "household rw" policy); these grants are the table-level
-- floor PostgREST needs underneath it.
--
-- anon is deliberately omitted: this app is invite-only and nothing queries
-- the public schema before sign-in.

grant select, insert, update, delete
  on all tables in schema public
  to authenticated, service_role;

-- Future phases' migrations run as postgres too — give their tables the same
-- grants automatically so each migration doesn't have to repeat this.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables
  to authenticated, service_role;
