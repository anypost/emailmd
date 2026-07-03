import { templates } from "@/lib/templates";
import { TemplateCard } from "@/components/templates/template-card";

export const metadata = {
  title: "Templates - emailmd",
  description:
    "Open source email templates built with emailmd. Pick a template and customize it in the builder.",
};

export default function TemplatesPage() {
  return (
    <main className="container mx-auto max-w-screen-lg px-4 py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Templates
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Open source templates built with emailmd. Pick one to open it in the
          builder and customize it to your needs.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </main>
  );
}
