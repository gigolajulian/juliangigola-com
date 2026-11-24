import { describe, expect, it, vi } from "vitest";
import { contractStep } from "@/lib/contracts/contract-lead";
import { readLead, writeLead } from "@/lib/leads/lead-store";
import { sealer } from "@/lib/leads/lead-crypto";
import { applyLeadEvent } from "@/lib/leads/leads";
import { FakeKV, LEADS_KEY } from "./fakes";

/* A contract's step on its lead (`lib/contracts/contract-lead.ts`): the
   Contract paper and a timeline line, and never a throw, because the
   signature is already stored by the time this runs. */

const at = "2026-11-15T18:00:00.000Z";
const signed = { at, kind: "contract" as const, ref: "signed:c1" };

async function withLead() {
  const kv = new FakeKV();
  const s = (await sealer(LEADS_KEY))!;
  const id = await s.id("ana@example.com");
  await writeLead(kv as never, s, id, applyLeadEvent(null, "ana@example.com", { event: { at, kind: "inquiry", ref: "msg:1" }, name: "Ana" }));
  return { kv, s, id };
}

describe("contractStep", () => {
  it("sets the paper and adds the event to the stored lead", async () => {
    const { kv, s, id } = await withLead();
    const lead = await contractStep(kv as never, s, id, "Signed", signed);
    expect(lead?.contract).toBe("Signed");
    const stored = await readLead(kv as never, s, id);
    expect(stored?.contract).toBe("Signed");
    expect(stored?.events.some((e) => e.kind === "contract" && e.ref === "signed:c1")).toBe(true);
  });

  it("is null for a lead that is not there", async () => {
    const { kv, s } = await withLead();
    expect(await contractStep(kv as never, s, "missing", "Sent", signed)).toBeNull();
  });

  it("is null, not a throw, when KV is down", async () => {
    const { kv, s, id } = await withLead();
    kv.broken = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(contractStep(kv as never, s, id, "Signed", signed)).resolves.toBeNull();
    expect(err).toHaveBeenCalledWith("contract lead", expect.stringContaining("KV is down"));
    err.mockRestore();
  });
});
