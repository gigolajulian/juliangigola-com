import type { Status } from "@/lib/admin/publish";
import { cn } from "@/lib/utils";

/** A panel's outcome line (projects, trash, new project): nothing while idle, red on an error. */
export function StatusLine({ status, className }: { status: Status; className?: string }) {
  if (status.kind === "idle") return null;
  return <p className={cn("label", className, status.kind === "error" ? "text-destructive" : "text-muted-foreground")}>{status.message}</p>;
}
