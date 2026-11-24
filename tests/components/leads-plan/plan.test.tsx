import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LeadDesk } from "@/components/leads/lead";
import { deskCall } from "@/lib/leads/lead-desk";
import { cleanTasks } from "@/lib/leads/lead-crm";
import type { Lead, Task } from "@/lib/leads/leads";
import { lead } from "../leads/leads-fixtures";

/* The shoot plan and tasks on a lead (`components/leads/plan.tsx`), through
   the desk's real fetch: adding a task and ticking one each send the whole
   list in the lead's PATCH, in the shape `cleanTasks` takes on the server. */

const summary = lead("a", { name: "Ana Ruiz", stage: "Confirmed" });
const task: Task = { id: "t1", text: "Rent red gel and snoot", due: "2026-12-02" };
const full = { ...summary, events: [], plan: { brief: "One hard light, grey seamless." }, tasks: [task] } as unknown as Lead;

let patches: Record<string, unknown>[];
// The whole desk mounts; under a full parallel run it can take past the default second.
const slow = { timeout: 5000 };

beforeEach(() => {
  patches = [];
  // TaskForm brings itself into view; jsdom has no scrollIntoView.
  Element.prototype.scrollIntoView ??= () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
      if (init.method === "PATCH") {
        const sent = JSON.parse(String(init.body));
        patches.push(sent);
        return body({ lead: { ...full, tasks: sent.tasks } });
      }
      if (url.startsWith("/api/leads/log")) return body({ log: [] });
      if (url.startsWith("/api/leads?id=")) return body({ lead: full });
      if (url === "/api/contract?templates") return body({ templates: [] });
      return body({ proofs: [] });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderDesk = () =>
  render(<LeadDesk summary={summary} call={deskCall} onChange={() => {}} onBack={() => {}} reload={() => {}} templates={[]} others={[]} size="wide" />);

describe("the plan and tasks on a lead", () => {
  it("shows the brief and the open task", async () => {
    renderDesk();
    expect(await screen.findByText("One hard light, grey seamless.", {}, slow)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Rent red gel and snoot" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("0 of 1 done")).toBeTruthy();
  });

  it("adds a task as the whole list in one PATCH", async () => {
    renderDesk();
    await screen.findByRole("checkbox", { name: "Rent red gel and snoot" }, slow);
    await waitFor(() => expect((screen.getByRole("button", { name: "Add a task" }) as HTMLButtonElement).disabled).toBe(false), slow);
    fireEvent.click(screen.getByRole("button", { name: "Add a task" }));
    fireEvent.change(screen.getByLabelText("Task"), { target: { value: "  Book the studio  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(patches).toHaveLength(1), slow);
    const sent = patches[0];
    expect(sent).toEqual({ key: "lead:a", tasks: [task, { id: expect.stringMatching(/^[a-z0-9]+$/), text: "Book the studio" }] });
    const checked = cleanTasks(sent.tasks, full.tasks);
    expect(checked).not.toHaveProperty("error");
    expect((checked as { tasks: Task[] }).tasks.map((t) => t.text)).toEqual(["Rent red gel and snoot", "Book the studio"]);
  });

  it("ticks a task with a done time the server keeps", async () => {
    renderDesk();
    const box = (await screen.findByRole("checkbox", { name: "Rent red gel and snoot" }, slow)) as HTMLInputElement;
    await waitFor(() => expect(box.disabled).toBe(false), slow);
    fireEvent.click(box);
    await waitFor(() => expect(patches).toHaveLength(1), slow);
    expect(patches[0]).toEqual({ key: "lead:a", tasks: [{ ...task, doneAt: expect.any(String) }] });
    const checked = cleanTasks(patches[0].tasks, full.tasks, [], "2026-12-01T18:00:00.000Z") as { tasks: Task[]; events: unknown[] };
    expect(checked.tasks[0].doneAt).toBe("2026-12-01T18:00:00.000Z");
    expect(checked.events).toEqual([{ at: "2026-12-01T18:00:00.000Z", kind: "task", ref: "task:t1", note: "Rent red gel and snoot" }]);
  });
});
