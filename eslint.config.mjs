// Flat config: Next core-web-vitals (react, react-hooks incl. the React Compiler rules, jsx-a11y, @next) + TypeScript.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  { settings: { next: { rootDir: ["apps/web/"] } } },
  { ignores: [".next/**", "node_modules/**", "test-results/**", "next-env.d.ts", "**/.next/**", "**/.next-e2e/**", ".superpowers/**"] },
];

export default config;
