import Link from "next/link";
import Image from "next/image";
import { CopyButton } from "@/components/copy-button";


const btnClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted";

function NavButtons() {
  return (
    <div className="flex items-center justify-center gap-3">
      <Link href="/templates" className={btnClass}>
        Templates
      </Link>
      <Link href="/builder" className={btnClass}>
        Builder
      </Link>
      <Link
        href="/docs"
        className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Docs
      </Link>
      <a
        href="https://github.com/anypost/emailmd"
        target="_blank"
        className={btnClass}
      >
        GitHub
      </a>
    </div>
  );
}

export default function Page() {
  return (
    <main>
      {/* Hero */}
      <section className="container mx-auto max-w-screen-lg px-4 py-24 text-center md:py-32">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Responsive Emails, Written in Markdown
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Write markdown. Ship emails. No{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              HTMHELL
            </code>
            .
          </p>
          <NavButtons />
        </div>
      </section>

      {/* Code → Email Preview */}
      <section className="container mx-auto max-w-screen-lg px-4 pb-20">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
          {/* Editor pane */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/20" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
              <div className="h-3 w-3 rounded-full bg-green-500/20" />
              <span className="ml-2 text-xs text-muted-foreground">
                confirm-email.md
              </span>
            </div>
            <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
              <code className="text-foreground">{confirmEmailMarkdown}</code>
            </pre>
          </div>

          {/* Browser preview pane */}
          <div className="overflow-hidden rounded-xl border border-border bg-[#06060C]">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/20" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
              <div className="h-3 w-3 rounded-full bg-green-500/20" />
              <span className="ml-2 text-xs text-white/40">Preview</span>
            </div>
            <Image
              src="https://imgs.emailmd.dev/ss/confirm_email.png"
              alt="Confirm email rendered preview"
              width={600}
              height={800}
              className="w-full"
              priority
            />
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="container mx-auto max-w-screen-lg px-4 pb-16 text-center">
        <div className="mx-auto max-w-md space-y-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-2 font-mono text-sm">
            <span className="text-muted-foreground">$</span>
            <span>npm install emailmd</span>
            <CopyButton text="npm install emailmd" />
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="container mx-auto max-w-screen-lg px-4 pb-24 text-center">
        <NavButtons />
      </section>

    </main>
  );
}

const confirmEmailMarkdown = `---
preheader: "Confirm your email address"
theme: dark
---

::: header
![Logo](https://...logo.png){width="200"}
:::

# Confirm your email address

Your confirmation code is below -
enter it in your open browser window
and we'll help you get signed in.

::: callout center compact
# DFY-X7U
:::

If you didn't request this email,
there's nothing to worry about,
you can safely ignore it.

::: footer
Acme Inc. | 123 Main St
[Unsubscribe](https://example.com/unsub)
:::`;
