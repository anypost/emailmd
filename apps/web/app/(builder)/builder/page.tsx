import { BuilderClient } from "@/components/builder-client";
import { getTemplateById } from "@/lib/templates";

export const metadata = {
  title: "Builder - emailmd",
  description:
    "Build responsive email templates with markdown in real-time.",
};

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template: templateId } = await searchParams;
  const template = templateId ? getTemplateById(templateId) : undefined;

  return <BuilderClient initialMarkdown={template?.markdown} />;
}
