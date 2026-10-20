-- Whole schema of the API. Ids are UUIDv7 made by the app (Bun.randomUUIDv7()). Case-insensitive uniqueness through
-- lower() indexes; search through pg_trgm GIN indexes (ILIKE '%q%').
create extension if not exists pg_trgm;

create table users (
  id uuid primary key,
  name text not null,
  username text not null,
  email text not null,
  avatar_url text,
  is_active boolean not null default true,
  is_ldap boolean not null default false,
  password_hash text,
  totp_secret text,           -- encrypted (v1:…); not null = two-factor on
  pending_totp_secret text,   -- encrypted; set by POST /me/2fa until PUT confirms a code
  totp_last_step bigint,      -- TOTP step of the last accepted code (replay guard)
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_username_key on users (lower(username));
create unique index users_email_key on users (lower(email));
create index users_name_trgm on users using gin (name gin_trgm_ops);
create index users_username_trgm on users using gin (username gin_trgm_ops);
create index users_email_trgm on users using gin (email gin_trgm_ops);
create index users_created_at on users (created_at);

create table roles (
  id uuid primary key,
  name text not null,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index roles_name_key on roles (lower(name));

-- The permission catalog; `position` = catalog order.
create table permissions (
  name text primary key,
  position int not null
);

create table role_permissions (
  role_id uuid not null references roles on delete cascade,
  permission text not null references permissions (name),
  primary key (role_id, permission)
);

create table user_roles (
  user_id uuid not null references users on delete cascade,
  role_id uuid not null references roles on delete restrict,
  primary key (user_id, role_id)
);
create index user_roles_role_id on user_roles (role_id);

create table recovery_codes (
  id uuid primary key,
  user_id uuid not null references users on delete cascade,
  code_hash text not null,
  used_at timestamptz
);
create index recovery_codes_user_id on recovery_codes (user_id);

create table user_identities (
  user_id uuid not null references users on delete cascade,
  provider text not null check (provider in ('google', 'apple')),
  subject text not null,
  email text,
  created_at timestamptz not null default now(),
  primary key (provider, subject),
  unique (user_id, provider)
);

create table sessions (
  id uuid primary key,
  token_hash bytea not null unique,
  user_id uuid not null references users on delete cascade,
  method text not null check (method in ('password', 'ldap', 'google', 'apple')),
  device text not null,
  ip text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_id on sessions (user_id);
create index sessions_expires_at on sessions (expires_at);

-- A sign-in waiting for its second factor.
create table auth_challenges (
  id uuid primary key,
  token_hash bytea not null unique,
  user_id uuid not null references users on delete cascade,
  method text not null check (method in ('password', 'ldap', 'google', 'apple')),
  next text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Reset and invitation links: one live link per user.
create table user_tokens (
  token_hash bytea primary key,
  user_id uuid not null unique references users on delete cascade,
  kind text not null check (kind in ('reset', 'invite')),
  expires_at timestamptz not null
);

create table oauth_states (
  state_hash bytea primary key,
  provider text not null check (provider in ('google', 'apple')),
  mode text not null check (mode in ('login', 'link')),
  user_id uuid references users on delete cascade,
  binding_hash bytea not null,
  code_verifier text not null,
  nonce text not null,
  next text,
  expires_at timestamptz not null
);

-- Audit: actor and target are copied as they were (no foreign keys), so entries outlive what they name.
create table activity (
  id uuid primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_name text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  target_label text not null,
  before jsonb,
  after jsonb
);
create index activity_at on activity (at desc, id desc);
create index activity_target on activity (target_id, at desc);
create index activity_actor on activity (actor_id);
create index activity_action on activity (action, at desc);

create table auth_log (
  id uuid primary key,
  at timestamptz not null default now(),
  event text not null check (event in ('login_success', 'password_ok', 'login_failed', 'logout', '2fa_success', '2fa_failed', 'password_reset')),
  login text not null,
  user_id uuid,
  method text not null check (method in ('password', 'ldap', 'google', 'apple')),
  ip text not null,
  device text not null,
  location text
);
create index auth_log_at on auth_log (at desc, id desc);
create index auth_log_user on auth_log (user_id, at desc);
create index auth_log_event on auth_log (event, at desc);

create function audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit rows are append-only';
end
$$;
create trigger activity_append_only before update on activity for each row execute function audit_append_only();
create trigger auth_log_append_only before update on auth_log for each row execute function audit_append_only();

-- Rate limits and sign-in backoff: shared by every API process, not worth WAL (lost on a crash, by design).
create unlogged table rate_limits (
  key text primary key,
  count int not null,
  window_start timestamptz not null
);
create unlogged table login_backoff (
  key text primary key,
  failures int not null,
  blocked_until timestamptz,
  last_failure_at timestamptz not null
);
