import { Fragment, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { McpInstallButtons } from "@/components/mcp-install";
import { templates } from "@/lib/templates";
import { screenshotVersions } from "@/lib/screenshot-manifest";
import { cn } from "@/lib/utils";
import styles from "./home.module.css";

const INSTALL = "npm install emailmd";

const shell = "mx-auto w-full max-w-6xl px-4";

const primaryBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-px";

const ghostBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 text-sm font-medium transition-colors hover:bg-muted active:translate-y-px";

/** Gallery screenshots carry a content hash so a re-render busts the cache. */
function shot(id: string) {
  const version = screenshotVersions[id];
  return `/ss/${id}.png${version ? `?v=${version}` : ""}`;
}

/**
 * A bordered pane with a mono label, used for source and output samples. A pane
 * carrying a render adopts that render's own surface, so both the fill and the
 * label chrome are overridable.
 */
function Pane({
  label,
  children,
  className,
  labelClassName,
  style,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
      style={style}
    >
      <div
        className={cn(
          "border-b border-border px-4 py-2.5 font-mono text-xs text-muted-foreground",
          labelClassName,
        )}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="underline underline-offset-4 hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="flex-1 overflow-x-auto p-4 text-[12.5px] leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default function Page() {
  return (
    <main className="overflow-x-clip pb-24">
      {/* ---------------------------------------------------------------- */}
      {/* Hero: copy left, a real rendered email right.                     */}
      {/* ---------------------------------------------------------------- */}
      <section className={`${shell} grid gap-12 pt-14 pb-20 md:pt-20 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pb-24`}>
        <div className="lg:col-span-6">
          <h1
            className={`${styles.load} text-4xl font-bold tracking-tight text-balance sm:text-5xl xl:text-[3.4rem] xl:leading-[1.05]`}
          >
            Responsive Emails, Written in Markdown
          </h1>
          <p
            className={`${styles.load} mt-6 max-w-lg text-lg text-muted-foreground`}
            style={{ animationDelay: "90ms" }}
          >
            Write markdown. Ship emails. No{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
              HTMHELL
            </code>
            . emailmd turns it into HTML that renders everywhere, Outlook
            included.
          </p>
          <div
            className={`${styles.load} mt-8 flex flex-wrap items-center gap-3`}
            style={{ animationDelay: "180ms" }}
          >
            <Link href="/docs/getting-started" className={primaryBtn}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <div className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background pr-1.5 pl-4 font-mono text-sm">
              <span className="text-muted-foreground select-none">$</span>
              <span>{INSTALL}</span>
              <CopyButton text={INSTALL} />
            </div>
          </div>
        </div>

        <div className="relative lg:col-span-6 lg:-mr-4 xl:-mr-12">
          <div
            className={`${styles.load} relative aspect-6/5 overflow-hidden rounded-xl border border-border bg-[#FFE500] shadow-2xl shadow-foreground/5`}
            style={{ animationDelay: "260ms" }}
          >
            <Image
              src={shot("newsletter")}
              alt="A coffee newsletter rendered by emailmd, with a black masthead, a bold headline, and a full-width photograph"
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-cover object-top"
              priority
            />
          </div>
          {/*
            The source for everything visible above it, landing last in the
            stagger so the order reads markdown then email. Wide screens only:
            below xl it would swamp the render, and the section underneath
            carries the same pairing at full size for everyone.
          */}
          <Pane
            label="newsletter.md"
            labelClassName="px-3.5"
            className={`${styles.load} absolute -bottom-10 -left-10 hidden w-96 shadow-2xl shadow-foreground/20 xl:flex`}
            style={{ animationDelay: "440ms" }}
          >
            <pre className="overflow-hidden p-3.5 text-[11px] leading-relaxed">
              <code>{newsletterExcerpt}</code>
            </pre>
          </Pane>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The transformation, stated plainly: source pane, rendered pane.   */}
      {/* ---------------------------------------------------------------- */}
      <section className={`${shell} py-16 md:py-24`}>
        <div className={styles.reveal}>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Markdown goes in. Email-safe HTML comes out.
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            The same syntax you already use in README files and pull requests.
            No nested tables, no inline style soup, no client-specific hacks.
          </p>
        </div>

        <div className={`${styles.reveal} mt-10 grid gap-5 lg:grid-cols-2`}>
          <Pane label="confirm-email.md">
            <Code>{confirmEmailMarkdown}</Code>
          </Pane>
          <Pane
            label="Inbox"
            className="bg-[#07070B]"
            labelClassName="border-white/10 text-white/60"
          >
            <Image
              src="https://imgs.emailmd.dev/ss/confirm_email.png"
              alt="The same email rendered in a dark theme, with a heading, a highlighted confirmation code, and a footer"
              width={600}
              height={800}
              sizes="(max-width: 1024px) 100vw, 560px"
              className="w-full"
            />
          </Pane>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Feature bento. Five cells, each carrying real product output.     */}
      {/* ---------------------------------------------------------------- */}
      <section className={`${shell} py-16 md:py-24`}>
        <h2
          className={`${styles.reveal} max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl`}
        >
          What emailmd handles for you.
        </h2>

        <div className={`${styles.revealKids} mt-10 grid gap-5 lg:grid-cols-6`}>
          {/* Type-led cell: the claim is the visual. */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-6 lg:col-span-2">
            <h3 className="text-2xl font-bold tracking-tight">
              It renders in Outlook.
            </h3>
            <p className="mt-4 text-sm text-muted-foreground">
              MJML under the hood, so the output is tables and inline styles all
              the way down. You never have to look at them.
            </p>
            <p className="mt-6 font-mono text-xs text-muted-foreground">
              Gmail, Outlook, Apple Mail, Yahoo
            </p>
            {/*
              The markup the paragraph above promises you never have to write,
              pinned to the foot of the cell. Anchoring the two halves top and
              bottom is what stops a tall cell reading as a void, and the fade
              says the file keeps going.
            */}
            <pre
              aria-hidden
              className="mt-auto overflow-hidden pt-10 font-mono text-[11px] leading-relaxed text-muted-foreground/70 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
            >
              <code>{msoOutput}</code>
            </pre>
          </div>

          {/* Image-led cell. */}
          <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold">
                Seventeen directives for layout
              </h3>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Photo heroes, responsive columns, callouts, accordions,
                dividers, and a dozen more. Each one is a fenced block in your
                markdown.
              </p>
            </div>
            {/*
              showcase/directives.md exists for this frame alone: no gallery
              template stacks five directives inside one screenshot. The frame
              matches the capture viewport exactly, so the crop is decided once
              at capture time rather than by object-cover at each breakpoint.
            */}
            <div className="relative ml-6 aspect-12/7 overflow-hidden rounded-tl-xl border-t border-l border-border bg-white">
              <Image
                src={shot("directive-showcase")}
                alt="An email rendered by emailmd, stacking a photo hero, a row of three column cells, a divider, a callout, and an accordion"
                fill
                sizes="(max-width: 1024px) 100vw, 740px"
                className="object-cover"
              />
            </div>
          </div>

          {/* Theming: frontmatter in, palette out. */}
          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-3">
            <h3 className="text-lg font-semibold">
              Theming and automatic dark mode
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Set your brand colors in frontmatter. emailmd derives a dark
              palette and serves it to readers whose client asks for one.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2.5 font-mono text-[12px] leading-relaxed text-muted-foreground">
                <code>{themeFrontmatter}</code>
              </pre>
              <div className="flex gap-1.5">
                {["#0F766E", "#F2F6F5", "#EDF5F3", "#0F241D"].map((hex) => (
                  <span
                    key={hex}
                    title={hex}
                    className="size-8 rounded-lg border border-border"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Linting: real findings from the real linter. */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-6 lg:col-span-3">
            <h3 className="text-lg font-semibold">Linting before you send</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Missing alt text, insecure links, Gmail&apos;s 102KB clip limit,
              spam triggers, and more.
            </p>
            {/* Columns, so a message that wraps hangs under the message column. */}
            <div className="mt-5 grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1.5 font-mono text-[11.5px] leading-snug text-muted-foreground">
              {lintFindings.map((finding) => (
                <Fragment key={finding.message}>
                  <span>{finding.line}</span>
                  <span
                    className={
                      finding.severity === "warning" ? "text-foreground" : ""
                    }
                  >
                    {finding.severity}
                  </span>
                  <span>{finding.message}</span>
                </Fragment>
              ))}
            </div>
          </div>

          {/* Full-width cell: one source, two renderings. */}
          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-6">
            <h3 className="text-lg font-semibold">
              Every send ships a plain-text part
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Generated from the same markdown, so it never drifts from the HTML.
              Charts redraw themselves in ASCII instead of collapsing into a list
              of numbers.
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-[12px] leading-relaxed">
                <code>{chartMarkdown}</code>
              </pre>
              <pre
                className={`${styles.ascii} overflow-x-auto rounded-lg bg-muted p-4 text-[12px] leading-relaxed`}
              >
                <code>{chartText}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Charts and data: the newest directives, on a tinted band.         */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-border bg-muted/40 py-16 md:py-24">
        <div className={shell}>
          <div className={styles.reveal}>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Charts drawn without a single image.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Built from table cells and text glyphs rather than images or SVG,
              so they still render when the client blocks remote content.
            </p>
          </div>

          <div
            className={`${styles.reveal} mt-10 grid items-center gap-10 lg:grid-cols-12`}
          >
            <div className="lg:col-span-7">
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xl shadow-foreground/5">
                <Image
                  src={shot("monthly-report")}
                  alt="A monthly report email rendered by emailmd, showing four KPI tiles with change indicators and a weekly sales sparkline"
                  width={1440}
                  height={1200}
                  sizes="(max-width: 1024px) 100vw, 660px"
                  className="w-full"
                />
              </div>
            </div>

            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 xl:grid-cols-2">
              {dataDirectives.map((directive) => (
                <div key={directive.name}>
                  <dt>
                    <Link
                      href={`/docs/directives/${directive.name}`}
                      className="font-mono text-sm text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
                    >
                      ::: {directive.name}
                    </Link>
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {directive.draws}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* MCP: a single panel, distinct from the sections around it.        */}
      {/* ---------------------------------------------------------------- */}
      <section className={`${shell} py-16 md:py-24`}>
        <div
          className={`${styles.reveal} rounded-xl border border-border bg-card px-6 py-12 text-center md:px-12`}
        >
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            Or let your AI write it.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            The emailmd MCP server gives any assistant the tools to write, lint,
            and render emails, with a live preview link for every draft.
          </p>
          <div className="mt-8">
            <McpInstallButtons />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Or run it locally with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              npx emailmd mcp
            </code>
            . See the{" "}
            <Link
              href="/docs/mcp"
              className="underline underline-offset-4 hover:text-foreground"
            >
              MCP docs
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Templates: a scroll strip of real renders.                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div
          className={`${shell} ${styles.reveal} flex flex-wrap items-end justify-between gap-4`}
        >
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              {templates.length} templates to start from.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Real emails, not skeletons. Open any one in the builder and make it
              yours.
            </p>
          </div>
          <Link href="/templates" className={ghostBtn}>
            Browse all templates
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {/*
          A drag-and-flick strip rather than a grid: it shows breadth without
          turning the home page into a second gallery. Edge padding matches the
          shell so the first card lines up with the heading above it.
        */}
        <ul className={`${styles.strip} mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4`}>
          {featuredTemplates.map((template) => (
            <li key={template.id} className="w-64 shrink-0 snap-start sm:w-72">
              <Link
                href={`/builder?template=${template.id}`}
                className="group block"
              >
                <div className="relative aspect-4/5 overflow-hidden rounded-xl border border-border bg-white transition-colors group-hover:border-foreground/25">
                  <Image
                    src={shot(template.id)}
                    alt={`The ${template.title} template rendered by emailmd`}
                    fill
                    sizes="288px"
                    className="object-cover object-top"
                  />
                </div>
                <p className="mt-3 text-sm font-medium">
                  <span className="text-muted-foreground">
                    {template.category}
                  </span>{" "}
                  / {template.title}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close.                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className={`${shell} ${styles.reveal} pt-8 text-center md:pt-16`}>
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Start with the markdown you already know.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Type on the left, watch the email build itself on the right.
        </p>
        <div className="mt-8">
          <Link href="/builder" className={primaryBtn}>
            Open the builder
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="mx-auto mt-10 max-w-lg text-sm text-muted-foreground">
          There is also a <DocLink href="/docs/cli">CLI</DocLink> for CI, a{" "}
          <DocLink href="/docs/react">React builder</DocLink> to embed in your
          own app, and reusable{" "}
          <DocLink href="/docs/partials">partials</DocLink>.
        </p>
      </section>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Content                                                                     */
/* -------------------------------------------------------------------------- */

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

/**
 * The top of the Moonbean template, verbatim apart from shortened image URLs.
 * It covers exactly what the hero render shows above the fold. The final line
 * runs past the card edge, which is what an editor without soft wrap does.
 */
const newsletterExcerpt = `::: highlight compact center bg=#0A0A0A color=#FFE500
**MOONBEAN MONTHLY · NO. 012 · FRESH ROASTS ONLY**
:::

![Moonbean](...logo.png){width="110" align="left"}

# NEW DROPS. ZERO DECAF.

::: divider color=#0A0A0A thickness=3

![Coffee bench](...coffee.jpg){width="600" caption="THIS MONTH'S BENCH. ALL HAND-ROASTED."}`;

/**
 * Verbatim from the head of a render, de-indented and cut off mid-block. The
 * cell fades the tail out, so it reads as a sample of the output rather than
 * the whole of it.
 */
const msoOutput = `<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
  <o:AllowPNG/>
  <o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<!--[if lte mso 11]>
<style type="text/css">`;

const themeFrontmatter = `brand_color: "#0F766E"
background_color: "#F2F6F5"
card_color: "#EDF5F3"`;

/** Verbatim from `emailmd lint`, trimmed to the first clause of each message. */
const lintFindings = [
  { line: 3, severity: "warning", message: "Image is missing alt text" },
  { line: 3, severity: "warning", message: "Image loads over http://" },
  {
    line: 5,
    severity: "suggestion",
    message: '"act now" is a common spam-filter trigger',
  },
  {
    line: 7,
    severity: "suggestion",
    message: '"Click here" says nothing out of context',
  },
];

const chartMarkdown = `::: chart
- Direct: 4,200
- Organic search: 3,100
- Social: 640
:::`;

/** Verbatim from the `text` half of a real render. */
const chartText = `Direct          ████████████████████████  4,200
Organic search  ██████████████████        3,100
Social          ████                      640`;

const dataDirectives = [
  { name: "chart", draws: "Horizontal bars from a list" },
  { name: "progress", draws: "A meter running toward a goal" },
  { name: "sparkline", draws: "A run of numbers as one strip" },
  { name: "stats", draws: "KPI tiles with change indicators" },
  { name: "steps", draws: "Ordered trackers and timelines" },
  { name: "rating", draws: "Star scores, whole or half" },
];

/**
 * A curated slice of the gallery. The three renders used higher up the page are
 * deliberately left out so nothing appears twice.
 */
const featuredTemplates = [
  "welcome",
  "product-announcement",
  "event-invite",
  "release-notes",
  "review-roundup",
  "invoice",
  "abandoned-cart",
  "order-confirmation",
  "rate-support",
].flatMap((id) => templates.filter((template) => template.id === id));
