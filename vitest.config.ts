import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Three suites, named rather than found, so the copies of the repo under
// `.claude/worktrees` are not run as well. The test folders mirror the source:
// `tests/lib/<domain>` for `lib/<domain>`, `tests/components/<domain>` for
// `components/<domain>`, `tests/backend/<route family>` for the routes a family
// serves, with the shared fakes at the top of `tests/backend`.
//   frontend:   the client-side lib unit tests (motion, flags, home data,
//               keep-names), the files in FRONTEND_LIB
//   backend:    every other lib unit test (leads, proofs, booking, admin,
//               email, work), and the API routes, the contact action and the
//               book Worker in `tests/backend`
//   components: render tests in jsdom, in `tests/components`
// `node scripts/test/gate.mjs --frontend` or `--backend` runs one side each.
const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

const FRONTEND_LIB = [
  "tests/lib/flags/**/*.test.ts",
  "tests/lib/graduation/grad-year.test.ts",
  "tests/lib/home/**/*.test.ts",
  "tests/lib/json.test.ts",
  "tests/lib/keep-names.test.ts",
  "tests/lib/motion/hold-ease.test.ts",
  "tests/lib/motion/spring.test.ts",
  "tests/lib/motion/throw.test.ts",
  "tests/lib/motion/wheel.test.ts",
  "tests/lib/plain-src.test.ts",
  "tests/lib/work/cover-art-match.test.ts",
];

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "frontend", include: FRONTEND_LIB } },
      {
        resolve: { alias },
        test: {
          name: "backend",
          include: ["tests/backend/**/*.test.ts", "tests/lib/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...FRONTEND_LIB],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "components",
          include: ["tests/components/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["tests/components/setup.ts"],
        },
      },
    ],
  },
});
