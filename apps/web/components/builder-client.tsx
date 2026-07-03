"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import "@emailmd/react/styles.css";

// emailmd renders via mjml-browser; the builder is client-only.
const EmailmdBuilder = dynamic(
  () => import("@emailmd/react").then((mod) => mod.EmailmdBuilder),
  { ssr: false }
);

export function BuilderClient({
  initialMarkdown,
}: {
  initialMarkdown?: string;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <EmailmdBuilder
      defaultValue={initialMarkdown}
      share
      colorScheme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
