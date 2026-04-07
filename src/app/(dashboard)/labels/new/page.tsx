import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUser } from "@/lib/session";
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

async function createLabelTemplateAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
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

  const [setupState, currentUser, duplicatedTemplate] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    duplicateId ? getDuplicatedLabelTemplateValues(duplicateId) : Promise.resolve(null),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

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
