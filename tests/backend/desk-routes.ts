import { INBOX_KEY } from "./fakes";

/* The lead desk's routes under /api/leads, by path, for tests that walk the desk. Imported when first called,
   so each test file's `vi.mock("@opennextjs/cloudflare")` is in place first. */

const ROUTES = {
  "": () => import("@/app/api/leads/route"),
  "/push": () => import("@/app/api/leads/push/route"),
  "/templates": () => import("@/app/api/leads/templates/route"),
  "/invoices": () => import("@/app/api/leads/invoices/route"),
  "/invoice-from": () => import("@/app/api/leads/invoice-from/route"),
  "/invoice-photo": () => import("@/app/api/leads/invoice-photo/route"),
  "/tasks": () => import("@/app/api/leads/tasks/route"),
  "/log": () => import("@/app/api/leads/log/route"),
  "/stats": () => import("@/app/api/leads/stats/route"),
  "/csv": () => import("@/app/api/leads/csv/route"),
  "/import/inbox": () => import("@/app/api/leads/import/inbox/route"),
  "/import/notion": () => import("@/app/api/leads/import/notion/route"),
  "/import/stripe": () => import("@/app/api/leads/import/stripe/route"),
};

type Method = "GET" | "PUT" | "PATCH" | "POST" | "DELETE";
type Handler = (r: Request) => Promise<Response>;

/** One request to `/api/leads<path>` (path may carry a query), with the inbox key unless `key` says otherwise. A string body goes as is. */
export async function desk(method: Method, path = "", { body, key = INBOX_KEY, token }: { body?: unknown; key?: string | null; token?: string } = {}) {
  const at = path.split("?")[0] as keyof typeof ROUTES;
  const route = ROUTES[at];
  if (!route) throw new Error(`No route /api/leads${at}`);
  const handler = ((await route()) as Partial<Record<Method, Handler>>)[method];
  if (!handler) throw new Error(`No ${method} on /api/leads${at}`);
  const headers: Record<string, string> = { ...(key ? { "x-admin-key": key } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  return handler(new Request(`https://juliangigola.com/api/leads${path}`, { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), headers }));
}
