#!/bin/sh
# docker-compose.yml: PostgreSQL runs this once, when its volume is new. The app role of DATABASE_URL gets SELECT,
# INSERT, UPDATE, DELETE on every table the owner (POSTGRES_USER, the MIGRATION_DATABASE_URL user) creates later, and
# nothing else: it can't change the schema. The password goes in as a psql variable, never into the SQL text.
set -eu
psql -v ON_ERROR_STOP=1 -v pw="$APP_DB_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
create role starterkit_app login password :'pw';
grant usage on schema public to starterkit_app;
alter default privileges in schema public grant select, insert, update, delete on tables to starterkit_app;
SQL
