/** The INBOX KV namespace as every store reads it (leads, proofs, contracts, the activity log): get, put, list, delete. */
export type InboxKV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;
