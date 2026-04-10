import { notFound, redirect } from "next/navigation";

import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
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

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.capabilities.viewLabels) {
    notFound();
  }

  const template = await getLabelTemplateById(templateId);

  if (!template) {
    notFound();
  }

  return (
    <LabelTemplatePrintPreview
      backHref={`/labels/${templateId}/edit`}
      template={template}
      templateName={template.name}
    />
  );
}
