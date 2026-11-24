import { redirect } from "next/navigation";

// The Astryx desk is /admin/leads since the original desk retired.
export default function LeadsAstryxPage() {
  redirect("/admin/leads");
}
