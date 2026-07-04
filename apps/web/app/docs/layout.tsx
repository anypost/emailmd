import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import { Footer } from "@/components/footer";
import { McpInstallMenu } from "@/components/mcp-install";

export default function Layout({ children }: { children: ReactNode }) {
  // The header "Add to AI" item reads as a stray link in the docs sidebar;
  // render it as a full-width control under the search box instead.
  const { links, ...base } = baseOptions();
  return (
    <>
      <DocsLayout
        tree={source.getPageTree()}
        {...base}
        links={links?.filter((link) => !("type" in link && link.type === "custom"))}
        sidebar={{
          banner: <McpInstallMenu className="w-full justify-between" />,
        }}
      >
        {children}
      </DocsLayout>
      <Footer />
    </>
  );
}
