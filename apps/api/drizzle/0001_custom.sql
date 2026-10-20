-- What drizzle-kit can't express: the pg_trgm search indexes, UNLOGGED tables and the append-only audit trigger.

-- Search through pg_trgm GIN indexes (ILIKE '%q%').
create extension if not exists pg_trgm;
create index users_name_trgm on users using gin (name gin_trgm_ops);
create index users_username_trgm on users using gin (username gin_trgm_ops);
create index users_email_trgm on users using gin (email gin_trgm_ops);

-- Rate limits and sign-in backoff: shared by every API process, not worth WAL (lost on a crash, by design).
alter table rate_limits set unlogged;
alter table login_backoff set unlogged;

-- Audit rows are append-only.
create function audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit rows are append-only';
end
$$;
create trigger activity_append_only before update on activity for each row execute function audit_append_only();
create trigger auth_log_append_only before update on auth_log for each row execute function audit_append_only();
