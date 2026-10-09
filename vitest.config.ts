import { defineConfig } from "vitest/config";

// Unit tests live beside the code in `lib`. Named rather than found, so
// the copies of the repo under `.claude/worktrees` are not run as well.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
