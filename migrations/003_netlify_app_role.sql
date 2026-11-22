-- Netlify CLI only exposes the netlifydb_readonly DSN to user tokens.
-- If the runtime still lands on that role, it needs write access on public.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'netlifydb_readonly') then
    grant usage, create on schema public to netlifydb_readonly;
    grant all privileges on all tables in schema public to netlifydb_readonly;
    grant all privileges on all sequences in schema public to netlifydb_readonly;
    grant all privileges on all functions in schema public to netlifydb_readonly;
    alter default privileges in schema public grant all on tables to netlifydb_readonly;
    alter default privileges in schema public grant all on sequences to netlifydb_readonly;
  end if;
end
$$;
