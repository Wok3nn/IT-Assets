export const MAX_SUB_CATEGORY_LEVELS = 5;
export const MAX_CATEGORY_PATH_LEVELS = MAX_SUB_CATEGORY_LEVELS + 1;

export const MAKE_MODEL_SOURCE_OPTIONS = [
  { value: "category", label: "Category", index: 0 },
  ...Array.from({ length: MAX_SUB_CATEGORY_LEVELS }, (_, index) => ({
    value: `subCategory${index + 1}` as const,
    label: `Sub-category ${index + 1}`,
    index: index + 1,
  })),
] as const;

export type MakeModelSourceLevel = (typeof MAKE_MODEL_SOURCE_OPTIONS)[number]["value"];

export const DEFAULT_MAKE_MODEL_AUTO_ENABLED = false;
export const DEFAULT_MAKE_MODEL_MAKE_SOURCE: MakeModelSourceLevel = "subCategory1";
export const DEFAULT_MAKE_MODEL_MODEL_SOURCE: MakeModelSourceLevel = "subCategory2";

const sourceOptionByValue = new Map(MAKE_MODEL_SOURCE_OPTIONS.map((option) => [option.value, option]));

export function getMakeModelSourceOption(value: MakeModelSourceLevel) {
  return sourceOptionByValue.get(value) ?? sourceOptionByValue.get("category")!;
}

export function resolveMakeModelSource<T extends { name: string }>(
  lineage: T[],
  sourceLevel: MakeModelSourceLevel,
) {
  const sourceOption = getMakeModelSourceOption(sourceLevel);
  return lineage[sourceOption.index]?.name ?? "";
}
