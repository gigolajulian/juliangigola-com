"use client";

import * as React from "react";
import { BorderBeam } from "border-beam";
import { useSiteTheme } from "@/lib/site-theme";

/* Julian: the form in a beam (`border-beam`, Libraries.dev), at his
   settings: the full border, colorful, 0.7, in the site's own theme. */
export function ContactBeam({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const theme = useSiteTheme();
  return (
    <BorderBeam
      size="md"
      colorVariant="colorful"
      strength={0.7}
      theme={theme}
      /* Julian: rounded, 16px, with the form's box (`rounded-[16px]`,
         `app/contact/page.tsx`). */
      borderRadius={16}
      className={className}
    >
      {children}
    </BorderBeam>
  );
}
