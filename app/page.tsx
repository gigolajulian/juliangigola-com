import { V3Home } from "@/components/v3/home";
import { PROJECTS } from "@/lib/work";

/* JG V3 homepage (master v39). The old deck (strip, cover float, screens)
   is retired; its components are left in place, unused. */
export default function Home() {
  return <V3Home count={PROJECTS.length} />;
}
