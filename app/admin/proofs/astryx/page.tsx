import { redirect } from "next/navigation";

// The proofs desk is /admin/proofs since the original desk retired (2026-11-11).
export default function ProofsAstryxPage() {
  redirect("/admin/proofs");
}
