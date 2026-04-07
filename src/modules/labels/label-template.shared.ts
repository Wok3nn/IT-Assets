import { z } from "zod";

export const LABEL_TEMPLATE_UNITS = ["inches", "millimeters", "centimeters"] as const;
export const LABEL_TEMPLATE_ORIENTATIONS = ["portrait", "landscape"] as const;
export const LABEL_TEMPLATE_ELEMENT_TYPES = ["text", "barcode", "qr"] as const;
export const LABEL_TEMPLATE_FIELD_KEYS = ["assetTag", "serialNumber", "assetName"] as const;
export const LABEL_TEMPLATE_ELEMENT_FIELD_KEYS = [...LABEL_TEMPLATE_FIELD_KEYS, "assetDetailsUrl"] as const;
export const LABEL_TEMPLATE_TEXT_ALIGNMENTS = ["left", "center", "right"] as const;
export const LABEL_TEMPLATE_FONT_WEIGHTS = ["normal", "500", "600", "700"] as const;

export const labelTemplateUnitSchema = z.enum(LABEL_TEMPLATE_UNITS);
export const labelTemplateOrientationSchema = z.enum(LABEL_TEMPLATE_ORIENTATIONS);
export const labelTemplateElementTypeSchema = z.enum(LABEL_TEMPLATE_ELEMENT_TYPES);
export const labelTemplateFieldKeySchema = z.enum(LABEL_TEMPLATE_FIELD_KEYS);
export const labelTemplateElementFieldKeySchema = z.enum(LABEL_TEMPLATE_ELEMENT_FIELD_KEYS);
export const labelTemplateTextAlignmentSchema = z.enum(LABEL_TEMPLATE_TEXT_ALIGNMENTS);
export const labelTemplateFontWeightSchema = z.enum(LABEL_TEMPLATE_FONT_WEIGHTS);

export type LabelTemplateUnit = z.infer<typeof labelTemplateUnitSchema>;
export type LabelTemplateOrientation = z.infer<typeof labelTemplateOrientationSchema>;
export type LabelTemplateElementType = z.infer<typeof labelTemplateElementTypeSchema>;
export type LabelTemplateFieldKey = z.infer<typeof labelTemplateFieldKeySchema>;
export type LabelTemplateElementFieldKey = z.infer<typeof labelTemplateElementFieldKeySchema>;
export type LabelTemplateTextAlignment = z.infer<typeof labelTemplateTextAlignmentSchema>;
export type LabelTemplateFontWeight = z.infer<typeof labelTemplateFontWeightSchema>;

export type LabelTemplateElementDefinition = {
  id?: string;
  type: LabelTemplateElementType;
  fieldKey: LabelTemplateElementFieldKey;
  displayName: string;
  isVisible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: LabelTemplateFontWeight;
  italic: boolean;
  textAlign: LabelTemplateTextAlignment;
  rotation: number;
  zIndex: number;
};

export type LabelTemplateEditorValues = {
  id?: string;
  name: string;
  description: string;
  width: number;
  height: number;
  unit: LabelTemplateUnit;
  orientation: LabelTemplateOrientation;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  isEnabled: boolean;
  enabledFieldKeys: LabelTemplateFieldKey[];
  elements: LabelTemplateElementDefinition[];
};

export const LABEL_TEMPLATE_FIELD_OPTIONS: Array<{
  key: LabelTemplateFieldKey;
  label: string;
  description: string;
}> = [
  {
    key: "assetTag",
    label: "Asset tag",
    description: "The unique inventory tag used to identify the asset.",
  },
  {
    key: "serialNumber",
    label: "Serial number",
    description: "The manufacturer serial number when it exists on the asset.",
  },
  {
    key: "assetName",
    label: "Asset name",
    description: "The device or inventory display name saved on the asset record.",
  },
];

export const LABEL_TEMPLATE_MACHINE_ELEMENT_OPTIONS: Array<{
  type: Extract<LabelTemplateElementType, "barcode" | "qr">;
  fieldKey: LabelTemplateElementFieldKey;
  label: string;
  description: string;
}> = [
  {
    type: "barcode",
    fieldKey: "assetTag",
    label: "Barcode",
    description: "Encodes the asset tag for scanner-friendly label workflows.",
  },
  {
    type: "qr",
    fieldKey: "assetDetailsUrl",
    label: "QR code",
    description: "Encodes a stable asset lookup URL for quick mobile identification.",
  },
];

export const LABEL_TEMPLATE_PREVIEW_SAMPLE_DATA: Record<LabelTemplateFieldKey, string> = {
  assetTag: "AST-10025",
  serialNumber: "SN-4839201",
  assetName: "Dell Latitude 7440",
};

export type LabelTemplateValueMap = Partial<Record<LabelTemplateFieldKey, string | null | undefined>>;
export type LabelTemplateRenderData = {
  values?: LabelTemplateValueMap;
  assetDetailsUrl?: string | null | undefined;
};

const LABEL_TEMPLATE_PREVIEW_SAMPLE_ASSET_DETAILS_URL = "https://assets.example.com/lookup/assets/demo-asset";

export const LABEL_TEMPLATE_DEFAULT_UNIT: LabelTemplateUnit = "inches";
export const LABEL_TEMPLATE_DEFAULT_ORIENTATION: LabelTemplateOrientation = "landscape";
export const LABEL_TEMPLATE_MIN_ELEMENT_WIDTH = 0.15;
export const LABEL_TEMPLATE_MIN_ELEMENT_HEIGHT = 0.15;
export const LABEL_TEMPLATE_SNAP_STEP = 0.02;
export const LABEL_TEMPLATE_NUDGE_STEP = 0.02;
export const LABEL_TEMPLATE_NUDGE_LARGE_STEP = 0.05;

export function isLabelTextFieldKey(value: string): value is LabelTemplateFieldKey {
  return LABEL_TEMPLATE_FIELD_KEYS.includes(value as LabelTemplateFieldKey);
}

export function isLabelMachineElementType(value: LabelTemplateElementType): value is Extract<LabelTemplateElementType, "barcode" | "qr"> {
  return value === "barcode" || value === "qr";
}

export function getLabelElementKey(input: Pick<LabelTemplateElementDefinition, "type" | "fieldKey">) {
  return `${input.type}:${input.fieldKey}`;
}

export function getLabelFieldLabel(fieldKey: LabelTemplateFieldKey) {
  return LABEL_TEMPLATE_FIELD_OPTIONS.find((option) => option.key === fieldKey)?.label ?? fieldKey;
}

export function getLabelFieldDescription(fieldKey: LabelTemplateFieldKey) {
  return LABEL_TEMPLATE_FIELD_OPTIONS.find((option) => option.key === fieldKey)?.description ?? "";
}

export function getLabelMachineElementOption(type: Extract<LabelTemplateElementType, "barcode" | "qr">) {
  return LABEL_TEMPLATE_MACHINE_ELEMENT_OPTIONS.find((option) => option.type === type) ?? null;
}

export function getLabelElementDisplayName(input: Pick<LabelTemplateElementDefinition, "type" | "fieldKey">) {
  if (input.type === "text" && isLabelTextFieldKey(input.fieldKey)) {
    return getLabelFieldLabel(input.fieldKey);
  }

  if (input.type === "barcode") {
    return "Barcode";
  }

  if (input.type === "qr") {
    return "QR code";
  }

  return input.fieldKey;
}

export function getLabelElementDescription(input: Pick<LabelTemplateElementDefinition, "type" | "fieldKey">) {
  if (input.type === "text" && isLabelTextFieldKey(input.fieldKey)) {
    return getLabelFieldDescription(input.fieldKey);
  }

  if (input.type === "barcode") {
    return "Encodes the asset tag in a scanner-friendly linear barcode.";
  }

  if (input.type === "qr") {
    return "Encodes a stable asset details URL for phone-based lookup.";
  }

  return "";
}

export function getLabelPreviewValue(fieldKey: LabelTemplateFieldKey) {
  return LABEL_TEMPLATE_PREVIEW_SAMPLE_DATA[fieldKey];
}

export function getLabelPreviewRenderData(): LabelTemplateRenderData {
  return {
    values: LABEL_TEMPLATE_PREVIEW_SAMPLE_DATA,
    assetDetailsUrl: LABEL_TEMPLATE_PREVIEW_SAMPLE_ASSET_DETAILS_URL,
  };
}

export function getLabelElementValue(fieldKey: LabelTemplateElementFieldKey, renderData?: LabelTemplateRenderData) {
  if (fieldKey === "assetDetailsUrl") {
    return renderData?.assetDetailsUrl?.trim() || LABEL_TEMPLATE_PREVIEW_SAMPLE_ASSET_DETAILS_URL;
  }

  const value = renderData?.values?.[fieldKey];

  if (typeof value === "string") {
    return value;
  }

  return getLabelPreviewValue(fieldKey);
}

export function getLabelValueMapForAsset(asset: {
  assetTag: string;
  serialNumber?: string | null;
  name: string;
}) {
  return {
    assetTag: asset.assetTag,
    serialNumber: asset.serialNumber?.trim() || "",
    assetName: asset.name,
  } satisfies LabelTemplateValueMap;
}

export function getLabelTemplateUnitLabel(unit: LabelTemplateUnit) {
  if (unit === "millimeters") {
    return "mm";
  }

  if (unit === "centimeters") {
    return "cm";
  }

  return "in";
}

export function getLabelTemplateCssUnit(unit: LabelTemplateUnit) {
  if (unit === "millimeters") {
    return "mm";
  }

  if (unit === "centimeters") {
    return "cm";
  }

  return "in";
}

export function getLabelTemplateFontWeightLabel(weight: LabelTemplateFontWeight) {
  if (weight === "500") {
    return "Medium";
  }

  if (weight === "600") {
    return "Semibold";
  }

  if (weight === "700") {
    return "Bold";
  }

  return "Regular";
}

export function getDefaultTemplateDimensions(unit: LabelTemplateUnit) {
  if (unit === "millimeters") {
    return { width: 50, height: 25 };
  }

  if (unit === "centimeters") {
    return { width: 5, height: 2.5 };
  }

  return { width: 2, height: 1 };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function clampLabelElementToBounds(
  element: LabelTemplateElementDefinition,
  template: { width: number; height: number },
): LabelTemplateElementDefinition {
  const minWidth = LABEL_TEMPLATE_MIN_ELEMENT_WIDTH;
  const minHeight = LABEL_TEMPLATE_MIN_ELEMENT_HEIGHT;
  const safeWidth = Math.max(element.width, minWidth);
  const safeHeight = Math.max(element.height, minHeight);
  const x = clampNumber(element.x, 0, Math.max(template.width - safeWidth, 0));
  const y = clampNumber(element.y, 0, Math.max(template.height - safeHeight, 0));
  const width = clampNumber(safeWidth, minWidth, Math.max(template.width - x, minWidth));
  const height = clampNumber(safeHeight, minHeight, Math.max(template.height - y, minHeight));

  return {
    ...element,
    width,
    height,
    x,
    y,
  };
}

export function createDefaultLabelElement(args: {
  fieldKey: LabelTemplateFieldKey;
  order: number;
  templateWidth: number;
  templateHeight: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
}): LabelTemplateElementDefinition {
  const marginTop = args.marginTop ?? 0.08;
  const marginRight = args.marginRight ?? 0.08;
  const marginBottom = args.marginBottom ?? 0.08;
  const marginLeft = args.marginLeft ?? 0.08;
  const availableWidth = Math.max(args.templateWidth - marginLeft - marginRight, args.templateWidth * 0.5, 0.5);
  const availableHeight = Math.max(args.templateHeight - marginTop - marginBottom, args.templateHeight * 0.45, 0.5);
  const slotSpacing = Math.max(availableHeight / 3.2, 0.22);
  const defaultHeight = Math.max(Math.min(slotSpacing * 0.58, availableHeight / 4.1), 0.16);
  const widthMultiplier = args.fieldKey === "assetTag"
    ? 0.4
    : args.fieldKey === "serialNumber"
      ? 0.48
      : 0.58;
  const defaultWidth = Math.max(
    Math.min(availableWidth * widthMultiplier, availableWidth - 0.12),
    LABEL_TEMPLATE_MIN_ELEMENT_WIDTH,
  );

  return clampLabelElementToBounds(
    {
      type: "text",
      fieldKey: args.fieldKey,
      displayName: getLabelElementDisplayName({ type: "text", fieldKey: args.fieldKey }),
      isVisible: true,
      x: marginLeft,
      y: marginTop + slotSpacing * args.order,
      width: defaultWidth,
      height: defaultHeight,
      fontSize: args.fieldKey === "assetName" ? 11 : 12,
      fontWeight: args.fieldKey === "assetTag" ? "700" : "normal",
      italic: false,
      textAlign: "left",
      rotation: 0,
      zIndex: args.order,
    },
    { width: args.templateWidth, height: args.templateHeight },
  );
}

export function createDefaultMachineLabelElement(args: {
  type: Extract<LabelTemplateElementType, "barcode" | "qr">;
  order: number;
  templateWidth: number;
  templateHeight: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
}): LabelTemplateElementDefinition {
  const marginTop = args.marginTop ?? 0.08;
  const marginRight = args.marginRight ?? 0.08;
  const marginBottom = args.marginBottom ?? 0.08;
  const marginLeft = args.marginLeft ?? 0.08;
  const availableWidth = Math.max(args.templateWidth - marginLeft - marginRight, args.templateWidth * 0.5, 0.5);
  const availableHeight = Math.max(args.templateHeight - marginTop - marginBottom, args.templateHeight * 0.45, 0.5);

  if (args.type === "barcode") {
    const width = Math.max(Math.min(availableWidth * 0.72, availableWidth - 0.1), 0.6);
    const height = Math.max(Math.min(availableHeight * 0.34, 0.38), 0.22);

    return clampLabelElementToBounds(
      {
        type: "barcode",
        fieldKey: "assetTag",
        displayName: getLabelElementDisplayName({ type: "barcode", fieldKey: "assetTag" }),
        isVisible: true,
        x: marginLeft,
        y: Math.max(args.templateHeight - marginBottom - height, marginTop),
        width,
        height,
        fontSize: 12,
        fontWeight: "normal",
        italic: false,
        textAlign: "left",
        rotation: 0,
        zIndex: args.order,
      },
      { width: args.templateWidth, height: args.templateHeight },
    );
  }

  const size = Math.max(Math.min(Math.min(availableWidth, availableHeight) * 0.36, 0.46), 0.28);

  return clampLabelElementToBounds(
    {
      type: "qr",
      fieldKey: "assetDetailsUrl",
      displayName: getLabelElementDisplayName({ type: "qr", fieldKey: "assetDetailsUrl" }),
      isVisible: true,
      x: Math.max(args.templateWidth - marginRight - size, marginLeft),
      y: marginTop,
      width: size,
      height: size,
      fontSize: 12,
      fontWeight: "normal",
      italic: false,
      textAlign: "left",
      rotation: 0,
      zIndex: args.order,
    },
    { width: args.templateWidth, height: args.templateHeight },
  );
}
