import { getImageProps } from "next/image";
import { coverSizes, frameSizes } from "@/lib/frame-sizes";
import { COMMISSIONS, COVER_ART, isDisciplineGallery, projectsIn } from "@/lib/work";

/** The first three photographs a discipline opens on, with the files its
    page will ask for, so the one before can fetch them on its way to the
    end (`warm` on `Lead`). Cover art opens on its sleeves, which come in
    fast enough. */
export const opening = (slug: string) => {
  const gallery = projectsIn(slug).find(isDisciplineGallery);
  if (gallery?.slug === COVER_ART?.slug) return undefined;
  const first = gallery
    ? gallery.images.slice(0, 3).map((f) => ({ f, sizes: frameSizes(f) }))
    : COMMISSIONS.filter((p) => p.categories.some((c) => c.slug === slug))
        .slice(0, 3)
        .map((p) => ({ f: p.cover, sizes: coverSizes(p.cover) }));
  return first.map(({ f, sizes }) => {
    const { props } = getImageProps({ src: f.src, alt: "", fill: true, sizes });
    return { src: props.src, srcSet: props.srcSet, sizes };
  });
};
