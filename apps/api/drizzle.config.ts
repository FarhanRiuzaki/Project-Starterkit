import { defineConfig } from "drizzle-kit";

// `bun run db:generate` (src/db/generate.ts) runs `drizzle-kit generate`, which writes drizzle/NNNN_*.sql from every
// module's tables (`-- --custom --name=…` makes an empty file for what drizzle-kit can't express), then strips the schema
// it writes into foreign keys, so a migration runs in whatever schema is first on the search_path
// (test/db/migrate.test.ts migrates throwaway schemas and fails otherwise). db/migrate.ts applies them (advisory lock +
// checksum); drizzle-kit never touches a database here.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/schema.ts",
  out: "./drizzle",
});
