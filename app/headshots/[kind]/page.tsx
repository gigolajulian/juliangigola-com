import { GuideView, guideMetadata } from "@/components/booking/guide";

/* /headshots/teams and /headshots/models, under the headshots booking page (`GUIDE_PAGES`). */

export function generateStaticParams() {
  return [{ kind: "teams" }, { kind: "models" }];
}

export async function generateMetadata(props: PageProps<"/headshots/[kind]">) {
  return guideMetadata(`headshots/${(await props.params).kind}`);
}

export default async function HeadshotsGuide(props: PageProps<"/headshots/[kind]">) {
  return <GuideView slug={`headshots/${(await props.params).kind}`} />;
}
