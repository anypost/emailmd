import Image from "next/image";
import Link from "next/link";
import type { Template } from "@/lib/templates";
import { screenshotVersions } from "@/lib/screenshot-manifest";

export function TemplateCard({ template }: { template: Template }) {
  const version = screenshotVersions[template.id];
  return (
    <Link
      href={`/builder?template=${template.id}`}
      className="group rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-foreground/20"
    >
      <div className="relative h-75 overflow-hidden border-b border-border bg-white">
        <Image
          src={template.image ?? `/ss/${template.id}.png${version ? `?v=${version}` : ""}`}
          alt={template.title}
          fill
          className="object-cover object-top"
        />
      </div>
      <div className="px-4 py-3">
        <p className="text-sm font-medium">
          <span className="text-muted-foreground">{template.category}</span>
          {" / "}
          {template.title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{template.author}</p>
      </div>
    </Link>
  );
}
