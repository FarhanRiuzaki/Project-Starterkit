-- Indexes the list queries and cascades need at scale (0001 stays as applied).

-- GET /v1/users sort keys, as users/queries.ts USER_SORTS orders them. `lower(email)` is users_email_key (0001).
-- Never signed in sorts last both ways, so each direction of lastLoginAt has its own index.
create index users_name_lower on users (lower(name), id);
create index users_last_login_asc on users ((last_login_at is null), last_login_at, id);
create index users_last_login_desc on users ((last_login_at is null), last_login_at desc, id desc);

-- A user's own activity, newest first; replaces activity_actor (a prefix of it).
create index activity_actor_at on activity (actor_id, at desc);
drop index activity_actor;

-- Deleting a user cascades here (0001 left them without an index on user_id).
create index auth_challenges_user_id on auth_challenges (user_id);
create index oauth_states_user_id on oauth_states (user_id);
