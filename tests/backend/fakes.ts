/* Stand-ins for the Worker's bindings, for the backend suite.
 *
 * Only what the routes call: KV's get, getWithMetadata, put, delete and
 * list (prefix, metadata, sorted keys, as KV lists them), and the email
 * binding's send. Each fake keeps what it was asked, so a test can check
 * the writes as well as the answer. */

type Entry = { value: string | ArrayBuffer; metadata?: unknown; ttl?: number };

export class FakeKV {
  data = new Map<string, Entry>();
  puts: string[] = [];
  /** Set to make every call throw, as a KV outage would. */
  broken = false;

  private check() {
    if (this.broken) throw new Error("KV is down");
  }

  async get(key: string, type?: string) {
    this.check();
    const e = this.data.get(key);
    if (!e) return null;
    if (type === "arrayBuffer") return e.value;
    return typeof e.value === "string" ? e.value : new TextDecoder().decode(e.value);
  }

  async getWithMetadata(key: string, type?: string) {
    this.check();
    const e = this.data.get(key);
    return { value: e ? await this.get(key, type) : null, metadata: e?.metadata ?? null };
  }

  async put(key: string, value: string | ArrayBuffer, opts: { metadata?: unknown; expirationTtl?: number } = {}) {
    this.check();
    this.puts.push(key);
    this.data.set(key, { value, metadata: opts.metadata, ttl: opts.expirationTtl });
  }

  async delete(key: string) {
    this.check();
    this.data.delete(key);
  }

  async list({ prefix = "", limit = 1000, cursor }: { prefix?: string; limit?: number; cursor?: string } = {}) {
    this.check();
    const names = [...this.data.keys()].filter((k) => k.startsWith(prefix)).sort();
    // As KV pages a long list: the cursor here is where the next page starts.
    const from = cursor ? Number(cursor) : 0;
    const page = names.slice(from, from + limit);
    const complete = from + limit >= names.length;
    return {
      keys: page.map((name) => ({ name, metadata: this.data.get(name)!.metadata })),
      list_complete: complete,
      ...(complete ? {} : { cursor: String(from + limit) }),
    };
  }

  json(key: string) {
    const v = this.data.get(key)?.value;
    return typeof v === "string" ? JSON.parse(v) : undefined;
  }
}

export class FakeEmail {
  sent: Record<string, unknown>[] = [];
  broken = false;
  async send(msg: Record<string, unknown>) {
    if (this.broken) throw new Error("destination not verified");
    this.sent.push(msg);
  }
}

/** A Response for a mocked fetch. */
export const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

/** A token in the shape GitHub issues, unique per call so the vouch cache
    (five minutes, module-wide) never answers for another test. */
let n = 0;
export const githubToken = () => `ghp_${"t".repeat(30)}${String(++n).padStart(6, "0")}`;
