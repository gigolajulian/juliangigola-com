import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Cloudflare adapter's output and wrangler's local state. Neither is
    // in the default list because eslint-config-next has never heard of
    // them, and a local `opennextjs-cloudflare build` otherwise puts eleven
    // thousand findings from the bundled worker in front of the four real
    // ones.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
