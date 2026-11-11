"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type Template } from "@/lib/lead-crm";
import { type Call, errorText } from "@/lib/lead-desk";
import { btn, field, fieldLabel, primary } from "@/components/admin/leads/shared";

/** His saved replies. {first}, {name}, {kind} and {when} are filled per lead. */
export function TemplatesEditor({ call, templates, saved }: { call: Call; templates: Template[]; saved: (t: Template[]) => void }) {
  const [list, setList] = React.useState(templates);
  const [note, setNote] = React.useState<string | null>(null);
  const edit = (i: number, k: keyof Template) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setList(list.map((t, j) => (j === i ? { ...t, [k]: e.target.value } : t)));
  const save = () =>
    call<{ templates: Template[] }>({ method: "PATCH", body: JSON.stringify({ templates: list }) })
      .then((o) => { saved(o.templates); setList(o.templates); setNote("Saved."); })
      .catch((e: unknown) => setNote(errorText(e)));
  return (
    <div className="grid gap-5 px-1 py-5 lg:px-5">
      <p className="text-[14px] text-muted-foreground">
        <code className="font-mono text-[13px] text-foreground">{"{first}"}</code>, <code className="font-mono text-[13px] text-foreground">{"{name}"}</code>,{" "}
        <code className="font-mono text-[13px] text-foreground">{"{kind}"}</code> and <code className="font-mono text-[13px] text-foreground">{"{when}"}</code> fill in for each lead.
      </p>
      {list.map((t, i) => (
        <fieldset key={t.id + i} className="grid gap-2.5 rounded-xl border border-border p-3.5">
          <label className={fieldLabel}>Name<input value={t.name} onChange={edit(i, "name")} className={field} /></label>
          <label className={fieldLabel}>Subject<input value={t.subject} onChange={edit(i, "subject")} className={field} /></label>
          <label className={fieldLabel}>Message<textarea value={t.body} onChange={edit(i, "body")} rows={6} className={cn(field, "py-3 leading-relaxed")} /></label>
          <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} className={cn(btn, "justify-self-start text-destructive")}>Remove</button>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => setList([...list, { id: `t${Date.now()}`, name: "New template", subject: "", body: "Hi {first},\n\n\n\nJulian" }])} className={btn}>Add a template</button>
        <button type="button" onClick={save} className={cn(btn, primary)}>Save templates</button>
      </div>
      {note ? <p role="status" className="font-mono text-[13px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}
