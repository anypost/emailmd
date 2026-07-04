"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const MCP_URL = "https://www.emailmd.dev/api/mcp";

const CLAUDE_CODE_COMMAND = `claude mcp add --transport http emailmd ${MCP_URL}`;
const LOCAL_COMMAND = "npx emailmd mcp";

const CURSOR_DEEPLINK = `cursor://anysphere.cursor-deeplink/mcp/install?name=emailmd&config=${btoa(
  JSON.stringify({ url: MCP_URL })
)}`;

const VSCODE_DEEPLINK = `vscode:mcp/install?${encodeURIComponent(
  JSON.stringify({ name: "emailmd", type: "http", url: MCP_URL })
)}`;

type McpClient = {
  name: string;
  hint: string;
  /** Deep link to open, if the client supports one-click installs. */
  href?: string;
  /** Text to copy, for clients configured by pasting a command or URL. */
  copy?: string;
  /** Settings page to open alongside the copy. */
  open?: string;
};

const MCP_CLIENTS: McpClient[] = [
  {
    name: "Claude Code",
    hint: "Copies the install command",
    copy: CLAUDE_CODE_COMMAND,
  },
  {
    name: "Claude.ai & Desktop",
    hint: "Copies the URL, opens Connectors settings",
    copy: MCP_URL,
    open: "https://claude.ai/customize/connectors",
  },
  {
    name: "ChatGPT",
    hint: "Copies the URL for Settings → Connectors",
    copy: MCP_URL,
  },
  {
    name: "Cursor",
    hint: "Opens Cursor to install",
    href: CURSOR_DEEPLINK,
  },
  {
    name: "VS Code",
    hint: "Opens VS Code to install",
    href: VSCODE_DEEPLINK,
  },
];

function useCopied(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(key: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }
  return [copied, copy];
}

/** Compact "Add to AI" dropdown for the site header (pass className to restyle the trigger). */
export function McpInstallMenu({ className }: { className?: string }) {
  const [copied, copy] = useCopied();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted",
          className
        )}
      >
        Add to AI
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground">
          Connect the emailmd MCP server
        </DropdownMenuLabel>
        {MCP_CLIENTS.map((client) =>
          client.href ? (
            <DropdownMenuItem key={client.name} asChild>
              <a href={client.href} className="flex w-full cursor-pointer flex-col items-start gap-0.5 px-2 py-1.5">
                <span className="flex items-center gap-1.5 text-sm">
                  {client.name}
                  <ExternalLink className="size-3 text-muted-foreground" />
                </span>
                <span className="text-xs text-muted-foreground">{client.hint}</span>
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={client.name}
              className="flex cursor-pointer flex-col items-start gap-0.5 px-2 py-1.5"
              onSelect={(e) => {
                e.preventDefault();
                copy(client.name, client.copy!);
                if (client.open) window.open(client.open, "_blank");
              }}
            >
              <span className="flex items-center gap-1.5 text-sm">
                {client.name}
                {copied === client.name ? (
                  <Check className="size-3 text-green-600" />
                ) : (
                  <Copy className="size-3 text-muted-foreground" />
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {copied === client.name ? "Copied to clipboard" : client.hint}
              </span>
            </DropdownMenuItem>
          )
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex cursor-pointer flex-col items-start gap-0.5 px-2 py-1.5"
          onSelect={(e) => {
            e.preventDefault();
            copy("local", LOCAL_COMMAND);
          }}
        >
          <span className="flex items-center gap-1.5 font-mono text-xs">
            {LOCAL_COMMAND}
            {copied === "local" ? (
              <Check className="size-3 text-green-600" />
            ) : (
              <Copy className="size-3 text-muted-foreground" />
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {copied === "local" ? "Copied to clipboard" : "Run the server locally over stdio"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const pillClass =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted";

/** Full button row for the home page and docs. */
export function McpInstallButtons() {
  const [copied, copy] = useCopied();

  function label(client: McpClient): ReactNode {
    if (copied === client.name) {
      return (
        <>
          {client.name} <Check className="size-3.5 text-green-600" />
        </>
      );
    }
    return client.name;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {MCP_CLIENTS.map((client) =>
        client.href ? (
          <a key={client.name} href={client.href} className={pillClass} title={client.hint}>
            {client.name}
          </a>
        ) : (
          <button
            key={client.name}
            type="button"
            className={pillClass}
            title={client.hint}
            onClick={() => {
              copy(client.name, client.copy!);
              if (client.open) window.open(client.open, "_blank");
            }}
          >
            {label(client)}
          </button>
        )
      )}
    </div>
  );
}
