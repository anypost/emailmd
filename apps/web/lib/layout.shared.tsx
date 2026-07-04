import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { McpInstallMenu } from "@/components/mcp-install";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span
          style={{
            fontFamily: "var(--font-audiowide)",
          }}
        >
          _emailmd_
        </span>
      ),
    },
    githubUrl: "https://github.com/anypost/emailmd",
    links: [
      {
        text: "Templates",
        url: "/templates",
      },
      {
        text: "Builder",
        url: "/builder",
      },
      {
        text: "Docs",
        url: "/docs",
      },
      {
        type: "custom",
        secondary: true,
        children: <McpInstallMenu />,
      },
    ],
  };
}
