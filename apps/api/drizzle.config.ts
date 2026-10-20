import { defineConfig } from "drizzle-kit";

// `bunx drizzle-kit generate` writes drizzle/NNNN_*.sql from every module's tables; `--custom --name=…` makes an empty
// file for what drizzle-kit can't express. db/migrate.ts applies them (advisory lock + checksum); drizzle-kit never
// touches a database here. After generating, strip the schema it writes into foreign keys, so a migration runs in
// whatever schema is first on the search_path (test/db/migrate.test.ts migrates throwaway schemas and fails otherwise):
//   sed -i '' 's/REFERENCES "public"\./REFERENCES /g' drizzle/NNNN_*.sql   (GNU sed: -i without '')
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/schema.ts",
  out: "./drizzle",
});
