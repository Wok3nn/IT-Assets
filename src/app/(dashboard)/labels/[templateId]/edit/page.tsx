import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { LabelTemplateForm } from "@/modules/labels/components/label-template-form";
import {
  getLabelTemplateById,
  getLabelTemplateEditorDescription,
  getLabelTemplateEditorTitle,
  parseLabelTemplateFormData,
  updateLabelTemplate,
} from "@/modules/labels/label-template.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type EditLabelTemplatePageProps = {
  params: Promise<{
    templateId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EditLabelTemplatePage({ params, searchParams }: EditLabelTemplatePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const templateId = resolvedParams.templateId;
  const initialSaved = getSingleSearchParam(resolvedSearchParams.saved) === "true";

  async function updateLabelTemplateAction(formData: FormData) {
    "use server";

    const currentUser = await getCurrentUser();

    if (!currentUser) {
      redirect("/login");
    }
    const permissionContext = await getCurrentUserPermissionContext();

    if (!permissionContext.capabilities.editLabels) {
      redirect("/labels");
    }

    await updateLabelTemplate(templateId, parseLabelTemplateFormData(formData));

    revalidatePath("/labels");
    revalidatePath(`/labels/${templateId}/edit`);
    revalidatePath("/settings/labels");
    revalidatePath("/dashboard");
    redirect(`/labels/${templateId}/edit?saved=true`);
  }

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

  if (!permissionContext.capabilities.editLabels) {
    notFound();
  }

  const template = await getLabelTemplateById(templateId);

  if (!template) {
    notFound();
  }

  return (
    <AppShell>
      <LabelTemplateForm
        action={updateLabelTemplateAction}
        cancelHref="/labels"
        cancelLabel="Back to templates"
        description={getLabelTemplateEditorDescription(true)}
        extraHeaderActions={(
          <>
            {permissionContext.capabilities.viewLabels ? (
              <Link href={`/labels/${template.id}/print`}><Button type="button" variant="ghost">Print preview</Button></Link>
            ) : null}
          </>
        )}
        initialSaved={initialSaved}
        initialValues={template}
        submitLabel="Save template"
        submittingLabel="Saving..."
        title={getLabelTemplateEditorTitle(true)}
      />
    </AppShell>
  );
}
