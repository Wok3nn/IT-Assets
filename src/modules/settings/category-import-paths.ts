import type { ImportResolutionAction, ImportResolutionEntry } from "@/modules/settings/import-export.shared";

export type CategoryImportReference = {
  id: string;
  name: string;
  parentId: string | null;
  label: string;
};

type CategoryPathDecision = {
  action: ImportResolutionAction | "";
  targetValue?: string | null;
};

type CategoryPathPreviewResult =
  | { status: "resolved"; category: CategoryImportReference | null }
  | { status: "unresolved"; missingPath: string }
  | { status: "skipped"; skippedPath: string };

type CategoryPathImportResult =
  | { status: "resolved"; category: CategoryImportReference | null }
  | { status: "unresolved"; missingPath: string }
  | { status: "skipped"; skippedPath: string };

type CategoryHierarchyStore = {
  byId: Map<string, CategoryImportReference>;
  byParentAndName: Map<string, CategoryImportReference>;
};

function normalizePathWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCategoryPathSegment(value: string) {
  return normalizePathWhitespace(value);
}

export function splitCategoryPath(value: string) {
  return value
    .split(">")
    .map((segment) => normalizeCategoryPathSegment(segment))
    .filter(Boolean);
}

export function buildCategoryPathLabel(segments: string[]) {
  return segments.map((segment) => normalizeCategoryPathSegment(segment)).filter(Boolean).join(" > ");
}

export function normalizeCategoryPath(value: string) {
  return buildCategoryPathLabel(splitCategoryPath(value)).toLowerCase();
}

function buildHierarchyKey(parentId: string | null, segment: string) {
  return `${parentId ?? "root"}::${normalizeCategoryPathSegment(segment).toLowerCase()}`;
}

function buildCategoryHierarchyStore(categories: CategoryImportReference[]): CategoryHierarchyStore {
  const byId = new Map<string, CategoryImportReference>();
  const byParentAndName = new Map<string, CategoryImportReference>();

  for (const category of categories) {
    byId.set(category.id, category);
    byParentAndName.set(buildHierarchyKey(category.parentId, category.name), category);
  }

  return { byId, byParentAndName };
}

function findCategoryById(store: CategoryHierarchyStore, categoryId: string | null) {
  if (!categoryId) {
    return null;
  }

  return store.byId.get(categoryId) ?? null;
}

function findCategoryChild(store: CategoryHierarchyStore, parentId: string | null, segment: string) {
  return store.byParentAndName.get(buildHierarchyKey(parentId, segment)) ?? null;
}

function registerCategory(store: CategoryHierarchyStore, category: CategoryImportReference) {
  store.byId.set(category.id, category);
  store.byParentAndName.set(buildHierarchyKey(category.parentId, category.name), category);
}

export function sortCategoryPathLabels(values: Iterable<string>) {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => buildCategoryPathLabel(splitCategoryPath(value)))
        .filter(Boolean),
    ),
  ).sort((left, right) => {
    const depthDifference = splitCategoryPath(left).length - splitCategoryPath(right).length;
    return depthDifference !== 0 ? depthDifference : left.localeCompare(right);
  });
}

export function buildCategoryReferenceLabel(categories: Array<{ id: string; name: string; parentId: string | null }>, categoryId: string | null | undefined) {
  if (!categoryId) {
    return null;
  }

  const byId = new Map(categories.map((category) => [category.id, category]));
  const labels: string[] = [];
  let current = byId.get(categoryId) ?? null;

  while (current) {
    labels.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }

  return labels.length > 0 ? buildCategoryPathLabel(labels) : null;
}

function getDecision(decisions: Map<string, CategoryPathDecision>, pathLabel: string) {
  return decisions.get(normalizeCategoryPath(pathLabel)) ?? null;
}

export function buildCategoryDecisionMap(entries?: ImportResolutionEntry[]) {
  const map = new Map<string, CategoryPathDecision>();

  for (const entry of entries ?? []) {
    map.set(normalizeCategoryPath(entry.sourceValue), entry);
  }

  return map;
}

export function buildCategoryDecisionMapFromSelections(
  selections: Record<string, { action: ImportResolutionAction | ""; targetValue: string }>,
) {
  const map = new Map<string, CategoryPathDecision>();

  for (const [key, value] of Object.entries(selections)) {
    if (!key.startsWith("categories:")) {
      continue;
    }

    const normalizedPath = key.slice("categories:".length);
    map.set(normalizedPath, value);
  }

  return map;
}

export function collectMissingCategoryPaths(categoryValue: string, categories: CategoryImportReference[]) {
  const segments = splitCategoryPath(categoryValue);
  if (segments.length === 0) {
    return [];
  }

  const store = buildCategoryHierarchyStore(categories);
  const missingPaths: string[] = [];
  const currentSegments: string[] = [];
  let currentParentId: string | null = null;
  let missingParent = false;

  for (const segment of segments) {
    currentSegments.push(segment);
    const pathLabel = buildCategoryPathLabel(currentSegments);

    if (missingParent) {
      missingPaths.push(pathLabel);
      continue;
    }

    const existing = findCategoryChild(store, currentParentId, segment);
    if (existing) {
      currentParentId = existing.id;
      continue;
    }

    missingPaths.push(pathLabel);
    missingParent = true;
  }

  return missingPaths;
}

export function previewResolvedCategoryPath(
  categoryValue: string,
  categories: CategoryImportReference[],
  decisions: Map<string, CategoryPathDecision>,
): CategoryPathPreviewResult {
  const segments = splitCategoryPath(categoryValue);
  if (segments.length === 0) {
    return { status: "resolved", category: null };
  }

  const workingCategories = categories.map((category) => ({ ...category }));
  const store = buildCategoryHierarchyStore(workingCategories);
  const createdByPath = new Map<string, CategoryImportReference>();
  const currentSegments: string[] = [];
  let currentParentId: string | null = null;
  let currentCategory: CategoryImportReference | null = null;

  for (const segment of segments) {
    currentSegments.push(segment);
    const pathLabel = buildCategoryPathLabel(currentSegments);
    const existing = findCategoryChild(store, currentParentId, segment);
    if (existing) {
      currentCategory = existing;
      currentParentId = existing.id;
      continue;
    }

    const decision = getDecision(decisions, pathLabel);
    if (!decision || !decision.action) {
      return { status: "unresolved", missingPath: pathLabel };
    }

    if (decision.action === "skip") {
      return { status: "skipped", skippedPath: pathLabel };
    }

    if (decision.action === "map" && decision.targetValue) {
      const mappedCategory = findCategoryById(store, decision.targetValue);
      if (!mappedCategory) {
        return { status: "unresolved", missingPath: pathLabel };
      }
      currentCategory = mappedCategory;
      currentParentId = mappedCategory.id;
      continue;
    }

    if (decision.action === "create") {
      const existingCreated = createdByPath.get(normalizeCategoryPath(pathLabel));
      if (existingCreated) {
        currentCategory = existingCreated;
        currentParentId = existingCreated.id;
        continue;
      }

      const createdCategory: CategoryImportReference = {
        id: "preview:" + normalizeCategoryPath(pathLabel),
        name: segment,
        parentId: currentParentId,
        label: pathLabel,
      };
      workingCategories.push(createdCategory);
      registerCategory(store, createdCategory);
      createdByPath.set(normalizeCategoryPath(pathLabel), createdCategory);
      currentCategory = createdCategory;
      currentParentId = createdCategory.id;
      continue;
    }

    return { status: "unresolved", missingPath: pathLabel };
  }

  return { status: "resolved", category: currentCategory };
}

export async function resolveCategoryPathForImport(
  categoryValue: string,
  categories: CategoryImportReference[],
  decisions: Map<string, CategoryPathDecision>,
  createCategoryNode: (input: { name: string; parentId: string | null }) => Promise<{ id: string; name: string; parentId: string | null }>,
): Promise<CategoryPathImportResult> {
  const segments = splitCategoryPath(categoryValue);
  if (segments.length === 0) {
    return { status: "resolved", category: null };
  }

  const store = buildCategoryHierarchyStore(categories);
  const currentSegments: string[] = [];
  let currentParentId: string | null = null;
  let currentCategory: CategoryImportReference | null = null;

  for (const segment of segments) {
    currentSegments.push(segment);
    const pathLabel = buildCategoryPathLabel(currentSegments);
    const existing = findCategoryChild(store, currentParentId, segment);
    if (existing) {
      currentCategory = existing;
      currentParentId = existing.id;
      continue;
    }

    const decision = getDecision(decisions, pathLabel);
    if (!decision || !decision.action) {
      return { status: "unresolved", missingPath: pathLabel };
    }

    if (decision.action === "skip") {
      return { status: "skipped", skippedPath: pathLabel };
    }

    if (decision.action === "map" && decision.targetValue) {
      const mappedCategory = findCategoryById(store, decision.targetValue);
      if (!mappedCategory) {
        return { status: "unresolved", missingPath: pathLabel };
      }
      currentCategory = mappedCategory;
      currentParentId = mappedCategory.id;
      continue;
    }

    if (decision.action === "create") {
      const duplicate = findCategoryChild(store, currentParentId, segment);
      if (duplicate) {
        currentCategory = duplicate;
        currentParentId = duplicate.id;
        continue;
      }

      const created = await createCategoryNode({ name: segment, parentId: currentParentId });
      const createdReference: CategoryImportReference = {
        id: created.id,
        name: created.name,
        parentId: created.parentId,
        label: buildCategoryReferenceLabel([...categories, created], created.id) ?? created.name,
      };
      categories.push(createdReference);
      registerCategory(store, createdReference);
      currentCategory = createdReference;
      currentParentId = createdReference.id;
      continue;
    }

    return { status: "unresolved", missingPath: pathLabel };
  }

  return { status: "resolved", category: currentCategory };
}
