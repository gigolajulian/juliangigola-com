import { redirect } from "next/navigation";

// The Astryx desk is /admin/leads since the original desk retired (2026-11-11).
export default function LeadsAstryxPage() {
  redirect("/admin/leads");
}
