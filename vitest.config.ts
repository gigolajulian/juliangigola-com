import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Two suites, named rather than found, so the copies of the repo under
// `.claude/worktrees` are not run as well:
//   frontend: unit tests beside the code in `lib` (motion, the gooey patch, keep-names)
//   backend:  the API routes, the contact action, the book Worker and the
//             server-side lib modules (leads, proofs, invoices), in `tests/backend`
//   components: render smoke tests in jsdom, in `tests/components`
// `node scripts/test/gate.mjs --frontend` or `--backend` runs one each.
const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "frontend", include: ["lib/**/*.test.ts"] } },
      { resolve: { alias }, test: { name: "backend", include: ["tests/backend/**/*.test.ts"], environment: "node" } },
      {
        resolve: { alias },
        test: {
          name: "components",
          include: ["tests/components/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/components/setup.ts"],
        },
      },
    ],
  },
});
