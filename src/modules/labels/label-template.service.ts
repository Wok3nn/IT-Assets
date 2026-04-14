import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/services/database";

import {
  createDefaultLabelElement,
  createDefaultMachineLabelElement,
  getDefaultTemplateDimensions,
  getLabelElementDisplayName,
  getLabelElementKey,
  getLabelFieldLabel,
  isLabelTextFieldKey,
  LABEL_TEMPLATE_DEFAULT_ORIENTATION,
  LABEL_TEMPLATE_DEFAULT_UNIT,
  LABEL_TEMPLATE_FIELD_KEYS,
  labelTemplateElementFieldKeySchema,
  labelTemplateElementTypeSchema,
  labelTemplateFieldKeySchema,
  labelTemplateFontWeightSchema,
  labelTemplateOrientationSchema,
  labelTemplateTextAlignmentSchema,
  labelTemplateUnitSchema,
  type LabelTemplateEditorValues,
  type LabelTemplateElementDefinition,
  type LabelTemplateFieldKey,
} from "./label-template.shared";

const labelTemplateElementSchema = z.object({
  type: labelTemplateElementTypeSchema.catch("text"),
  fieldKey: labelTemplateElementFieldKeySchema,
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  width: z.number().positive().max(1000),
  height: z.number().positive().max(1000),
  fontSize: z.number().int().min(6).max(96),
  fontWeight: labelTemplateFontWeightSchema.catch("normal"),
  italic: z.boolean(),
  textAlign: labelTemplateTextAlignmentSchema.catch("left"),
  rotation: z.number().min(-360).max(360),
  zIndex: z.number().int().min(0).max(1000),
});

const labelTemplateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().transform((value) => value || undefined),
  width: z.number().positive().max(1000),
  height: z.number().positive().max(1000),
  unit: labelTemplateUnitSchema,
  orientation: labelTemplateOrientationSchema,
  isEnabled: z.boolean(),
  marginTop: z.number().min(0).max(100),
  marginRight: z.number().min(0).max(100),
  marginBottom: z.number().min(0).max(100),
  marginLeft: z.number().min(0).max(100),
  enabledFieldKeys: z.array(labelTemplateFieldKeySchema),
  elements: z.array(labelTemplateElementSchema).optional(),
});

const defaultTemplateSizeByUnit = getDefaultTemplateDimensions(LABEL_TEMPLATE_DEFAULT_UNIT);

export type LabelTemplateSummary = Awaited<ReturnType<typeof listLabelTemplates>>[number];
export type LabelTemplateEditorData = Awaited<ReturnType<typeof getLabelTemplateById>>;
export type PortableLabelTemplate = {
  name: string;
  description: string;
  width: number;
  height: number;
  unit: LabelTemplateEditorValues["unit"];
  orientation: LabelTemplateEditorValues["orientation"];
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  isEnabled: boolean;
  enabledFieldKeys: LabelTemplateFieldKey[];
  elements: Array<{
    type: LabelTemplateElementDefinition["type"];
    fieldKey: LabelTemplateElementDefinition["fieldKey"];
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: LabelTemplateElementDefinition["fontWeight"];
    italic: boolean;
    textAlign: LabelTemplateElementDefinition["textAlign"];
    rotation: number;
    zIndex: number;
  }>;
};

function slugifyTemplateName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "label-template";
}

async function createUniqueTemplateSlug(name: string, excludeId?: string) {
  const baseSlug = slugifyTemplateName(name);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await db.labelTemplate.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function parseTemplateInput(input: {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  unit?: string;
  orientation?: string;
  isEnabled?: boolean;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  enabledFieldKeys: string[];
  elements?: Array<{
    type: string;
    fieldKey: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: string;
    italic: boolean;
    textAlign: string;
    rotation: number;
    zIndex: number;
  }>;
}) {
  const unit = labelTemplateUnitSchema.catch(LABEL_TEMPLATE_DEFAULT_UNIT).parse(input.unit ?? LABEL_TEMPLATE_DEFAULT_UNIT);
  const defaultSize = getDefaultTemplateDimensions(unit);

  const parsed = labelTemplateSchema.parse({
    name: input.name,
    description: input.description,
    width: input.width ?? defaultSize.width,
    height: input.height ?? defaultSize.height,
    unit,
    orientation: input.orientation ?? LABEL_TEMPLATE_DEFAULT_ORIENTATION,
    isEnabled: input.isEnabled ?? true,
    marginTop: input.marginTop ?? 0.08,
    marginRight: input.marginRight ?? 0.08,
    marginBottom: input.marginBottom ?? 0.08,
    marginLeft: input.marginLeft ?? 0.08,
    enabledFieldKeys: input.enabledFieldKeys,
    elements: input.elements,
  });

  const enabledFieldKeys = Array.from(new Set(parsed.enabledFieldKeys));
  const elements = parsed.elements ?? [];

  return {
    ...parsed,
    enabledFieldKeys,
    elements,
  };
}

function mapTemplateElement(element: {
  id: string;
  type: string;
  fieldKey: string;
  displayName: string | null;
  isVisible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number | null;
  fontWeight: string;
  italic: boolean;
  textAlign: string;
  rotation: number;
  zIndex: number;
}) {
  const parsedType = labelTemplateElementTypeSchema.safeParse(element.type);
  const parsedFieldKey = labelTemplateElementFieldKeySchema.safeParse(element.fieldKey);

  if (!parsedType.success || !parsedFieldKey.success) {
    return null;
  }

  return {
    id: element.id,
    type: parsedType.data,
    fieldKey: parsedFieldKey.data,
    displayName: element.displayName ?? getLabelElementDisplayName({ type: parsedType.data, fieldKey: parsedFieldKey.data }),
    isVisible: element.isVisible,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    fontSize: element.fontSize ?? 12,
    fontWeight: labelTemplateFontWeightSchema.catch("normal").parse(element.fontWeight),
    italic: element.italic,
    textAlign: labelTemplateTextAlignmentSchema.catch("left").parse(element.textAlign),
    rotation: element.rotation,
    zIndex: element.zIndex,
  } satisfies LabelTemplateElementDefinition & { id: string };
}

function buildElementDefinitions(args: {
  enabledFieldKeys: LabelTemplateFieldKey[];
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  explicitElements?: LabelTemplateElementDefinition[];
  existingElements?: Array<LabelTemplateElementDefinition & { id: string }>;
}) {
  const explicitElements = args.explicitElements ?? [];
  const existingElements = args.existingElements ?? [];
  const explicitTextByFieldKey = new Map(
    explicitElements
      .filter((element) => element.type === "text" && isLabelTextFieldKey(element.fieldKey))
      .map((element) => [element.fieldKey, element]),
  );
  const existingTextByFieldKey = new Map(
    existingElements
      .filter((element) => element.type === "text" && isLabelTextFieldKey(element.fieldKey))
      .map((element) => [element.fieldKey, element]),
  );

  const textElements = args.enabledFieldKeys.map((fieldKey, index) => {
    const explicit = explicitTextByFieldKey.get(fieldKey);

    if (explicit) {
      return {
        ...explicit,
        type: "text",
        fieldKey,
        displayName: getLabelFieldLabel(fieldKey),
        isVisible: true,
        zIndex: index,
      };
    }

    const existing = existingTextByFieldKey.get(fieldKey);

    if (existing) {
      return {
        ...existing,
        type: "text",
        fieldKey,
        displayName: getLabelFieldLabel(fieldKey),
        isVisible: true,
        zIndex: index,
      };
    }

    return createDefaultLabelElement({
      fieldKey,
      order: index,
      templateWidth: args.width,
      templateHeight: args.height,
      marginTop: args.marginTop,
      marginRight: args.marginRight,
      marginBottom: args.marginBottom,
      marginLeft: args.marginLeft,
    });
  });

  const extraElementsByKey = new Map<string, LabelTemplateElementDefinition>();

  for (const element of existingElements.filter((candidate) => candidate.type !== "text")) {
    extraElementsByKey.set(getLabelElementKey(element), {
      ...element,
      displayName: getLabelElementDisplayName(element),
      isVisible: true,
    });
  }

  for (const element of explicitElements.filter((candidate) => candidate.type !== "text")) {
    extraElementsByKey.set(getLabelElementKey(element), {
      ...element,
      displayName: getLabelElementDisplayName(element),
      isVisible: true,
    });
  }

  const extraElements = Array.from(extraElementsByKey.values()).map((element, index) => {
    const zIndex = textElements.length + index;

    if (element.type === "barcode") {
      return {
        ...createDefaultMachineLabelElement({
          type: "barcode",
          order: zIndex,
          templateWidth: args.width,
          templateHeight: args.height,
          marginTop: args.marginTop,
          marginRight: args.marginRight,
          marginBottom: args.marginBottom,
          marginLeft: args.marginLeft,
        }),
        ...element,
        displayName: getLabelElementDisplayName(element),
        zIndex,
      };
    }

    return {
      ...createDefaultMachineLabelElement({
        type: "qr",
        order: zIndex,
        templateWidth: args.width,
        templateHeight: args.height,
        marginTop: args.marginTop,
        marginRight: args.marginRight,
        marginBottom: args.marginBottom,
        marginLeft: args.marginLeft,
      }),
      ...element,
      displayName: getLabelElementDisplayName(element),
      zIndex,
    };
  });

  return [...textElements, ...extraElements];
}

function getTemplateSelect() {
  return {
    id: true,
    name: true,
    slug: true,
    description: true,
    width: true,
    height: true,
    unit: true,
    orientation: true,
    marginTop: true,
    marginRight: true,
    marginBottom: true,
    marginLeft: true,
    isEnabled: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        assets: true,
        elements: true,
      },
    },
    elements: {
      select: {
        id: true,
        type: true,
        fieldKey: true,
        displayName: true,
        isVisible: true,
        x: true,
        y: true,
        width: true,
        height: true,
        fontSize: true,
        fontWeight: true,
        italic: true,
        textAlign: true,
        rotation: true,
        zIndex: true,
      },
      orderBy: [{ zIndex: "asc" }],
    },
  } satisfies Prisma.LabelTemplateSelect;
}

export function getDefaultLabelTemplateValues(): LabelTemplateEditorValues {
  return {
    name: "",
    description: "",
    width: defaultTemplateSizeByUnit.width,
    height: defaultTemplateSizeByUnit.height,
    unit: LABEL_TEMPLATE_DEFAULT_UNIT,
    orientation: LABEL_TEMPLATE_DEFAULT_ORIENTATION,
    marginTop: 0.08,
    marginRight: 0.08,
    marginBottom: 0.08,
    marginLeft: 0.08,
    isEnabled: true,
    enabledFieldKeys: [...LABEL_TEMPLATE_FIELD_KEYS] as LabelTemplateFieldKey[],
    elements: LABEL_TEMPLATE_FIELD_KEYS.map((fieldKey, index) =>
      createDefaultLabelElement({
        fieldKey,
        order: index,
        templateWidth: defaultTemplateSizeByUnit.width,
        templateHeight: defaultTemplateSizeByUnit.height,
      }),
    ),
  };
}


export async function getDuplicatedLabelTemplateValues(templateId: string): Promise<LabelTemplateEditorValues | null> {
  const template = await getLabelTemplateById(templateId);

  if (!template) {
    return null;
  }

  return {
    name: `${template.name} copy`,
    description: template.description,
    width: template.width,
    height: template.height,
    unit: template.unit,
    orientation: template.orientation,
    marginTop: template.marginTop,
    marginRight: template.marginRight,
    marginBottom: template.marginBottom,
    marginLeft: template.marginLeft,
    isEnabled: template.isEnabled,
    enabledFieldKeys: [...template.enabledFieldKeys],
    elements: template.elements.map((element) => ({
      type: element.type,
      fieldKey: element.fieldKey,
      displayName: element.displayName,
      isVisible: element.isVisible,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      italic: element.italic,
      textAlign: element.textAlign,
      rotation: element.rotation,
      zIndex: element.zIndex,
    })),
  };
}

export async function listLabelTemplates() {
  const templates = await db.labelTemplate.findMany({
    select: getTemplateSelect(),
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    width: template.width,
    height: template.height,
    unit: template.unit,
    orientation: template.orientation,
    isEnabled: template.isEnabled,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    assetCount: template._count.assets,
    elementCount: template._count.elements,
    fieldKeys: template.elements
      .map((element) => mapTemplateElement(element))
      .filter((element): element is NonNullable<ReturnType<typeof mapTemplateElement>> => Boolean(element))
      .filter((element) => element.type === "text")
      .map((element) => element.fieldKey)
      .filter((fieldKey): fieldKey is LabelTemplateFieldKey => isLabelTextFieldKey(fieldKey)),
  }));
}


export async function listEnabledLabelTemplates() {
  const templates = await listLabelTemplates();
  return templates.filter((template) => template.isEnabled);
}

export async function listPortableLabelTemplates(): Promise<PortableLabelTemplate[]> {
  const templates = await db.labelTemplate.findMany({
    select: getTemplateSelect(),
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return templates.map((template) => {
    const elements = template.elements
      .map((element) => mapTemplateElement(element))
      .filter((element): element is NonNullable<ReturnType<typeof mapTemplateElement>> => Boolean(element));

    return {
      name: template.name,
      description: template.description ?? "",
      width: template.width,
      height: template.height,
      unit: labelTemplateUnitSchema.catch(LABEL_TEMPLATE_DEFAULT_UNIT).parse(template.unit),
      orientation: labelTemplateOrientationSchema.catch(LABEL_TEMPLATE_DEFAULT_ORIENTATION).parse(template.orientation),
      marginTop: template.marginTop,
      marginRight: template.marginRight,
      marginBottom: template.marginBottom,
      marginLeft: template.marginLeft,
      isEnabled: template.isEnabled,
      enabledFieldKeys: elements
        .filter((element) => element.type === "text")
        .map((element) => element.fieldKey)
        .filter((fieldKey): fieldKey is LabelTemplateFieldKey => isLabelTextFieldKey(fieldKey)),
      elements: elements.map((element) => ({
        type: element.type,
        fieldKey: element.fieldKey,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        italic: element.italic,
        textAlign: element.textAlign,
        rotation: element.rotation,
        zIndex: element.zIndex,
      })),
    };
  });
}

export async function getLabelTemplateById(templateId: string): Promise<LabelTemplateEditorValues & {
  id: string;
  slug: string;
  assetCount: number;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  const template = await db.labelTemplate.findUnique({
    where: { id: templateId },
    select: getTemplateSelect(),
  });

  if (!template) {
    return null;
  }

  const elements = template.elements
    .map((element) => mapTemplateElement(element))
    .filter((element): element is NonNullable<ReturnType<typeof mapTemplateElement>> => Boolean(element));

  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description ?? "",
    width: template.width,
    height: template.height,
    unit: labelTemplateUnitSchema.catch(LABEL_TEMPLATE_DEFAULT_UNIT).parse(template.unit),
    orientation: labelTemplateOrientationSchema.catch(LABEL_TEMPLATE_DEFAULT_ORIENTATION).parse(template.orientation),
    marginTop: template.marginTop,
    marginRight: template.marginRight,
    marginBottom: template.marginBottom,
    marginLeft: template.marginLeft,
    isEnabled: template.isEnabled,
    enabledFieldKeys: elements
      .filter((element) => element.type === "text")
      .map((element) => element.fieldKey)
      .filter((fieldKey): fieldKey is LabelTemplateFieldKey => isLabelTextFieldKey(fieldKey)),
    elements,
    assetCount: template._count.assets,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

export async function createLabelTemplate(input: {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  unit?: string;
  orientation?: string;
  isEnabled?: boolean;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  enabledFieldKeys: string[];
  elements?: Array<{
    type: string;
    fieldKey: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: string;
    italic: boolean;
    textAlign: string;
    rotation: number;
    zIndex: number;
  }>;
}) {
  const parsed = parseTemplateInput(input);
  const slug = await createUniqueTemplateSlug(parsed.name);
  const elements = buildElementDefinitions({
    enabledFieldKeys: parsed.enabledFieldKeys,
    width: parsed.width,
    height: parsed.height,
    marginTop: parsed.marginTop,
    marginRight: parsed.marginRight,
    marginBottom: parsed.marginBottom,
    marginLeft: parsed.marginLeft,
    explicitElements: parsed.elements?.map((element) => ({
      ...element,
      displayName: getLabelElementDisplayName(element),
      isVisible: true,
    })),
  });

  return db.labelTemplate.create({
    data: {
      name: parsed.name,
      slug,
      description: parsed.description,
      width: parsed.width,
      height: parsed.height,
      unit: parsed.unit,
      orientation: parsed.orientation,
      marginTop: parsed.marginTop,
      marginRight: parsed.marginRight,
      marginBottom: parsed.marginBottom,
      marginLeft: parsed.marginLeft,
      isEnabled: parsed.isEnabled,
      elements: {
        create: elements.map((element) => ({
          type: element.type,
          fieldKey: element.fieldKey,
          displayName: element.displayName,
          isVisible: element.isVisible,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          fontSize: element.fontSize,
          fontWeight: element.fontWeight,
          italic: element.italic,
          textAlign: element.textAlign,
          rotation: element.rotation,
          zIndex: element.zIndex,
        })),
      },
    },
    select: {
      id: true,
      slug: true,
    },
  });
}

export async function updateLabelTemplate(templateId: string, input: {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  unit?: string;
  orientation?: string;
  isEnabled?: boolean;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  enabledFieldKeys: string[];
  elements?: Array<{
    type: string;
    fieldKey: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: string;
    italic: boolean;
    textAlign: string;
    rotation: number;
    zIndex: number;
  }>;
}) {
  const parsed = parseTemplateInput(input);
  const existing = await getLabelTemplateById(templateId);

  if (!existing) {
    throw new Error("Label template not found.");
  }

  const slug = await createUniqueTemplateSlug(parsed.name, templateId);
  const elements = buildElementDefinitions({
    enabledFieldKeys: parsed.enabledFieldKeys,
    width: parsed.width,
    height: parsed.height,
    marginTop: parsed.marginTop,
    marginRight: parsed.marginRight,
    marginBottom: parsed.marginBottom,
    marginLeft: parsed.marginLeft,
    explicitElements: parsed.elements?.map((element) => ({
      ...element,
      displayName: getLabelElementDisplayName(element),
      isVisible: true,
    })),
    existingElements: existing.elements.filter((element): element is LabelTemplateElementDefinition & { id: string } => Boolean(element.id)),
  });

  return db.$transaction(async (tx) => {
    await tx.labelTemplate.update({
      where: { id: templateId },
      data: {
        name: parsed.name,
        slug,
        description: parsed.description,
        width: parsed.width,
        height: parsed.height,
        unit: parsed.unit,
        orientation: parsed.orientation,
        marginTop: parsed.marginTop,
        marginRight: parsed.marginRight,
        marginBottom: parsed.marginBottom,
        marginLeft: parsed.marginLeft,
        isEnabled: parsed.isEnabled,
      },
    });

    await tx.labelTemplateElement.deleteMany({
      where: { templateId },
    });

    await tx.labelTemplateElement.createMany({
      data: elements.map((element) => ({
        templateId,
        type: element.type,
        fieldKey: element.fieldKey,
        displayName: element.displayName,
        isVisible: element.isVisible,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        italic: element.italic,
        textAlign: element.textAlign,
        rotation: element.rotation,
        zIndex: element.zIndex,
      })),
    });

    return tx.labelTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        slug: true,
      },
    });
  });
}

export function parseEnabledLabelFieldKeys(values: string[]) {
  return Array.from(new Set(
    values
      .map((value) => labelTemplateFieldKeySchema.safeParse(value))
      .filter((result): result is { success: true; data: LabelTemplateFieldKey } => result.success)
      .map((result) => result.data),
  ));
}

export function parseLabelTemplateNumericValue(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseLabelTemplateCheckbox(value: FormDataEntryValue | null) {
  return String(value ?? "") === "true";
}

export function parseLabelTemplateBooleanValue(value: FormDataEntryValue | null, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return fallback;
}

export function parseLabelTemplateFormData(formData: FormData) {
  const enabledFieldKeys = parseEnabledLabelFieldKeys(
    formData.getAll("enabledFieldKeys").map((value) => String(value ?? "")),
  );
  const elementFieldKeys = formData.getAll("elementFieldKey").map((value) => String(value ?? ""));
  const elementTypes = formData.getAll("elementType").map((value) => String(value ?? "text"));
  const elementXs = formData.getAll("elementX");
  const elementYs = formData.getAll("elementY");
  const elementWidths = formData.getAll("elementWidth");
  const elementHeights = formData.getAll("elementHeight");
  const elementFontSizes = formData.getAll("elementFontSize");
  const elementFontWeights = formData.getAll("elementFontWeight").map((value) => String(value ?? "normal"));
  const elementItalics = formData.getAll("elementItalic");
  const elementTextAlignments = formData.getAll("elementTextAlign").map((value) => String(value ?? "left"));
  const elementRotations = formData.getAll("elementRotation");
  const elementZIndexes = formData.getAll("elementZIndex");

  const elements = elementFieldKeys.map((fieldKey, index) => ({
    type: elementTypes[index] ?? "text",
    fieldKey,
    x: parseLabelTemplateNumericValue(elementXs[index] ?? null, 0),
    y: parseLabelTemplateNumericValue(elementYs[index] ?? null, 0),
    width: parseLabelTemplateNumericValue(elementWidths[index] ?? null, 1),
    height: parseLabelTemplateNumericValue(elementHeights[index] ?? null, 0.25),
    fontSize: Math.round(parseLabelTemplateNumericValue(elementFontSizes[index] ?? null, 12)),
    fontWeight: elementFontWeights[index] ?? "normal",
    italic: parseLabelTemplateBooleanValue(elementItalics[index] ?? null, false),
    textAlign: elementTextAlignments[index] ?? "left",
    rotation: parseLabelTemplateNumericValue(elementRotations[index] ?? null, 0),
    zIndex: Math.round(parseLabelTemplateNumericValue(elementZIndexes[index] ?? null, index)),
  }));

  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    width: parseLabelTemplateNumericValue(formData.get("width"), 2),
    height: parseLabelTemplateNumericValue(formData.get("height"), 1),
    unit: String(formData.get("unit") ?? LABEL_TEMPLATE_DEFAULT_UNIT).trim(),
    orientation: String(formData.get("orientation") ?? LABEL_TEMPLATE_DEFAULT_ORIENTATION).trim(),
    isEnabled: parseLabelTemplateCheckbox(formData.get("isEnabled")),
    marginTop: parseLabelTemplateNumericValue(formData.get("marginTop"), 0.08),
    marginRight: parseLabelTemplateNumericValue(formData.get("marginRight"), 0.08),
    marginBottom: parseLabelTemplateNumericValue(formData.get("marginBottom"), 0.08),
    marginLeft: parseLabelTemplateNumericValue(formData.get("marginLeft"), 0.08),
    enabledFieldKeys,
    elements,
  };
}

export function getLabelTemplateEditorTitle(isEditMode: boolean) {
  return isEditMode ? "Edit label template" : "New label template";
}

export function getLabelTemplateEditorDescription(isEditMode: boolean) {
  return isEditMode
    ? "Adjust the saved label definition, field set, and foundational layout metadata that future preview and print flows will build on."
    : "Create a reusable label definition with the core sizing, units, and asset-field elements future preview and print flows will build on.";
}
