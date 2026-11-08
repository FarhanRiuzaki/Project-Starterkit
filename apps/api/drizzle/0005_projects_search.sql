-- Search of GET /v1/projects through a pg_trgm GIN index (ILIKE '%q%'); the extension comes from 0001_custom.sql.
create index projects_name_trgm on projects using gin (name gin_trgm_ops);
