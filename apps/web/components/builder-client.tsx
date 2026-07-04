"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Blocks, Sparkles } from "lucide-react";
import { McpInstallDialog } from "@/components/mcp-install";
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
  const router = useRouter();
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <>
      <EmailmdBuilder
        defaultValue={initialMarkdown}
        share
        lint
        colorScheme={resolvedTheme === "dark" ? "dark" : "light"}
        toolbarItems={[
          {
            id: "ai",
            label: "AI",
            icon: <Sparkles />,
            tooltip: "Use emailmd with your AI",
            onClick: () => setAiOpen(true),
          },
          {
            id: "embed",
            label: "Embed",
            icon: <Blocks />,
            tooltip: "Embed this builder in your own app",
            onClick: () => router.push("/docs/react"),
          },
        ]}
      />
      <McpInstallDialog open={aiOpen} onOpenChange={setAiOpen} />
    </>
  );
}
