-- The session that started an OAuth round trip (link: required; login: the browser's earlier session, if any).
-- Ending that session (sign-out, revoke, expiry clean-up) deletes its pending states.
alter table oauth_states add column session_id uuid references sessions(id) on delete cascade;
