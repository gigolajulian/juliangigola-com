import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Two suites, named rather than found, so the copies of the repo under
// `.claude/worktrees` are not run as well:
//   frontend: unit tests beside the code in `lib` (motion, the gooey patch)
//   backend:  request-level tests of the API routes, the contact action
//             and the book Worker, in `tests/backend`
// `node scripts/test/gate.mjs --frontend` or `--backend` runs one each.
const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "frontend", include: ["lib/**/*.test.ts"] } },
      { resolve: { alias }, test: { name: "backend", include: ["tests/backend/**/*.test.ts"], environment: "node" } },
    ],
  },
});
