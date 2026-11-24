/* The repository /admin publishes to and the GitHub token shapes it accepts.
   No browser storage here, so the server gate (`lib/admin/vouch.ts`) and the editor both import it. */

export const REPO = {
  owner: "gigolajulian",
  repo: "juliangigola-com",
  branch: "main",
};
/** GitHub's REST API, for the reads and commits /admin makes. */
export const GITHUB_API = "https://api.github.com";

/** Whether a pasted key looks like one of the two GitHub token kinds /admin is set up with: classic or fine-grained. */
export const isGithubToken = (k: string) => /^(ghp_|github_pat_)/.test(k);
