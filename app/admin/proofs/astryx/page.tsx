import { redirect } from "next/navigation";

// The proofs desk is /admin/proofs since the original desk retired.
export default function ProofsAstryxPage() {
  redirect("/admin/proofs");
}
