import { defineConfig } from "drizzle-kit";

// `bunx drizzle-kit generate` writes drizzle/NNNN_*.sql from every module's tables; `--custom --name=…` makes an empty
// file for what drizzle-kit can't express. db/migrate.ts applies them (advisory lock + checksum); drizzle-kit never
// touches a database here.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/schema.ts",
  out: "./drizzle",
});
