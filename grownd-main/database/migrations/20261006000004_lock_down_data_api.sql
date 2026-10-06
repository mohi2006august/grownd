-- Locks Supabase's auto-generated Data API (the REST API that answers with the public anon key) out
-- of everything. The GROWND API connects as the postgres user, so none of this changes what it can do.
--
-- 1. schema_migrations (made by `npm run db:migrate`) could be read and changed with the anon key.
--    It now has row level security and no grants, like every other table.
-- 2. Tables, sequences and functions made from now on are no longer granted to anon and
--    authenticated automatically, so a future table is closed even if its migration forgets to.
-- 3. The trigger function gets a fixed search_path, as Supabase's security advisor asks.

alter table public.schema_migrations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.schema_migrations from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke execute on function public.set_updated_at() from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
    alter default privileges in schema public revoke all on functions from anon, authenticated;
  end if;
end;
$$;

revoke execute on function public.set_updated_at() from public;
alter function public.set_updated_at() set search_path = '';
