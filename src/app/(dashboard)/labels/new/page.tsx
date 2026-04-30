import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { LabelTemplateForm } from "@/modules/labels/components/label-template-form";
import {
  createLabelTemplate,
  getDefaultLabelTemplateValues,
  getDuplicatedLabelTemplateValues,
  getLabelTemplateEditorDescription,
  getLabelTemplateEditorTitle,
  parseLabelTemplateFormData,
} from "@/modules/labels/label-template.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

async function createLabelTemplateAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }
  const permissionContext = await getCurrentUserPermissionContext();

  if (!permissionContext.capabilities.editLabels) {
    redirect("/labels");
  }

  const created = await createLabelTemplate(parseLabelTemplateFormData(formData));

  revalidatePath("/labels");
  revalidatePath("/settings/labels");
  revalidatePath("/dashboard");
  redirect(`/labels/${created.id}/edit?saved=true`);
}

type NewLabelTemplatePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewLabelTemplatePage({ searchParams }: NewLabelTemplatePageProps) {
  const resolvedSearchParams = await searchParams;
  const duplicateId = getSingleSearchParam(resolvedSearchParams.duplicateId)?.trim() || null;

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

  const duplicatedTemplate = duplicateId ? await getDuplicatedLabelTemplateValues(duplicateId) : null;

  if (duplicateId && !duplicatedTemplate) {
    redirect("/labels");
  }

  return (
    <AppShell>
      <LabelTemplateForm
        action={createLabelTemplateAction}
        cancelHref="/labels"
        cancelLabel="Back to templates"
        description={duplicateId
          ? "Start from an existing template layout, adjust the duplicated version, and save it as a new reusable label."
          : getLabelTemplateEditorDescription(false)}
        initialValues={duplicatedTemplate ?? getDefaultLabelTemplateValues()}
        submitLabel={duplicateId ? "Create duplicate template" : "Create template"}
        submittingLabel={duplicateId ? "Duplicating..." : "Creating..."}
        title={duplicateId ? "Duplicate label template" : getLabelTemplateEditorTitle(false)}
      />
    </AppShell>
  );
}
