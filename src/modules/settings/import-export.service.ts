import { createLabelTemplate, listPortableLabelTemplates } from "@/modules/labels/label-template.service";
import { createAsset } from "@/modules/assets/asset.service";
import { createCategory } from "@/modules/categories/category.service";
import { createLocation } from "@/modules/locations/location.service";
import { createScope } from "@/modules/scopes/scope.service";
import {
  labelTemplateElementFieldKeySchema,
  labelTemplateElementTypeSchema,
  labelTemplateFieldKeySchema,
  labelTemplateFontWeightSchema,
  labelTemplateOrientationSchema,
  labelTemplateTextAlignmentSchema,
  labelTemplateUnitSchema,
} from "@/modules/labels/label-template.shared";
import {
  buildCategoryLevelColumns,
  buildCategoryDecisionMap,
  buildCategoryPathLabel,
  CATEGORY_LEVEL_FIELD_IDS,
  CATEGORY_LEVEL_LABELS,
  buildCategoryReferenceLabel,
  normalizeCategoryPath,
  parseCategoryHierarchyValues,
  resolveCategoryPathForImport,
  splitCategoryPath,
} from "@/modules/settings/category-import-paths";
import { ensureDefaultAssetStatuses, upsertAssetStatus } from "@/modules/settings/settings.service";
import {
  formatDateForCsv,
  isBlankRow,
  parseBooleanish,
  splitMultiValue,
  stringifyCsv,
  type AssetImportResolutions,
  type ImportColumnMapping,
  type ImportExportReferenceData,
  type ImportFormat,
  type ImportResolutionEntry,
  type TabularData,
  type UserImportResolutions,
} from "@/modules/settings/import-export.shared";
import { createUser } from "@/modules/users/user.service";
import { db } from "@/services/database";
import { utils as xlsxUtils, write as writeWorkbook } from "xlsx";
import { z } from "zod";

type RowOutcome = {
  rowNumber: number;
  status: "imported" | "skipped" | "failed";
  messages: string[];
};

type ImportSummary = {
  totalRowsRead: number;
  rowsValid: number;
  rowsImported: number;
  rowsSkipped: number;
  rowsFailed: number;
  assetsAssignedToUsers?: number;
  assetsLeftUnassigned?: number;
  warnings: string[];
  rowResults: RowOutcome[];
};

type ExportPayload = {
  fileName: string;
  format: ImportFormat;
  tabular?: TabularData;
  records?: Array<Record<string, string>>;
  jsonBody?: unknown;
};

const labelTemplateImportSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().default(""),
  width: z.number().positive().max(1000),
  height: z.number().positive().max(1000),
  unit: labelTemplateUnitSchema,
  orientation: labelTemplateOrientationSchema,
  marginTop: z.number().min(0).max(100),
  marginRight: z.number().min(0).max(100),
  marginBottom: z.number().min(0).max(100),
  marginLeft: z.number().min(0).max(100),
  isEnabled: z.boolean(),
  enabledFieldKeys: z.array(labelTemplateFieldKeySchema),
  elements: z.array(
    z.object({
      type: labelTemplateElementTypeSchema,
      fieldKey: labelTemplateElementFieldKeySchema,
      x: z.number().min(0).max(1000),
      y: z.number().min(0).max(1000),
      width: z.number().positive().max(1000),
      height: z.number().positive().max(1000),
      fontSize: z.number().int().min(6).max(96),
      fontWeight: labelTemplateFontWeightSchema,
      italic: z.boolean(),
      textAlign: labelTemplateTextAlignmentSchema,
      rotation: z.number().min(-360).max(360),
      zIndex: z.number().int().min(0).max(1000),
    }),
  ),
});

const labelTemplateImportFileSchema = z.union([
  z.object({
    kind: z.literal("labels").optional(),
    exportedAt: z.string().optional(),
    templates: z.array(labelTemplateImportSchema),
  }),
  z.object({
    kind: z.literal("labels").optional(),
    exportedAt: z.string().optional(),
    records: z.array(labelTemplateImportSchema),
  }),
]);


function buildTreeLabel(items: Array<{ id: string; name: string; parentId: string | null }>, itemId: string | null | undefined) {
  if (!itemId) {
    return null;
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const labels: string[] = [];
  let current = byId.get(itemId) ?? null;

  while (current) {
    labels.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }

  return labels.join(" / ");
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePathLabel(value: string) {
  return value
    .split("/")
    .flatMap((segment) => segment.split("\\"))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(" / ");
}

function splitPathSegments(value: string) {
  const normalizedPath = normalizePathLabel(value);
  return normalizedPath ? normalizedPath.split(" / ").map((segment) => segment.trim()).filter(Boolean) : [];
}

function buildPathLabelFromMappedValues(pathValue: string, nameValue?: string, parentPathValue?: string) {
  const directPath = normalizePathLabel(pathValue);
  if (directPath) {
    return directPath;
  }

  const name = nameValue?.trim() ?? "";
  if (!name) {
    return "";
  }

  const parentPath = normalizePathLabel(parentPathValue ?? "");
  return parentPath ? `${parentPath} / ${name}` : name;
}

function normalizeColorMode(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "none";
  if (normalized === "border" || normalized === "fill" || normalized === "none") {
    return normalized;
  }
  return null;
}

function normalizeColorHex(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "";
  return /^#(?:[0-9A-F]{6})$/.test(trimmed) ? trimmed : null;
}

async function ensureCategoryPath(
  pathLabel: string,
  references: Array<{ id: string; label: string; name: string; parentId: string | null }>,
  leafAppearance?: { colorHex?: string; colorMode?: "border" | "fill" | "none" },
) {
  const segments = splitCategoryPath(pathLabel);
  if (segments.length === 0) {
    throw new Error("Category Path is required.");
  }

  let parentId: string | null = null;
  let currentPathSegments: string[] = [];

  for (const [index, segment] of segments.entries()) {
    currentPathSegments = [...currentPathSegments, segment];
    const currentPath = buildCategoryPathLabel(currentPathSegments);
    const normalizedPath = normalizeCategoryPath(currentPath);
    let existing = references.find((item) => normalizeCategoryPath(item.label) === normalizedPath) ?? null;

    if (!existing) {
      const created = await createCategory({
        name: segment,
        parentId: parentId ?? undefined,
        colorHex: index === segments.length - 1 ? leafAppearance?.colorHex : undefined,
        colorMode: index === segments.length - 1 ? leafAppearance?.colorMode : undefined,
      });

      existing = {
        id: created.id,
        label: currentPath,
        name: created.name,
        parentId: created.parentId,
      };
      references.push(existing);
    }

    parentId = existing.id;
  }

  const finalPath = buildCategoryPathLabel(currentPathSegments);
  return references.find((item) => normalizeCategoryPath(item.label) === normalizeCategoryPath(finalPath)) ?? null;
}

async function ensureLocationPath(
  pathLabel: string,
  references: Array<{ id: string; label: string; name: string; parentId: string | null }>,
  leafInput?: { description?: string; colorHex?: string; colorMode?: "border" | "fill" | "none" },
) {
  const segments = splitPathSegments(pathLabel);
  if (segments.length === 0) {
    throw new Error("Location Path is required.");
  }

  let parentId: string | null = null;
  let currentPath = "";

  for (const [index, segment] of segments.entries()) {
    currentPath = currentPath ? `${currentPath} / ${segment}` : segment;
    const normalizedPath = normalizeValue(currentPath);
    let existing = references.find((item) => normalizeValue(item.label) === normalizedPath) ?? null;

    if (!existing) {
      const created = await createLocation({
        name: segment,
        parentId: parentId ?? undefined,
        description: index === segments.length - 1 ? leafInput?.description : undefined,
        colorHex: index === segments.length - 1 ? leafInput?.colorHex : undefined,
        colorMode: index === segments.length - 1 ? leafInput?.colorMode : undefined,
      });

      existing = {
        id: created.id,
        label: currentPath,
        name: created.name,
        parentId: created.parentId,
      };
      references.push(existing);
    }

    parentId = existing.id;
  }

  return references.find((item) => normalizeValue(item.label) === normalizeValue(currentPath)) ?? null;
}

function buildLookupByLabel<T extends { id: string; label: string }>(items: T[]) {
  const direct = new Map<string, T>();
  const fallback = new Map<string, T>();
  const duplicateFallbacks = new Set<string>();

  for (const item of items) {
    direct.set(normalizeValue(item.label), item);
    const leaf = item.label.split(" /").at(-1)?.trim() ?? item.label;
    const key = normalizeValue(leaf);
    if (!key) continue;
    if (fallback.has(key)) {
      duplicateFallbacks.add(key);
      fallback.delete(key);
    } else if (!duplicateFallbacks.has(key)) {
      fallback.set(key, item);
    }
  }

  return { direct, fallback };
}

function resolveLookup<T extends { id: string; label: string }>(value: string, lookup: ReturnType<typeof buildLookupByLabel<T>>) {
  const normalized = normalizeValue(value);
  if (!normalized) return null;
  return lookup.direct.get(normalized) ?? lookup.fallback.get(normalized) ?? null;
}

function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function getMappedValues(columns: ImportColumnMapping[], row: string[]) {
  const mapped = new Map<string, string>();

  columns.forEach((column, index) => {
    if (!column.fieldId) return;
    mapped.set(column.fieldId, row[index]?.trim() ?? "");
  });

  return mapped;
}

function validateUniqueMappings(columns: ImportColumnMapping[]) {
  const seen = new Set<string>();
  for (const column of columns) {
    if (!column.fieldId) continue;
    if (seen.has(column.fieldId)) {
      throw new Error(`CSV field mapping contains duplicate target: ${column.fieldId}`);
    }
    seen.add(column.fieldId);
  }
}

function buildResolutionMap(entries?: ImportResolutionEntry[]) {
  const map = new Map<string, ImportResolutionEntry>();

  for (const entry of entries ?? []) {
    map.set(normalizeValue(entry.sourceValue), entry);
  }

  return map;
}

function slugifyRoleKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_") || "IMPORTED_ROLE";
}

async function createImportedRole(name: string) {
  const trimmedName = name.trim();
  const baseKey = slugifyRoleKey(trimmedName);
  let key = baseKey;
  let suffix = 2;

  while (await db.role.findUnique({ where: { key }, select: { id: true } })) {
    key = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return db.role.create({
    data: {
      key,
      name: trimmedName,
    },
    select: {
      key: true,
      name: true,
    },
  });
}

export async function getImportExportReferenceData(): Promise<ImportExportReferenceData> {
  await ensureDefaultAssetStatuses();

  const [categories, scopes, locations, statuses, users, roles, assets, labelTemplates] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, parentId: true }, orderBy: [{ name: "asc" }] }),
    db.scope.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }] }),
    db.location.findMany({ select: { id: true, name: true, parentId: true }, orderBy: [{ name: "asc" }] }),
    db.assetStatus.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }] }),
    db.user.findMany({ select: { id: true, name: true, email: true }, orderBy: [{ name: "asc" }] }),
    db.role.findMany({ select: { key: true, name: true }, orderBy: [{ name: "asc" }] }),
    db.asset.findMany({ select: { assetTag: true } }),
    db.labelTemplate.findMany({ select: { name: true }, orderBy: [{ name: "asc" }] }),
  ]);

  return {
    assets: {
      categories: categories.map((item) => ({
        id: item.id,
        label: buildCategoryReferenceLabel(categories, item.id) ?? item.name,
        name: item.name,
        parentId: item.parentId,
      })),
      departments: scopes.map((item) => ({ id: item.id, label: item.name })),
      locations: locations.map((item) => ({ id: item.id, label: buildTreeLabel(locations, item.id) ?? item.name })),
      statuses: statuses.map((item) => ({ id: item.id, label: item.name })),
      users: users.map((item) => ({ id: item.id, name: item.name, email: item.email })),
      existingAssetTags: assets.map((item) => item.assetTag),
    },
    users: {
      departments: scopes.map((item) => ({ id: item.id, label: item.name })),
      roles,
      existingEmails: users.map((item) => item.email.toLowerCase()),
    },
    categories: {
      existingPaths: categories.map((item) => buildCategoryReferenceLabel(categories, item.id) ?? item.name),
    },
    scopes: {
      existingNames: scopes.map((item) => item.name),
    },
    locations: {
      existingPaths: locations.map((item) => buildTreeLabel(locations, item.id) ?? item.name),
    },
    labels: {
      existingNames: labelTemplates.map((item) => item.name),
    },
  };
}

async function buildAssetsExportData(): Promise<TabularData> {
  await ensureDefaultAssetStatuses();

  const assets = await db.asset.findMany({
    select: {
      assetTag: true,
      name: true,
      make: true,
      model: true,
      serialNumber: true,
      notes: true,
      purchaseDate: true,
      warrantyExpiry: true,
      categoryId: true,
      status: { select: { name: true } },
      assignedUser: { select: { name: true, email: true } },
      assignedLocation: { select: { id: true, name: true, parentId: true } },
      scopes: { select: { scope: { select: { name: true } } } },
    },
    orderBy: [{ assetTag: "asc" }],
  });

  const [categories, locations] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, parentId: true } }),
    db.location.findMany({ select: { id: true, name: true, parentId: true } }),
  ]);

  const headers = [
    "Asset Tag",
    "Asset Name",
    "Make",
    "Model",
    "Status",
    "Assigned User",
    "Assigned User Email",
    "Location",
    "Category",
    "Departments",
    "Serial Number",
    "Purchase Date",
    "Warranty Expiry",
    "Notes",
  ];

  const rows = assets.map((asset) => [
    asset.assetTag,
    asset.name,
    asset.make ?? "",
    asset.model ?? "",
    asset.status?.name ?? "",
    asset.assignedUser?.name ?? "",
    asset.assignedUser?.email ?? "",
    asset.assignedLocation ? buildTreeLabel(locations, asset.assignedLocation.id) ?? asset.assignedLocation.name : "",
    buildTreeLabel(categories, asset.categoryId) ?? "",
    asset.scopes.map((item) => item.scope.name).join("; "),
    asset.serialNumber ?? "",
    formatDateForCsv(asset.purchaseDate),
    formatDateForCsv(asset.warrantyExpiry),
    asset.notes ?? "",
  ]);

  return { headers, rows };
}

async function buildUsersExportData(): Promise<TabularData> {
  const users = await db.user.findMany({
    select: {
      name: true,
      email: true,
      canLogin: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      userRoles: { select: { role: { select: { name: true } } } },
      userScopes: { select: { scope: { select: { name: true } } } },
    },
    orderBy: [{ name: "asc" }],
  });

  const headers = [
    "Display Name",
    "Email",
    "Role",
    "Departments",
    "Login Enabled",
    "Active",
    "Last Login",
    "Created At",
  ];

  const rows = users.map((user) => [
    user.name,
    user.email,
    user.userRoles[0]?.role.name ?? "",
    user.userScopes.map((item) => item.scope.name).join("; "),
    user.canLogin ? "Yes" : "No",
    user.isActive ? "Yes" : "No",
    user.lastLoginAt?.toISOString() ?? "",
    user.createdAt.toISOString(),
  ]);

  return { headers, rows };
}

async function buildCategoriesExportData(): Promise<TabularData> {
  const categories = await db.category.findMany({
    select: {
      id: true,
      name: true,
      parentId: true,
      slug: true,
      colorHex: true,
      colorMode: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const headers = [...CATEGORY_LEVEL_LABELS, "Category Slug", "Color Hex", "Color Mode"];
  const rows = categories
    .map((category) => {
      const path = buildCategoryReferenceLabel(categories, category.id) ?? category.name;
      const segments = splitCategoryPath(path);

      return [
        ...buildCategoryLevelColumns(segments),
        category.slug,
        category.colorHex ?? "",
        category.colorMode ?? "none",
      ];
    })
    .sort((left, right) => {
      const leftPath = buildCategoryPathLabel(left.slice(0, CATEGORY_LEVEL_LABELS.length).filter(Boolean));
      const rightPath = buildCategoryPathLabel(right.slice(0, CATEGORY_LEVEL_LABELS.length).filter(Boolean));
      const depthDifference = splitCategoryPath(leftPath).length - splitCategoryPath(rightPath).length;
      return depthDifference !== 0 ? depthDifference : leftPath.localeCompare(rightPath);
    });

  return { headers, rows };
}

async function buildScopesExportData(): Promise<TabularData> {
  const scopes = await db.scope.findMany({
    select: {
      name: true,
      description: true,
      colorHex: true,
      colorMode: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const headers = ["Department Name", "Description", "Color Hex", "Color Mode"];
  const rows = scopes.map((scope) => [
    scope.name,
    scope.description ?? "",
    scope.colorHex ?? "",
    scope.colorMode ?? "none",
  ]);

  return { headers, rows };
}

async function buildLocationsExportData(): Promise<TabularData> {
  const locations = await db.location.findMany({
    select: {
      id: true,
      name: true,
      parentId: true,
      description: true,
      colorHex: true,
      colorMode: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const headers = ["Location Path", "Location Name", "Parent Location", "Description", "Color Hex", "Color Mode"];
  const rows = locations
    .map((location) => {
      const path = buildTreeLabel(locations, location.id) ?? location.name;
      const parentPath = location.parentId ? buildTreeLabel(locations, location.parentId) ?? "" : "";

      return [
        path,
        location.name,
        parentPath,
        location.description ?? "",
        location.colorHex ?? "",
        location.colorMode ?? "none",
      ];
    })
    .sort((left, right) => left[0].localeCompare(right[0]));

  return { headers, rows };
}

async function buildLabelsExportData(): Promise<ExportPayload> {
  const templates = await listPortableLabelTemplates();

  return {
    fileName: "labels-export",
    format: "json",
    jsonBody: {
      kind: "labels",
      exportedAt: new Date().toISOString(),
      templates,
    },
  };
}

async function buildExportPayload(kind: "assets" | "users" | "categories" | "scopes" | "locations" | "labels", format: ImportFormat): Promise<ExportPayload> {
  if (kind === "labels") {
    return buildLabelsExportData();
  }

  const tabular = kind === "assets"
    ? await buildAssetsExportData()
    : kind === "users"
      ? await buildUsersExportData()
      : kind === "categories"
        ? await buildCategoriesExportData()
        : kind === "scopes"
          ? await buildScopesExportData()
          : await buildLocationsExportData();

  return {
    fileName: `${kind}-export`,
    format,
    tabular,
    records: tabular.rows.map((row) => Object.fromEntries(tabular.headers.map((header, index) => [header, row[index] ?? ""]))),
  };
}

export async function exportAssetsCsv() {
  const data = await buildAssetsExportData();
  return stringifyCsv(data.headers, data.rows);
}

export async function exportUsersCsv() {
  const data = await buildUsersExportData();
  return stringifyCsv(data.headers, data.rows);
}

export async function exportData(kind: "assets" | "users" | "categories" | "scopes" | "locations" | "labels", format: ImportFormat) {
  return buildExportPayload(kind, format);
}

export function buildExportFileResponse(payload: ExportPayload) {
  if (payload.format === "json") {
    return {
      body: JSON.stringify(
        payload.jsonBody ?? {
          kind: payload.fileName.replace(/-export$/, ""),
          exportedAt: new Date().toISOString(),
          records: payload.records ?? [],
        },
        null,
        2,
      ),
      contentType: "application/json; charset=utf-8",
      fileName: `${payload.fileName}.json`,
    };
  }

  if (payload.format === "xlsx") {
    if (!payload.tabular) {
      throw new Error("XLSX export requires tabular data.");
    }

    const worksheet = xlsxUtils.aoa_to_sheet([payload.tabular.headers, ...payload.tabular.rows]);
    const workbook = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(workbook, worksheet, "Export");

    return {
      body: Buffer.from(writeWorkbook(workbook, { type: "buffer", bookType: "xlsx" })),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `${payload.fileName}.xlsx`,
    };
  }

  if (!payload.tabular) {
    throw new Error("CSV export requires tabular data.");
  }

  return {
    body: stringifyCsv(payload.tabular.headers, payload.tabular.rows),
    contentType: "text/csv; charset=utf-8",
    fileName: `${payload.fileName}.csv`,
  };
}

export async function importAssetsFromRows(input: {
  columns: ImportColumnMapping[];
  rows: string[][];
  actorUserId: string;
  resolutions?: AssetImportResolutions;
}) {
  validateUniqueMappings(input.columns);

  const mappedFieldIds = new Set(input.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string));
  if (!mappedFieldIds.has("assetTag")) {
    throw new Error("Missing required asset import mapping: assetTag");
  }

  const references = await getImportExportReferenceData();
  const categoryResolutionMap = buildCategoryDecisionMap(input.resolutions?.categories);
  const statusResolutionMap = buildResolutionMap(input.resolutions?.statuses);
  const scopeResolutionMap = buildResolutionMap(input.resolutions?.scopes);

  for (const entry of input.resolutions?.statuses ?? []) {
    const normalized = normalizeValue(entry.sourceValue);
    if (entry.action !== "create" || !normalized) continue;
    if (references.assets.statuses.some((item) => normalizeValue(item.label) === normalized)) continue;
    const created = await upsertAssetStatus({ name: entry.sourceValue.trim(), color: "#94A3B8" });
    references.assets.statuses.push({ id: created.id, label: created.name });
  }

  for (const entry of input.resolutions?.scopes ?? []) {
    const normalized = normalizeValue(entry.sourceValue);
    if (entry.action !== "create" || !normalized) continue;
    if (references.assets.departments.some((item) => normalizeValue(item.label) === normalized)) continue;
    const created = await createScope({ name: entry.sourceValue.trim() });
    references.assets.departments.push({ id: created.id, label: created.name });
  }

  const locationLookup = buildLookupByLabel(references.assets.locations);
  const statusLookup = buildLookupByLabel(references.assets.statuses);
  const departmentLookup = buildLookupByLabel(references.assets.departments);
  const userEmailMap = new Map(references.assets.users.map((user) => [user.email.toLowerCase(), user]));
  const userNameMap = new Map<string, { id: string; name: string; email: string }>();
  for (const user of references.assets.users) {
    const key = user.name.trim().toLowerCase();
    if (key && !userNameMap.has(key)) userNameMap.set(key, user);
  }

  const existingAssetTags = new Set(references.assets.existingAssetTags.map((tag) => tag.toUpperCase()));
  const seenAssetTags = new Set<string>();
  const nonBlankRows = input.rows.filter((row) => !isBlankRow(row));
  const summary: ImportSummary = {
    totalRowsRead: nonBlankRows.length,
    rowsValid: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    assetsAssignedToUsers: 0,
    assetsLeftUnassigned: 0,
    warnings: [],
    rowResults: [],
  };

  for (const [index, row] of nonBlankRows.entries()) {
    const rowNumber = index + 2;
    const mapped = getMappedValues(input.columns, row);
    const messages: string[] = [];

    const name = mapped.get("name") ?? "";
    const make = mapped.get("make") ?? "";
    const model = mapped.get("model") ?? "";
    const assetTag = (mapped.get("assetTag") ?? "").trim().toUpperCase();
    const serialNumber = mapped.get("serialNumber") ?? "";
    const notes = mapped.get("notes") ?? "";
    const purchaseDate = normalizeDateInput(mapped.get("purchaseDate") ?? "");
    const warrantyExpiry = normalizeDateInput(mapped.get("warrantyExpiry") ?? "");

    if (!assetTag) {
      messages.push("Asset Tag is required.");
    }

    if ((mapped.get("purchaseDate") ?? "").trim() && purchaseDate === null) {
      messages.push("Purchase Date is invalid.");
    }

    if ((mapped.get("warrantyExpiry") ?? "").trim() && warrantyExpiry === null) {
      messages.push("Warranty Expiry is invalid.");
    }

    if (assetTag) {
      if (existingAssetTags.has(assetTag)) {
        messages.push(`Asset Tag ${assetTag} already exists.`);
      }
      if (seenAssetTags.has(assetTag)) {
        messages.push(`Asset Tag ${assetTag} is duplicated in this file.`);
      }
    }

    const categoryValue = mapped.get("category") ?? "";
    const categoryResult = await resolveCategoryPathForImport(
      categoryValue,
      references.assets.categories,
      categoryResolutionMap,
      async ({ name, parentId }) => createCategory({ name, parentId: parentId ?? undefined }),
    );
    const category = categoryResult.status === "resolved" ? categoryResult.category : null;
    if (categoryValue && categoryResult.status === "skipped") {
      messages.push(`Warning: category skipped (${categoryResult.skippedPath}).`);
    } else if (categoryValue && categoryResult.status === "unresolved") {
      messages.push(`Category not found: ${categoryResult.missingPath}`);
    }

    const statusValue = mapped.get("status") ?? "";
    const statusResolution = statusResolutionMap.get(normalizeValue(statusValue));
    let status = statusValue ? resolveLookup(statusValue, statusLookup) : null;
    if (!status && statusResolution?.action === "map" && statusResolution.targetValue) {
      status = references.assets.statuses.find((item) => item.id === statusResolution.targetValue) ?? null;
    }
    if (statusValue && !status && statusResolution?.action === "skip") {
      messages.push(`Warning: status skipped (${statusValue}).`);
    } else if (statusValue && !status) {
      messages.push(`Status not found: ${statusValue}`);
    }

    const locationValue = mapped.get("location") ?? "";
    const location = locationValue ? resolveLookup(locationValue, locationLookup) : null;
    if (locationValue && !location) {
      messages.push(`Location not found: ${locationValue}`);
    }

    const scopeValues = splitMultiValue(mapped.get("scopes") ?? "");
    const scopeIds: string[] = [];
    for (const value of scopeValues) {
      const scopeResolution = scopeResolutionMap.get(normalizeValue(value));
      const scope = resolveLookup(value, departmentLookup);
      if (scope) {
        scopeIds.push(scope.id);
      } else if (scopeResolution?.action === "map" && scopeResolution.targetValue) {
        scopeIds.push(scopeResolution.targetValue);
      } else if (scopeResolution?.action === "skip") {
        messages.push(`Warning: department skipped (${value}).`);
      } else {
        messages.push(`Department not found: ${value}`);
      }
    }

    const assignedUserValue = mapped.get("assignedUser") ?? "";
    let assignedUserId: string | undefined;
    if (assignedUserValue.trim()) {
      const normalizedAssignedUser = assignedUserValue.trim().toLowerCase();
      const matchedUser = userEmailMap.get(normalizedAssignedUser) ?? userNameMap.get(normalizedAssignedUser);
      if (matchedUser) {
        assignedUserId = matchedUser.id;
      } else {
        summary.assetsLeftUnassigned = (summary.assetsLeftUnassigned ?? 0) + 1;
        messages.push(`Warning: user not found for assignment (${assignedUserValue}); asset will remain unassigned.`);
      }
    }

    const blockingMessages = messages.filter((message) => !message.startsWith("Warning:"));
    if (blockingMessages.length > 0) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages });
      continue;
    }

    summary.rowsValid += 1;

    try {
      await createAsset({
        name,
        make,
        model,
        assetTag: assetTag || undefined,
        serialNumber,
        notes,
        purchaseDate: purchaseDate ?? undefined,
        warrantyExpiry: warrantyExpiry ?? undefined,
        categoryId: category?.id,
        statusId: status?.id,
        assignedUserId,
        assignedLocationId: location?.id,
        scopeIds: Array.from(new Set(scopeIds)),
        actorUserId: input.actorUserId,
      });

      if (assetTag) {
        existingAssetTags.add(assetTag);
        seenAssetTags.add(assetTag);
      }
      if (assignedUserId) {
        summary.assetsAssignedToUsers = (summary.assetsAssignedToUsers ?? 0) + 1;
      }

      summary.rowsImported += 1;
      summary.rowResults.push({ rowNumber, status: "imported", messages: messages.length > 0 ? messages : ["Imported successfully."] });
    } catch (error) {
      summary.rowsFailed += 1;
      const message = error instanceof Error ? error.message : "Unexpected import error.";
      summary.rowResults.push({ rowNumber, status: "failed", messages: [message, ...messages] });
    }
  }

  if ((summary.assetsLeftUnassigned ?? 0) > 0) {
    summary.warnings.push(`${summary.assetsLeftUnassigned} asset(s) were left unassigned because matching users could not be found.`);
  }

  return summary;
}

export async function importUsersFromRows(input: {
  columns: ImportColumnMapping[];
  rows: string[][];
  actorUserId: string;
  resolutions?: UserImportResolutions;
}) {
  validateUniqueMappings(input.columns);

  const references = await getImportExportReferenceData();
  const roleResolutionMap = buildResolutionMap(input.resolutions?.roles);
  const scopeResolutionMap = buildResolutionMap(input.resolutions?.scopes);

  for (const entry of input.resolutions?.roles ?? []) {
    const normalized = normalizeValue(entry.sourceValue);
    if (entry.action !== "create" || !normalized) continue;
    if (references.users.roles.some((role) => normalizeValue(role.name) === normalized || normalizeValue(role.key) === normalized)) continue;
    const created = await createImportedRole(entry.sourceValue);
    references.users.roles.push(created);
  }

  for (const entry of input.resolutions?.scopes ?? []) {
    const normalized = normalizeValue(entry.sourceValue);
    if (entry.action !== "create" || !normalized) continue;
    if (references.users.departments.some((item) => normalizeValue(item.label) === normalized)) continue;
    const created = await createScope({ name: entry.sourceValue.trim() });
    references.users.departments.push({ id: created.id, label: created.name });
  }

  const roleByKey = new Map(references.users.roles.map((role) => [role.key.toLowerCase(), role]));
  const roleByName = new Map(references.users.roles.map((role) => [role.name.toLowerCase(), role]));
  const departmentLookup = buildLookupByLabel(references.users.departments);
  const existingEmails = new Set(references.users.existingEmails.map((email) => email.toLowerCase()));
  const seenEmails = new Set<string>();
  const requiredMappings = new Set(["name", "email"]);
  const mappedFieldIds = new Set(input.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string));
  for (const requiredField of requiredMappings) {
    if (!mappedFieldIds.has(requiredField)) {
      throw new Error(`Missing required user import mapping: ${requiredField}`);
    }
  }

  const nonBlankRows = input.rows.filter((row) => !isBlankRow(row));
  const summary: ImportSummary = {
    totalRowsRead: nonBlankRows.length,
    rowsValid: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    warnings: [],
    rowResults: [],
  };

  for (const [index, row] of nonBlankRows.entries()) {
    const rowNumber = index + 2;
    const mapped = getMappedValues(input.columns, row);
    const messages: string[] = [];

    const name = mapped.get("name") ?? "";
    const email = (mapped.get("email") ?? "").trim().toLowerCase();
    const roleValue = (mapped.get("role") ?? "").trim();
    const isActiveValue = (mapped.get("isActive") ?? "").trim();

    if (!name.trim()) {
      messages.push("Display Name is required.");
    }

    if (!email) {
      messages.push("Email is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      messages.push(`Email is invalid: ${email}`);
    } else {
      if (existingEmails.has(email)) {
        messages.push(`Email already exists: ${email}`);
      }
      if (seenEmails.has(email)) {
        messages.push(`Email is duplicated in this file: ${email}`);
      }
    }

    const roleResolution = roleResolutionMap.get(normalizeValue(roleValue));
    let resolvedRole = roleValue ? roleByKey.get(roleValue.toLowerCase()) ?? roleByName.get(roleValue.toLowerCase()) : roleByKey.get("viewer");
    if (!resolvedRole && roleResolution?.action === "map" && roleResolution.targetValue) {
      resolvedRole = roleByKey.get(roleResolution.targetValue.toLowerCase());
    }
    if (roleValue && !resolvedRole) {
      messages.push(`Role not found: ${roleValue}`);
    }

    const scopeValues = splitMultiValue(mapped.get("scopes") ?? "");
    const scopeIds: string[] = [];
    for (const value of scopeValues) {
      const scopeResolution = scopeResolutionMap.get(normalizeValue(value));
      const scope = resolveLookup(value, departmentLookup);
      if (scope) {
        scopeIds.push(scope.id);
      } else if (scopeResolution?.action === "map" && scopeResolution.targetValue) {
        scopeIds.push(scopeResolution.targetValue);
      } else if (scopeResolution?.action === "skip") {
        messages.push(`Warning: department skipped (${value}).`);
      } else {
        messages.push(`Department not found: ${value}`);
      }
    }

    const isActiveParsed = isActiveValue ? parseBooleanish(isActiveValue) : true;
    if (isActiveValue && isActiveParsed === null) {
      messages.push(`Active value is invalid: ${isActiveValue}`);
    }

    const blockingMessages = messages.filter((message) => !message.startsWith("Warning:"));
    if (blockingMessages.length > 0) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages });
      continue;
    }

    summary.rowsValid += 1;

    try {
      await createUser({
        name,
        email,
        allowLogin: false,
        roleKey: resolvedRole?.key ?? "VIEWER",
        scopeIds: Array.from(new Set(scopeIds)),
        isActive: Boolean(isActiveParsed),
      });

      existingEmails.add(email);
      seenEmails.add(email);
      summary.rowsImported += 1;
      summary.rowResults.push({ rowNumber, status: "imported", messages: messages.length > 0 ? messages : ["Imported successfully."] });
    } catch (error) {
      summary.rowsFailed += 1;
      const message = error instanceof Error ? error.message : "Unexpected import error.";
      summary.rowResults.push({ rowNumber, status: "failed", messages: [message, ...messages] });
    }
  }

  return summary;
}

export async function importCategoriesFromRows(input: {
  columns: ImportColumnMapping[];
  rows: string[][];
}) {
  validateUniqueMappings(input.columns);

  const mappedFieldIds = new Set(input.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string));
  if (!mappedFieldIds.has("level1")) {
    throw new Error("Missing required category import mapping: level1");
  }

  const categories = await db.category.findMany({
    select: {
      id: true,
      name: true,
      parentId: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const references = categories.map((category) => ({
    id: category.id,
    label: buildCategoryReferenceLabel(categories, category.id) ?? category.name,
    name: category.name,
    parentId: category.parentId,
  }));

  const existingPaths = new Set(references.map((item) => normalizeCategoryPath(item.label)));
  const seenPaths = new Set<string>();
  const nonBlankRows = input.rows.filter((row) => !isBlankRow(row));
  const summary: ImportSummary = {
    totalRowsRead: nonBlankRows.length,
    rowsValid: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    warnings: [],
    rowResults: [],
  };

  for (const [index, row] of nonBlankRows.entries()) {
    const rowNumber = index + 2;
    const mapped = getMappedValues(input.columns, row);
    const hierarchy = parseCategoryHierarchyValues(CATEGORY_LEVEL_FIELD_IDS.map((fieldId) => mapped.get(fieldId) ?? ""));
    const path = buildCategoryPathLabel(hierarchy.segments);
    const normalizedPath = normalizeCategoryPath(path);
    const colorHex = normalizeColorHex(mapped.get("colorHex") ?? "");
    const colorMode = normalizeColorMode(mapped.get("colorMode") ?? "");
    const messages: string[] = [];

    if (hierarchy.error) {
      messages.push(hierarchy.error);
    }
    if (!hierarchy.error && hierarchy.segments.length === 0) {
      messages.push(`${CATEGORY_LEVEL_LABELS[0]} is required.`);
    }
    if ((mapped.get("colorHex") ?? "").trim() && colorHex === null) {
      messages.push("Color Hex must be a valid #RRGGBB value.");
    }
    if ((mapped.get("colorMode") ?? "").trim() && colorMode === null) {
      messages.push("Color Mode must be border, fill, or none.");
    }

    if (messages.length > 0) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages });
      continue;
    }

    summary.rowsValid += 1;

    if (existingPaths.has(normalizedPath)) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages: [`Category already exists: ${path}`] });
      continue;
    }

    if (seenPaths.has(normalizedPath)) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages: [`Category is duplicated in this file: ${path}`] });
      continue;
    }

    try {
      const created = await ensureCategoryPath(path, references, {
        colorHex: colorHex || undefined,
        colorMode: (colorMode ?? "none") as "border" | "fill" | "none",
      });

      if (created) {
        existingPaths.add(normalizedPath);
        seenPaths.add(normalizedPath);
      }

      summary.rowsImported += 1;
      summary.rowResults.push({ rowNumber, status: "imported", messages: ["Imported successfully."] });
    } catch (error) {
      summary.rowsFailed += 1;
      summary.rowResults.push({
        rowNumber,
        status: "failed",
        messages: [error instanceof Error ? error.message : "Unexpected import error."],
      });
    }
  }

  return summary;
}

export async function importScopesFromRows(input: {
  columns: ImportColumnMapping[];
  rows: string[][];
}) {
  validateUniqueMappings(input.columns);

  const mappedFieldIds = new Set(input.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string));
  if (!mappedFieldIds.has("name")) {
    throw new Error("Missing required department import mapping: name");
  }

  const scopes = await db.scope.findMany({
    select: {
      name: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const existingNames = new Set(scopes.map((scope) => normalizeValue(scope.name)));
  const seenNames = new Set<string>();
  const nonBlankRows = input.rows.filter((row) => !isBlankRow(row));
  const summary: ImportSummary = {
    totalRowsRead: nonBlankRows.length,
    rowsValid: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    warnings: [],
    rowResults: [],
  };

  for (const [index, row] of nonBlankRows.entries()) {
    const rowNumber = index + 2;
    const mapped = getMappedValues(input.columns, row);
    const name = (mapped.get("name") ?? "").trim();
    const description = (mapped.get("description") ?? "").trim();
    const colorHex = normalizeColorHex(mapped.get("colorHex") ?? "");
    const colorMode = normalizeColorMode(mapped.get("colorMode") ?? "");
    const normalizedName = normalizeValue(name);
    const messages: string[] = [];

    if (!name) {
      messages.push("Department Name is required.");
    }
    if ((mapped.get("colorHex") ?? "").trim() && colorHex === null) {
      messages.push("Color Hex must be a valid #RRGGBB value.");
    }
    if ((mapped.get("colorMode") ?? "").trim() && colorMode === null) {
      messages.push("Color Mode must be border, fill, or none.");
    }

    if (messages.length > 0) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages });
      continue;
    }

    summary.rowsValid += 1;

    if (existingNames.has(normalizedName)) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages: [`Department already exists: ${name}`] });
      continue;
    }

    if (seenNames.has(normalizedName)) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages: [`Department is duplicated in this file: ${name}`] });
      continue;
    }

    try {
      await createScope({
        name,
        description: description || undefined,
        colorHex: colorHex || undefined,
        colorMode: (colorMode ?? "none") as "border" | "fill" | "none",
      });

      existingNames.add(normalizedName);
      seenNames.add(normalizedName);
      summary.rowsImported += 1;
      summary.rowResults.push({ rowNumber, status: "imported", messages: ["Imported successfully."] });
    } catch (error) {
      summary.rowsFailed += 1;
      summary.rowResults.push({
        rowNumber,
        status: "failed",
        messages: [error instanceof Error ? error.message : "Unexpected import error."],
      });
    }
  }

  return summary;
}

export async function importLocationsFromRows(input: {
  columns: ImportColumnMapping[];
  rows: string[][];
}) {
  validateUniqueMappings(input.columns);

  const mappedFieldIds = new Set(input.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string));
  if (!mappedFieldIds.has("path")) {
    throw new Error("Missing required location import mapping: path");
  }

  const locations = await db.location.findMany({
    select: {
      id: true,
      name: true,
      parentId: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const references = locations.map((location) => ({
    id: location.id,
    label: buildTreeLabel(locations, location.id) ?? location.name,
    name: location.name,
    parentId: location.parentId,
  }));

  const existingPaths = new Set(references.map((item) => normalizeValue(item.label)));
  const seenPaths = new Set<string>();
  const nonBlankRows = input.rows.filter((row) => !isBlankRow(row));
  const summary: ImportSummary = {
    totalRowsRead: nonBlankRows.length,
    rowsValid: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    warnings: [],
    rowResults: [],
  };

  for (const [index, row] of nonBlankRows.entries()) {
    const rowNumber = index + 2;
    const mapped = getMappedValues(input.columns, row);
    const path = buildPathLabelFromMappedValues(mapped.get("path") ?? "", mapped.get("name"), mapped.get("parentPath"));
    const normalizedPath = normalizeValue(path);
    const description = (mapped.get("description") ?? "").trim();
    const colorHex = normalizeColorHex(mapped.get("colorHex") ?? "");
    const colorMode = normalizeColorMode(mapped.get("colorMode") ?? "");
    const messages: string[] = [];

    if (!path) {
      messages.push("Location Path is required.");
    }
    if ((mapped.get("colorHex") ?? "").trim() && colorHex === null) {
      messages.push("Color Hex must be a valid #RRGGBB value.");
    }
    if ((mapped.get("colorMode") ?? "").trim() && colorMode === null) {
      messages.push("Color Mode must be border, fill, or none.");
    }

    if (messages.length > 0) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages });
      continue;
    }

    summary.rowsValid += 1;

    if (existingPaths.has(normalizedPath)) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages: [`Location already exists: ${path}`] });
      continue;
    }

    if (seenPaths.has(normalizedPath)) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({ rowNumber, status: "skipped", messages: [`Location is duplicated in this file: ${path}`] });
      continue;
    }

    try {
      const created = await ensureLocationPath(path, references, {
        description: description || undefined,
        colorHex: colorHex || undefined,
        colorMode: (colorMode ?? "none") as "border" | "fill" | "none",
      });

      if (created) {
        existingPaths.add(normalizedPath);
        seenPaths.add(normalizedPath);
      }

      summary.rowsImported += 1;
      summary.rowResults.push({ rowNumber, status: "imported", messages: ["Imported successfully."] });
    } catch (error) {
      summary.rowsFailed += 1;
      summary.rowResults.push({
        rowNumber,
        status: "failed",
        messages: [error instanceof Error ? error.message : "Unexpected import error."],
      });
    }
  }

  return summary;
}

export async function importLabelTemplatesFromJson(input: unknown) {
  const parsed = labelTemplateImportFileSchema.parse(input);
  const templates = "templates" in parsed ? parsed.templates : parsed.records;
  const existingNames = new Set(
    (await db.labelTemplate.findMany({ select: { name: true }, orderBy: [{ name: "asc" }] }))
      .map((template) => normalizeValue(template.name)),
  );
  const seenNames = new Set<string>();

  const summary: ImportSummary = {
    totalRowsRead: templates.length,
    rowsValid: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    warnings: [],
    rowResults: [],
  };

  for (const [index, template] of templates.entries()) {
    const rowNumber = index + 1;
    const normalizedName = normalizeValue(template.name);

    summary.rowsValid += 1;

    if (existingNames.has(normalizedName)) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({
        rowNumber,
        status: "skipped",
        messages: [`Label template already exists: ${template.name}`],
      });
      continue;
    }

    if (seenNames.has(normalizedName)) {
      summary.rowsSkipped += 1;
      summary.rowResults.push({
        rowNumber,
        status: "skipped",
        messages: [`Label template is duplicated in this file: ${template.name}`],
      });
      continue;
    }

    try {
      await createLabelTemplate({
        name: template.name,
        description: template.description,
        width: template.width,
        height: template.height,
        unit: template.unit,
        orientation: template.orientation,
        isEnabled: template.isEnabled,
        marginTop: template.marginTop,
        marginRight: template.marginRight,
        marginBottom: template.marginBottom,
        marginLeft: template.marginLeft,
        enabledFieldKeys: template.enabledFieldKeys,
        elements: template.elements,
      });

      existingNames.add(normalizedName);
      seenNames.add(normalizedName);
      summary.rowsImported += 1;
      summary.rowResults.push({
        rowNumber,
        status: "imported",
        messages: ["Imported successfully."],
      });
    } catch (error) {
      summary.rowsFailed += 1;
      summary.rowResults.push({
        rowNumber,
        status: "failed",
        messages: [error instanceof Error ? error.message : "Unexpected import error."],
      });
    }
  }

  return summary;
}

