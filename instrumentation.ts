/** Anything a route or page throws mails hello@ (`lib/email/error-alert.ts`), once an hour per route. */
export async function onRequestError(err: unknown, request: { method: string; path: string }, context: { routePath?: string }) {
  const { reportError } = await import("@/lib/email/error-alert");
  await reportError(`${request.method} ${context.routePath ?? "unknown route"}`, err);
}
