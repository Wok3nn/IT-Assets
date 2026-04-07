import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { LabelTemplatePrintPreview } from "@/modules/labels/components/label-template-print-preview";
import { getLabelTemplateById } from "@/modules/labels/label-template.service";
import { readSetupState } from "@/services/setup-state";

type LabelTemplatePrintPageProps = {
  params: Promise<{
    templateId: string;
  }>;
};

export default async function LabelTemplatePrintPage({ params }: LabelTemplatePrintPageProps) {
  const resolvedParams = await params;
  const templateId = resolvedParams.templateId;

  const [setupState, currentUser, template] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getLabelTemplateById(templateId),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!template) {
    redirect("/labels");
  }

  return (
    <LabelTemplatePrintPreview
      backHref={`/labels/${templateId}/edit`}
      template={template}
      templateName={template.name}
    />
  );
}
