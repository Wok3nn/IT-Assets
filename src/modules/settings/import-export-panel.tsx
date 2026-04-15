"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ImportCardShell } from "@/modules/settings/components/import-card-shell";
import { ImportSummaryCard } from "@/modules/settings/components/import-summary-card";
import { MissingResolutionSection } from "@/modules/settings/components/missing-resolution-section";
import type {
  ImportSummary,
  MissingResolutionGroup,
  ParsedImportState,
  ResolutionSelection,
  ResolutionSelections,
  ValidationState,
} from "@/modules/settings/components/import-export.types";
import { MappingSection } from "@/modules/settings/components/mapping-section";
import { ValidationSummary } from "@/modules/settings/components/validation-summary";
import {
  ASSET_IMPORT_FIELDS,
  CATEGORY_IMPORT_FIELDS,
  detectImportFormat,
  IGNORE_FIELD_ID,
  LOCATION_IMPORT_FIELDS,
  parseJsonRecords,
  USER_IMPORT_FIELDS,
  SCOPE_IMPORT_FIELDS,
  type ImportFormat,
  parseBooleanish,
  parseCsv,
  splitMultiValue,
  suggestFieldId,
  type AssetImportResolutions,
  type ImportColumnMapping,
  type ImportExportReferenceData,
  type ImportFieldDefinition,
  type ImportKind,
  type ImportResolutionEntry,
  type UserImportResolutions,
} from "@/modules/settings/import-export.shared";
import { cardClass } from "@/modules/settings/components/import-export.styles";
import {
  buildCategoryDecisionMapFromSelections,
  buildCategoryPathLabel,
  CATEGORY_LEVEL_FIELD_IDS,
  CATEGORY_LEVEL_LABELS,
  collectMissingCategoryPaths,
  normalizeCategoryPath,
  parseCategoryHierarchyValues,
  previewResolvedCategoryPath,
  sortCategoryPathLabels,
} from "@/modules/settings/category-import-paths";

type ImportExportPanelProps = {
  references: ImportExportReferenceData;
};

type SimpleImportKind = "categories" | "scopes" | "locations";

type LabelImportPreviewState = {
  fileName: string;
  templateNames: string[];
  payload: unknown;
};

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, value: trimmed };
  }
  return { ok: true, value: parsed.toISOString().slice(0, 10) };
}

function nonBlankRows(rows: string[][]) {
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function buildRequiredDefaultColumns(headers: string[], fields: ImportFieldDefinition[]) {
  const columns = headers.map((header) => ({ header, fieldId: null as string | null }));
  const usedColumnIndexes = new Set<number>();

  for (const field of fields.filter((candidate) => candidate.required)) {
    const matchedIndex = headers.findIndex((header, index) => {
      if (usedColumnIndexes.has(index)) {
        return false;
      }

      return suggestFieldId(header, [field]) === field.id;
    });

    if (matchedIndex >= 0) {
      columns[matchedIndex] = {
        header: headers[matchedIndex],
        fieldId: field.id,
      };
      usedColumnIndexes.add(matchedIndex);
    }
  }

  return columns;
}

function formatHeaderOptionLabel(header: string, index: number, columns: ImportColumnMapping[]) {
  const duplicateCount = columns.slice(0, index + 1).filter((column) => column.header === header).length;
  return duplicateCount > 1 ? `${header} (${duplicateCount})` : header;
}

function getMappedValues(columns: ImportColumnMapping[], row: string[]) {
  const mapped = new Map<string, string>();
  columns.forEach((column, index) => {
    if (!column.fieldId) return;
    mapped.set(column.fieldId, row[index]?.trim() ?? "");
  });
  return mapped;
}


function getResolutionSelectionKey(groupKey: string, sourceValue: string) {
  return groupKey + ":" + normalizeValue(sourceValue);
}

function getResolutionSelection(selections: ResolutionSelections, groupKey: string, sourceValue: string) {
  return selections[getResolutionSelectionKey(groupKey, sourceValue)] ?? { action: "", targetValue: "" };
}

function uniqueSorted(values: Iterable<string>) {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function buildResolutionSummary(groups: MissingResolutionGroup[], selections: ResolutionSelections) {
  let createCount = 0;
  let mapCount = 0;
  let skipCount = 0;
  let unresolvedCount = 0;

  for (const group of groups) {
    for (const value of group.values) {
      const selection = getResolutionSelection(selections, group.key, value);

      if (!selection.action) {
        unresolvedCount += 1;
      } else if (selection.action === "create") {
        createCount += 1;
      } else if (selection.action === "map") {
        if (selection.targetValue) {
          mapCount += 1;
        } else {
          unresolvedCount += 1;
        }
      } else if (selection.action === "skip") {
        skipCount += 1;
      }
    }
  }

  return { createCount, mapCount, skipCount, unresolvedCount };
}

function areResolutionSelectionsEqual(left: ResolutionSelections, right: ResolutionSelections) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftSelection = left[key];
    const rightSelection = right[key];

    return Boolean(rightSelection) && leftSelection.action === rightSelection.action && leftSelection.targetValue === rightSelection.targetValue;
  });
}

function reconcileResolutionSelections(current: ResolutionSelections, groups: MissingResolutionGroup[]) {
  const next: ResolutionSelections = {};

  for (const group of groups) {
    const optionValues = new Set(group.options.map((option) => option.value));

    for (const value of group.values) {
      const selection = current[getResolutionSelectionKey(group.key, value)];
      if (!selection || !selection.action) {
        continue;
      }

      if (selection.action === "create") {
        if (group.allowCreate) {
          next[getResolutionSelectionKey(group.key, value)] = selection;
        }
        continue;
      }

      if (selection.action === "skip") {
        if (group.allowSkip) {
          next[getResolutionSelectionKey(group.key, value)] = selection;
        }
        continue;
      }

      if (selection.action === "map" && group.options.length > 0) {
        next[getResolutionSelectionKey(group.key, value)] = {
          action: "map",
          targetValue: selection.targetValue && optionValues.has(selection.targetValue) ? selection.targetValue : "",
        };
      }
    }
  }

  return next;
}

function buildAssetResolutionGroups(state: ParsedImportState, references: ImportExportReferenceData): MissingResolutionGroup[] {
  const statusLabels = new Set(references.assets.statuses.map((item) => normalizeValue(item.label)));
  const departmentLabels = new Set(references.assets.departments.map((item) => normalizeValue(item.label)));
  const missingCategories = new Set<string>();
  const missingStatuses = new Set<string>();
  const missingDepartments = new Set<string>();

  nonBlankRows(state.rows).forEach((row) => {
    const mapped = getMappedValues(state.columns, row);
    const category = mapped.get("category") ?? "";
    const status = (mapped.get("status") ?? "").trim();

    for (const missingPath of collectMissingCategoryPaths(category, references.assets.categories)) {
      missingCategories.add(missingPath);
    }

    if (status && !statusLabels.has(normalizeValue(status))) {
      missingStatuses.add(status);
    }

    for (const department of splitMultiValue(mapped.get("scopes") ?? "")) {
      if (!departmentLabels.has(normalizeValue(department))) {
        missingDepartments.add(department);
      }
    }
  });

  const groups: MissingResolutionGroup[] = [];

  if (missingCategories.size > 0) {
    groups.push({
      key: "categories",
      label: "Categories",
      allowCreate: true,
      allowSkip: true,
      options: references.assets.categories.map((item) => ({ value: item.id, label: item.label })),
      values: sortCategoryPathLabels(missingCategories),
    });
  }

  if (missingStatuses.size > 0) {
    groups.push({
      key: "statuses",
      label: "Statuses",
      allowCreate: true,
      allowSkip: true,
      options: references.assets.statuses.map((item) => ({ value: item.id, label: item.label })),
      values: uniqueSorted(missingStatuses),
    });
  }

  if (missingDepartments.size > 0) {
    groups.push({
      key: "scopes",
      label: "Departments",
      allowCreate: true,
      allowSkip: true,
      options: references.assets.departments.map((item) => ({ value: item.id, label: item.label })),
      values: uniqueSorted(missingDepartments),
    });
  }

  return groups;
}

function buildUserResolutionGroups(state: ParsedImportState, references: ImportExportReferenceData): MissingResolutionGroup[] {
  const roleNames = new Set(references.users.roles.map((item) => normalizeValue(item.name)));
  const roleKeys = new Set(references.users.roles.map((item) => normalizeValue(item.key)));
  const departmentLabels = new Set(references.users.departments.map((item) => normalizeValue(item.label)));
  const missingRoles = new Set<string>();
  const missingDepartments = new Set<string>();

  nonBlankRows(state.rows).forEach((row) => {
    const mapped = getMappedValues(state.columns, row);
    const role = (mapped.get("role") ?? "").trim();

    if (role && !roleNames.has(normalizeValue(role)) && !roleKeys.has(normalizeValue(role))) {
      missingRoles.add(role);
    }

    for (const department of splitMultiValue(mapped.get("scopes") ?? "")) {
      if (!departmentLabels.has(normalizeValue(department))) {
        missingDepartments.add(department);
      }
    }
  });

  const groups: MissingResolutionGroup[] = [];

  if (missingRoles.size > 0) {
    groups.push({
      key: "roles",
      label: "Roles",
      allowCreate: true,
      allowSkip: false,
      options: references.users.roles.map((item) => ({ value: item.key, label: item.name + " (" + item.key + ")" })),
      values: uniqueSorted(missingRoles),
    });
  }

  if (missingDepartments.size > 0) {
    groups.push({
      key: "scopes",
      label: "Departments",
      allowCreate: true,
      allowSkip: true,
      options: references.users.departments.map((item) => ({ value: item.id, label: item.label })),
      values: uniqueSorted(missingDepartments),
    });
  }

  return groups;
}

function buildAssetValidation(state: ParsedImportState, references: ImportExportReferenceData, resolutionGroups: MissingResolutionGroup[], resolutionSelections: ResolutionSelections): ValidationState {
  const globalErrors: string[] = [];
  const rowErrors: Array<{ rowNumber: number; messages: string[] }> = [];
  const rowWarnings: Array<{ rowNumber: number; messages: string[] }> = [];
  const fieldIds = state.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string);
  const duplicates = fieldIds.filter((fieldId, index) => fieldIds.indexOf(fieldId) !== index);
  const resolutionGroupKeys = new Set(resolutionGroups.map((group) => group.key));

  if (duplicates.length > 0) {
    globalErrors.push("Each app field can only be mapped once.");
  }

  if (!fieldIds.includes("assetTag")) {
    globalErrors.push("Asset Tag must be mapped before import can continue.");
  }

  const resolutionSummary = buildResolutionSummary(resolutionGroups, resolutionSelections);
  if (resolutionSummary.unresolvedCount > 0) {
    globalErrors.push("Resolve all missing related values before import can continue.");
  }

  const existingAssetTags = new Set(references.assets.existingAssetTags.map((value) => value.toUpperCase()));
  const seenAssetTags = new Set<string>();
  const locationLabels = new Set(references.assets.locations.map((item) => normalizeValue(item.label)));
  const statusLabels = new Set(references.assets.statuses.map((item) => normalizeValue(item.label)));
  const departmentLabels = new Set(references.assets.departments.map((item) => normalizeValue(item.label)));
  const userEmails = new Set(references.assets.users.map((item) => normalizeValue(item.email)));
  const userNames = new Set(references.assets.users.map((item) => normalizeValue(item.name)));
  const categoryDecisionMap = buildCategoryDecisionMapFromSelections(resolutionSelections);

  let validRows = 0;

  nonBlankRows(state.rows).forEach((row, index) => {
    const rowNumber = index + 2;
    const mapped = getMappedValues(state.columns, row);
    const errors: string[] = [];
    const warnings: string[] = [];

    const assetTag = (mapped.get("assetTag") ?? "").trim().toUpperCase();
    if (!assetTag) {
      errors.push("Asset Tag is required.");
    }

    if (assetTag) {
      if (existingAssetTags.has(assetTag)) {
        errors.push("Asset Tag already exists: " + assetTag);
      }
      if (seenAssetTags.has(assetTag)) {
        errors.push("Asset Tag is duplicated in this file: " + assetTag);
      }
      seenAssetTags.add(assetTag);
    }

    const purchaseDate = normalizeDate(mapped.get("purchaseDate") ?? "");
    if (!purchaseDate.ok) {
      errors.push("Purchase Date is invalid: " + purchaseDate.value);
    }

    const warrantyExpiry = normalizeDate(mapped.get("warrantyExpiry") ?? "");
    if (!warrantyExpiry.ok) {
      errors.push("Warranty Expiry is invalid: " + warrantyExpiry.value);
    }

    const category = mapped.get("category") ?? "";
    const categoryPreview = previewResolvedCategoryPath(category, references.assets.categories, categoryDecisionMap);
    if (category && categoryPreview.status === "skipped") {
      warnings.push("Category will be left blank: " + categoryPreview.skippedPath);
    } else if (category && categoryPreview.status === "unresolved") {
      errors.push("Category requires resolution: " + categoryPreview.missingPath);
    }

    const location = normalizeValue(mapped.get("location") ?? "");
    if (location && !locationLabels.has(location)) {
      errors.push("Location not found: " + (mapped.get("location") ?? ""));
    }

    const status = (mapped.get("status") ?? "").trim();
    if (status && !statusLabels.has(normalizeValue(status))) {
      const selection = getResolutionSelection(resolutionSelections, "statuses", status);
      if (selection.action === "skip") {
        warnings.push("Status will be left blank: " + status);
      } else if (!resolutionGroupKeys.has("statuses") || !selection.action || (selection.action === "map" && !selection.targetValue)) {
        errors.push("Status requires resolution: " + status);
      }
    }

    for (const department of splitMultiValue(mapped.get("scopes") ?? "")) {
      if (!departmentLabels.has(normalizeValue(department))) {
        const selection = getResolutionSelection(resolutionSelections, "scopes", department);
        if (selection.action === "skip") {
          warnings.push("Department will be skipped: " + department);
        } else if (!resolutionGroupKeys.has("scopes") || !selection.action || (selection.action === "map" && !selection.targetValue)) {
          errors.push("Department requires resolution: " + department);
        }
      }
    }

    const assignedUser = (mapped.get("assignedUser") ?? "").trim();
    if (assignedUser) {
      const normalizedAssignedUser = normalizeValue(assignedUser);
      if (!userEmails.has(normalizedAssignedUser) && !userNames.has(normalizedAssignedUser)) {
        warnings.push("User not found for assignment: " + assignedUser + ". Asset will import as unassigned.");
      }
    }

    if (errors.length > 0) {
      rowErrors.push({ rowNumber, messages: errors });
    } else {
      validRows += 1;
    }

    if (warnings.length > 0) {
      rowWarnings.push({ rowNumber, messages: warnings });
    }
  });

  return { globalErrors, rowErrors, rowWarnings, validRows, resolutionGroups, resolutionSummary };
}
function buildUserValidation(state: ParsedImportState, references: ImportExportReferenceData, resolutionGroups: MissingResolutionGroup[], resolutionSelections: ResolutionSelections): ValidationState {
  const globalErrors: string[] = [];
  const rowErrors: Array<{ rowNumber: number; messages: string[] }> = [];
  const rowWarnings: Array<{ rowNumber: number; messages: string[] }> = [];
  const fieldIds = state.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string);
  const duplicates = fieldIds.filter((fieldId, index) => fieldIds.indexOf(fieldId) !== index);
  const resolutionGroupKeys = new Set(resolutionGroups.map((group) => group.key));

  if (duplicates.length > 0) {
    globalErrors.push("Each app field can only be mapped once.");
  }

  if (!fieldIds.includes("name")) {
    globalErrors.push("Display Name must be mapped before import can continue.");
  }

  if (!fieldIds.includes("email")) {
    globalErrors.push("Email must be mapped before import can continue.");
  }

  const resolutionSummary = buildResolutionSummary(resolutionGroups, resolutionSelections);
  if (resolutionSummary.unresolvedCount > 0) {
    globalErrors.push("Resolve all missing related values before import can continue.");
  }

  const existingEmails = new Set(references.users.existingEmails.map((value) => value.toLowerCase()));
  const seenEmails = new Set<string>();
  const roleNames = new Set(references.users.roles.map((item) => normalizeValue(item.name)));
  const roleKeys = new Set(references.users.roles.map((item) => normalizeValue(item.key)));
  const departmentLabels = new Set(references.users.departments.map((item) => normalizeValue(item.label)));

  let validRows = 0;

  nonBlankRows(state.rows).forEach((row, index) => {
    const rowNumber = index + 2;
    const mapped = getMappedValues(state.columns, row);
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = mapped.get("name") ?? "";
    const email = (mapped.get("email") ?? "").trim().toLowerCase();
    const role = (mapped.get("role") ?? "").trim();
    const isActive = (mapped.get("isActive") ?? "").trim();

    if (!name.trim()) {
      errors.push("Display Name is required.");
    }

    if (!email) {
      errors.push("Email is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Email is invalid: " + email);
    } else {
      if (existingEmails.has(email)) {
        errors.push("Email already exists: " + email);
      }
      if (seenEmails.has(email)) {
        errors.push("Email is duplicated in this file: " + email);
      }
      seenEmails.add(email);
    }

    if (role && !roleNames.has(normalizeValue(role)) && !roleKeys.has(normalizeValue(role))) {
      const selection = getResolutionSelection(resolutionSelections, "roles", role);
      if (!resolutionGroupKeys.has("roles") || !selection.action || (selection.action === "map" && !selection.targetValue)) {
        errors.push("Role requires resolution: " + role);
      }
    }

    for (const department of splitMultiValue(mapped.get("scopes") ?? "")) {
      if (!departmentLabels.has(normalizeValue(department))) {
        const selection = getResolutionSelection(resolutionSelections, "scopes", department);
        if (selection.action === "skip") {
          warnings.push("Department will be skipped: " + department);
        } else if (!resolutionGroupKeys.has("scopes") || !selection.action || (selection.action === "map" && !selection.targetValue)) {
          errors.push("Department requires resolution: " + department);
        }
      }
    }

    if (isActive && parseBooleanish(isActive) === null) {
      errors.push("Active value is invalid: " + isActive);
    }

    if (errors.length > 0) {
      rowErrors.push({ rowNumber, messages: errors });
    } else {
      validRows += 1;
    }

    if (warnings.length > 0) {
      rowWarnings.push({ rowNumber, messages: warnings });
    }
  });

  return { globalErrors, rowErrors, rowWarnings, validRows, resolutionGroups, resolutionSummary };
}

function normalizePathLabel(value: string) {
  return value
    .split("/")
    .flatMap((segment) => segment.split("\\"))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(" / ");
}

function buildPathLabel(pathValue: string, nameValue?: string, parentPathValue?: string) {
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

function normalizeColorHex(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "";
  return /^#(?:[0-9A-F]{6})$/.test(trimmed) ? trimmed : null;
}

function normalizeColorMode(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "none";
  return normalized === "border" || normalized === "fill" || normalized === "none" ? normalized : null;
}

function buildSimpleValidation(kind: SimpleImportKind, state: ParsedImportState, references: ImportExportReferenceData): ValidationState {
  const globalErrors: string[] = [];
  const rowErrors: Array<{ rowNumber: number; messages: string[] }> = [];
  const rowWarnings: Array<{ rowNumber: number; messages: string[] }> = [];
  const fieldIds = state.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string);
  const duplicates = fieldIds.filter((fieldId, index) => fieldIds.indexOf(fieldId) !== index);

  if (duplicates.length > 0) {
    globalErrors.push("Each app field can only be mapped once.");
  }

  if (kind === "scopes") {
    if (!fieldIds.includes("name")) {
      globalErrors.push("Department Name must be mapped before import can continue.");
    }
  } else if (kind === "categories") {
    if (!fieldIds.includes("level1")) {
      globalErrors.push(`${CATEGORY_LEVEL_LABELS[0]} must be mapped before import can continue.`);
    }
  } else if (!fieldIds.includes("path")) {
    globalErrors.push("Location Path must be mapped before import can continue.");
  }

  const existingKeys = new Set(
    kind === "categories"
      ? references.categories.existingPaths.map((value) => normalizeCategoryPath(value))
      : kind === "locations"
        ? references.locations.existingPaths.map((value) => normalizeValue(value))
        : references.scopes.existingNames.map((value) => normalizeValue(value)),
  );
  const seenFileKeys = new Set<string>();

  let validRows = 0;

  nonBlankRows(state.rows).forEach((row, index) => {
    const rowNumber = index + 2;
    const mapped = getMappedValues(state.columns, row);
    const errors: string[] = [];
    const warnings: string[] = [];
    const categoryHierarchy = kind === "categories"
      ? parseCategoryHierarchyValues(CATEGORY_LEVEL_FIELD_IDS.map((fieldId) => mapped.get(fieldId) ?? ""))
      : null;

    const dedupeKey = kind === "scopes"
      ? (mapped.get("name") ?? "").trim()
      : kind === "categories"
        ? buildCategoryPathLabel(categoryHierarchy?.segments ?? [])
        : buildPathLabel(mapped.get("path") ?? "", mapped.get("name"), mapped.get("parentPath"));
    const normalizedKey = kind === "categories" ? normalizeCategoryPath(dedupeKey) : normalizeValue(dedupeKey);
    const colorHex = normalizeColorHex(mapped.get("colorHex") ?? "");
    const colorMode = normalizeColorMode(mapped.get("colorMode") ?? "");

    if (kind === "categories" && categoryHierarchy?.error) {
      errors.push(categoryHierarchy.error);
    }

    if (!dedupeKey) {
      if (kind === "categories" && !categoryHierarchy?.error) {
        errors.push(`${CATEGORY_LEVEL_LABELS[0]} is required.`);
      } else if (kind !== "categories") {
        errors.push(kind === "scopes" ? "Department Name is required." : "Location Path is required.");
      }
    }

    if ((mapped.get("colorHex") ?? "").trim() && colorHex === null) {
      errors.push("Color Hex must be a valid #RRGGBB value.");
    }

    if ((mapped.get("colorMode") ?? "").trim() && colorMode === null) {
      errors.push("Color Mode must be border, fill, or none.");
    }

    if (normalizedKey) {
      if (existingKeys.has(normalizedKey)) {
        warnings.push(`${kind === "scopes" ? "Department" : kind === "categories" ? "Category" : "Location"} already exists and will be skipped: ${dedupeKey}`);
      }
      if (seenFileKeys.has(normalizedKey)) {
        warnings.push(`${kind === "scopes" ? "Department" : kind === "categories" ? "Category" : "Location"} is duplicated in this file and later rows will be skipped: ${dedupeKey}`);
      }
      seenFileKeys.add(normalizedKey);
    }

    if (errors.length > 0) {
      rowErrors.push({ rowNumber, messages: errors });
    } else {
      validRows += 1;
    }

    if (warnings.length > 0) {
      rowWarnings.push({ rowNumber, messages: warnings });
    }
  });

  return {
    globalErrors,
    rowErrors,
    rowWarnings,
    validRows,
    resolutionGroups: [],
    resolutionSummary: {
      createCount: 0,
      mapCount: 0,
      skipCount: 0,
      unresolvedCount: 0,
    },
  };
}

function parseLabelImportPreview(text: string) {
  const parsed = JSON.parse(text) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Label import JSON must be an object.");
  }

  const templates = Array.isArray((parsed as { templates?: unknown[] }).templates)
    ? (parsed as { templates: unknown[] }).templates
    : Array.isArray((parsed as { records?: unknown[] }).records)
      ? (parsed as { records: unknown[] }).records
      : null;

  if (!templates) {
    throw new Error("Label import JSON must include a templates array.");
  }

  const templateNames = templates.map((template, index) => {
    if (!template || typeof template !== "object" || Array.isArray(template)) {
      throw new Error(`Label template ${index + 1} must be an object.`);
    }

    const name = typeof (template as { name?: unknown }).name === "string" ? (template as { name: string }).name.trim() : "";
    if (!name) {
      throw new Error(`Label template ${index + 1} is missing a name.`);
    }

    return name;
  });

  return { payload: parsed, templateNames };
}
function ImportCard({
  kind,
  title,
  description,
  exportHref,
  fields,
  references,
  importNote,
  formatGuidance,
  skipNote,
}: {
  kind: ImportKind;
  title: string;
  description: string;
  exportHref: string;
  fields: ImportFieldDefinition[];
  references: ImportExportReferenceData;
  importNote?: string;
  formatGuidance?: string;
  skipNote?: string;
}) {
  const [state, setState] = useState<ParsedImportState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [selectedHeaderToAdd, setSelectedHeaderToAdd] = useState("");
  const [resolutionSelections, setResolutionSelections] = useState<ResolutionSelections>({});

  const requiredFields = useMemo(() => fields.filter((field) => field.required), [fields]);
  const optionalFields = useMemo(() => fields.filter((field) => !field.required), [fields]);

  const resolutionGroups = useMemo(() => {
    if (!state) return [];
    if (kind === "assets") return buildAssetResolutionGroups(state, references);
    if (kind === "users") return buildUserResolutionGroups(state, references);
    return [];
  }, [kind, references, state]);

  useEffect(() => {
    setResolutionSelections((current) => {
      const next = reconcileResolutionSelections(current, resolutionGroups);
      return areResolutionSelectionsEqual(current, next) ? current : next;
    });
  }, [resolutionGroups]);

  const validation = useMemo(() => {
    if (!state) return null;
    if (kind === "assets") {
      return buildAssetValidation(state, references, resolutionGroups, resolutionSelections);
    }
    if (kind === "users") {
      return buildUserValidation(state, references, resolutionGroups, resolutionSelections);
    }
    if (kind === "categories" || kind === "scopes" || kind === "locations") {
      return buildSimpleValidation(kind, state, references);
    }
    return null;
  }, [kind, references, resolutionGroups, resolutionSelections, state]);

  const requiredMappingRows = useMemo(() => {
    if (!state) return [];
    return requiredFields.map((field) => ({
      field,
      columnIndex: state.columns.findIndex((column) => column.fieldId === field.id),
    }));
  }, [requiredFields, state]);

  const visibleOptionalRows = useMemo(() => {
    if (!state) return [];
    return state.visibleOptionalColumnIndexes
      .map((columnIndex) => ({
        columnIndex,
        column: state.columns[columnIndex],
        mappedField: optionalFields.find((field) => field.id === state.columns[columnIndex]?.fieldId) ?? null,
      }))
      .filter((entry) => entry.column);
  }, [optionalFields, state]);

  const previewHeaders = useMemo(() => {
    if (!state) return [];
    return state.columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.fieldId)
      .map(({ column, index }) => ({
        key: `${column.header}-${index}`,
        label: fields.find((field) => field.id === column.fieldId)?.label ?? column.header,
      }));
  }, [fields, state]);

  const previewRows = useMemo(() => {
    if (!state) return [];
    const visibleColumnIndexes = state.columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.fieldId)
      .map(({ index }) => index);

    return nonBlankRows(state.rows)
      .slice(0, 5)
      .map((row) => visibleColumnIndexes.map((columnIndex) => row[columnIndex] ?? ""));
  }, [state]);

  const addableHeaderOptions = useMemo(() => {
    if (!state) return [];
    const visibleOptionalSet = new Set(state.visibleOptionalColumnIndexes);
    const requiredSet = new Set(requiredMappingRows.filter((row) => row.columnIndex >= 0).map((row) => row.columnIndex));

    return state.columns
      .map((column, index) => ({ index, label: formatHeaderOptionLabel(column.header, index, state.columns) }))
      .filter(({ index }) => !visibleOptionalSet.has(index) && !requiredSet.has(index));
  }, [requiredMappingRows, state]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const format = detectImportFormat(file.name);
    if (!format) {
      setSubmitError("Unsupported file type. Upload CSV, XLSX, or JSON.");
      return;
    }

    const parsed = format === "csv"
      ? parseCsv(await file.text())
      : format === "json"
        ? parseJsonRecords(await file.text())
        : await (async () => {
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][])
              .map((row) => row.map((cell) => String(cell ?? "").trim()))
              .filter((row) => row.some((cell) => cell.length > 0));
            const [headers = [], ...bodyRows] = rows as string[][];
            return { headers, rows: bodyRows };
          })();

    if (parsed.headers.length === 0) {
      setSubmitError("The uploaded file does not contain a header row.");
      return;
    }

    setState({
      fileName: file.name,
      rows: parsed.rows,
      columns: buildRequiredDefaultColumns(parsed.headers, fields),
      visibleOptionalColumnIndexes: [],
    });
    setImportSummary(null);
    setSubmitError(null);
    setResolutionSelections({});
    setShowAddMapping(false);
    setSelectedHeaderToAdd("");
  }

  function updateRequiredHeader(requiredFieldId: string, nextColumnIndexValue: string) {
    const nextColumnIndex = Number(nextColumnIndexValue);
    if (!Number.isInteger(nextColumnIndex)) return;

    setState((current) => {
      if (!current) return current;
      const nextColumns = current.columns.map((column) => ({ ...column }));
      const currentRequiredIndex = nextColumns.findIndex((column) => column.fieldId === requiredFieldId);
      if (currentRequiredIndex >= 0) {
        nextColumns[currentRequiredIndex].fieldId = null;
      }
      nextColumns[nextColumnIndex].fieldId = requiredFieldId;

      return {
        ...current,
        columns: nextColumns,
        visibleOptionalColumnIndexes: current.visibleOptionalColumnIndexes.filter((index) => index !== nextColumnIndex),
      };
    });
    setImportSummary(null);
    setSubmitError(null);

  }

  function updateOptionalField(columnIndex: number, nextFieldId: string) {
    setState((current) => {
      if (!current) return current;
      const nextColumns = current.columns.map((column) => ({ ...column }));
      const normalizedFieldId = nextFieldId === IGNORE_FIELD_ID ? null : nextFieldId;

      if (normalizedFieldId) {
        const existingColumnIndex = nextColumns.findIndex((column, index) => index !== columnIndex && column.fieldId === normalizedFieldId);
        if (existingColumnIndex >= 0) {
          nextColumns[existingColumnIndex].fieldId = null;
        }
      }

      nextColumns[columnIndex].fieldId = normalizedFieldId;
      return { ...current, columns: nextColumns };
    });
    setImportSummary(null);
    setSubmitError(null);

  }

  function removeOptionalMapping(columnIndex: number) {
    setState((current) => {
      if (!current) return current;
      const nextColumns = current.columns.map((column) => ({ ...column }));
      nextColumns[columnIndex].fieldId = null;
      return {
        ...current,
        columns: nextColumns,
        visibleOptionalColumnIndexes: current.visibleOptionalColumnIndexes.filter((index) => index !== columnIndex),
      };
    });
    setImportSummary(null);
    setSubmitError(null);

  }

  function resetMappings() {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        columns: buildRequiredDefaultColumns(current.columns.map((column) => column.header), fields),
        visibleOptionalColumnIndexes: [],
      };
    });
    setImportSummary(null);
    setSubmitError(null);
    setResolutionSelections({});
    setShowAddMapping(false);
    setSelectedHeaderToAdd("");
  }

  function addOptionalMapping() {
    const nextColumnIndex = Number(selectedHeaderToAdd);
    if (!state || !Number.isInteger(nextColumnIndex)) return;

    const suggestedFieldId = suggestFieldId(state.columns[nextColumnIndex].header, optionalFields);
    const usedFieldIds = new Set(
      state.columns
        .map((column, index) => (index === nextColumnIndex ? null : column.fieldId))
        .filter((fieldId): fieldId is string => Boolean(fieldId)),
    );
    const nextFieldId = suggestedFieldId && !usedFieldIds.has(suggestedFieldId) ? suggestedFieldId : null;

    setState((current) => {
      if (!current) return current;
      if (current.visibleOptionalColumnIndexes.includes(nextColumnIndex)) return current;

      const nextColumns = current.columns.map((column) => ({ ...column }));
      nextColumns[nextColumnIndex].fieldId = nextFieldId;

      return {
        ...current,
        columns: nextColumns,
        visibleOptionalColumnIndexes: [...current.visibleOptionalColumnIndexes, nextColumnIndex],
      };
    });
    setImportSummary(null);
    setSubmitError(null);

    setShowAddMapping(false);
    setSelectedHeaderToAdd("");
  }

  function getOptionalFieldOptions(columnIndex: number) {
    if (!state) return [];

    const usedFieldIds = new Set(
      state.columns
        .map((column, index) => (index === columnIndex ? null : column.fieldId))
        .filter((fieldId): fieldId is string => Boolean(fieldId)),
    );

    return optionalFields.filter((field) => !usedFieldIds.has(field.id) || state.columns[columnIndex]?.fieldId === field.id);
  }

  function updateResolutionSelection(groupKey: string, sourceValue: string, next: Partial<ResolutionSelection>) {
    setResolutionSelections((current) => {
      const currentSelection = getResolutionSelection(current, groupKey, sourceValue);

      return {
        ...current,
        [getResolutionSelectionKey(groupKey, sourceValue)]: {
          action: next.action ?? currentSelection.action,
          targetValue: next.targetValue ?? currentSelection.targetValue,
        },
      };
    });
    setImportSummary(null);
    setSubmitError(null);
  }

  function selectAllCategoryCreates(values: string[]) {
    setResolutionSelections((current) => {
      const next = { ...current };

      for (const value of values) {
        const existingSelection = getResolutionSelection(current, "categories", value);
        if (existingSelection.action === "map" || existingSelection.action === "skip") {
          continue;
        }

        next[getResolutionSelectionKey("categories", value)] = {
          action: "create",
          targetValue: "",
        };
      }

      return next;
    });
    setImportSummary(null);
    setSubmitError(null);
  }

  function buildResolutionPayload() {
    if (kind === "assets") {
      const payload: AssetImportResolutions = {};

      for (const group of resolutionGroups) {
        const entries = group.values.reduce<ImportResolutionEntry[]>((accumulator, value) => {
          const selection = getResolutionSelection(resolutionSelections, group.key, value);

          if (!selection.action) {
            return accumulator;
          }

          accumulator.push({
            sourceValue: value,
            action: selection.action,
            targetValue: selection.targetValue || undefined,
          });

          return accumulator;
        }, []);

        if (entries.length > 0 && (group.key === "categories" || group.key === "statuses" || group.key === "scopes")) {
          payload[group.key] = entries;
        }
      }

      return payload;
    }

    if (kind !== "users") {
      return undefined;
    }

    const payload: UserImportResolutions = {};

    for (const group of resolutionGroups) {
      const entries = group.values.reduce<ImportResolutionEntry[]>((accumulator, value) => {
        const selection = getResolutionSelection(resolutionSelections, group.key, value);

        if (!selection.action) {
          return accumulator;
        }

        accumulator.push({
          sourceValue: value,
          action: selection.action,
          targetValue: selection.targetValue || undefined,
        });

        return accumulator;
      }, []);

      if (entries.length > 0 && (group.key === "roles" || group.key === "scopes")) {
        payload[group.key] = entries;
      }
    }

    return payload;
  }
  async function handleImport() {
    if (!state || !validation) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setImportSummary(null);

    try {
      const response = await fetch(`/api/settings/import/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: state.columns, rows: nonBlankRows(state.rows), resolutions: buildResolutionPayload() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Import failed.");
      }

      setImportSummary(data.summary as ImportSummary);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ImportCardShell
      description={description}
      exportHref={exportHref}
      formatGuidance={formatGuidance}
      importNote={importNote}
      onFileChange={handleFileChange}
      skipNote={skipNote}
      title={title}
    >
      {state ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-[#4b5255] dark:bg-[#34393c]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Mapping {state.fileName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{state.columns.length} column(s) detected, {nonBlankRows(state.rows).length} data row(s).</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end">
              <Button onClick={() => { setState(null); setImportSummary(null); setSubmitError(null); setShowAddMapping(false); setSelectedHeaderToAdd(""); setResolutionSelections({}); }} type="button" variant="ghost">Choose another file</Button>
            </div>
          </div>

          <MappingSection
            addableHeaderOptions={addableHeaderOptions}
            formatHeaderLabel={(index) => formatHeaderOptionLabel(state.columns[index]?.header ?? "", index, state.columns)}
            getOptionalFieldOptions={getOptionalFieldOptions}
            onAddOptionalMapping={addOptionalMapping}
            onCancelAddMapping={() => { setShowAddMapping(false); setSelectedHeaderToAdd(""); }}
            onRemoveOptionalMapping={removeOptionalMapping}
            onSelectedHeaderToAddChange={setSelectedHeaderToAdd}
            onToggleAddMapping={() => setShowAddMapping((current) => !current)}
            onUpdateOptionalField={updateOptionalField}
            onUpdateRequiredHeader={updateRequiredHeader}
            requiredMappingRows={requiredMappingRows}
            selectedHeaderToAdd={selectedHeaderToAdd}
            showAddMapping={showAddMapping}
            state={state}
            visibleOptionalRows={visibleOptionalRows}
          />

          {validation && validation.resolutionGroups.length > 0 ? (
            <MissingResolutionSection
              groups={validation.resolutionGroups}
              onSelectAllCategoryCreates={selectAllCategoryCreates}
              onUpdateSelection={updateResolutionSelection}
              selections={resolutionSelections}
              summary={validation.resolutionSummary}
            />
          ) : null}

          {validation ? (
            <ValidationSummary
              actionBar={
                <div className="sticky bottom-0 z-10 rounded-2xl border border-[#ece7df] bg-white/95 p-4 shadow-panel backdrop-blur dark:border-[#4b5255] dark:bg-[#2f3437]/95">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Import only creates new records. Existing matches and rows with blocking issues are skipped.</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button className="min-w-36" onClick={resetMappings} type="button" variant="secondary">Reset mapping</Button>
                      <Button disabled={isSubmitting || validation.globalErrors.length > 0 || validation.rowErrors.length > 0 || validation.validRows === 0 || validation.resolutionSummary.unresolvedCount > 0} onClick={handleImport} type="button">{isSubmitting ? "Importing..." : `Confirm import ${validation.validRows} row${validation.validRows === 1 ? "" : "s"}`}</Button>
                    </div>
                  </div>
                </div>
              }
              previewHeaders={previewHeaders}
              previewRows={previewRows}
              validation={validation}
            />
          ) : null}
        </div>
      ) : null}

      {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{submitError}</div> : null}

      {importSummary ? <ImportSummaryCard importSummary={importSummary} kind={kind} /> : null}
    </ImportCardShell>
  );
}

function LabelsImportCard({ references }: { references: ImportExportReferenceData }) {
  const [previewState, setPreviewState] = useState<LabelImportPreviewState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingNames = useMemo(
    () => new Set(references.labels.existingNames.map((value) => normalizeValue(value))),
    [references.labels.existingNames],
  );

  const previewDuplicateCount = useMemo(() => {
    if (!previewState) return 0;
    return previewState.templateNames.filter((name) => existingNames.has(normalizeValue(name))).length;
  }, [existingNames, previewState]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (detectImportFormat(file.name) !== "json") {
      setSubmitError("Labels import only supports JSON.");
      return;
    }

    try {
      const parsed = parseLabelImportPreview(await file.text());
      setPreviewState({
        fileName: file.name,
        templateNames: parsed.templateNames,
        payload: parsed.payload,
      });
      setImportSummary(null);
      setSubmitError(null);
    } catch (error) {
      setPreviewState(null);
      setImportSummary(null);
      setSubmitError(error instanceof Error ? error.message : "Label template import failed.");
    }
  }

  async function handleImport() {
    if (!previewState) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setImportSummary(null);

    try {
      const response = await fetch("/api/settings/import/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewState.payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Label template import failed.");
      }

      setImportSummary(data.summary as ImportSummary);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Label template import failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ImportCardShell
      description="Export full-fidelity label templates as portable JSON and import them back without flattening the template definition."
      exportFormats={["json"] as ImportFormat[]}
      exportHref="/api/settings/export/labels"
      formatGuidance="JSON is the preferred label format because it preserves dimensions, margins, enabled fields, and element definitions without flattening."
      importAccept=".json,application/json"
      importLabel="Import label templates JSON"
      importNote="Labels use a JSON-first workflow so template sizing, orientation, enabled fields, and element definitions round-trip without losing fidelity."
      onFileChange={handleFileChange}
      skipNote="Existing label templates are skipped by normalized template name during import."
      title="Labels"
    >
      {previewState ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-[#4b5255] dark:bg-[#34393c]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Ready to import {previewState.fileName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {previewState.templateNames.length} template(s) detected. {previewDuplicateCount} already match existing template names and will be skipped.
              </p>
            </div>
            <Button
              onClick={() => {
                setPreviewState(null);
                setImportSummary(null);
                setSubmitError(null);
              }}
              type="button"
              variant="ghost"
            >
              Choose another file
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-slate-100">Templates in file</p>
            <div className="mt-2 space-y-1">
              {previewState.templateNames.slice(0, 8).map((name) => (
                <p key={name}>{name}</p>
              ))}
              {previewState.templateNames.length > 8 ? (
                <p>+ {previewState.templateNames.length - 8} more template(s)</p>
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 rounded-2xl border border-[#ece7df] bg-white/95 p-4 shadow-panel backdrop-blur dark:border-[#4b5255] dark:bg-[#2f3437]/95">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">Import only creates new templates. Existing matches by normalized template name are skipped.</p>
              <Button className="min-w-36" disabled={isSubmitting || previewState.templateNames.length === 0} onClick={handleImport} type="button">
                {isSubmitting ? "Importing..." : `Confirm import ${previewState.templateNames.length} template${previewState.templateNames.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{submitError}</div> : null}
      {importSummary ? <ImportSummaryCard importSummary={importSummary} kind="labels" /> : null}
    </ImportCardShell>
  );
}

export function ImportExportPanel({ references }: ImportExportPanelProps) {
  return (
    <div className="min-w-0 space-y-6">
      <ImportCard
        description="Export assets or import new assets through the existing header-mapping workflow with validation, preview, and confirmation."
        exportHref="/api/settings/export/assets"
        fields={ASSET_IMPORT_FIELDS}
        formatGuidance="CSV/XLSX are best for spreadsheet cleanup and bulk edits. JSON is useful when you want a portable structured export."
        importNote="For best results, import users before importing assets so asset-to-user assignments can be matched automatically."
        kind="assets"
        references={references}
        skipNote="Existing asset tags, duplicate rows, and rows with blocking issues are skipped."
        title="Assets"
      />
      <ImportCard
        description="Export users or import new users with role and department mapping before confirmation."
        exportHref="/api/settings/export/users"
        fields={USER_IMPORT_FIELDS}
        formatGuidance="CSV/XLSX are best for spreadsheet administration. JSON is available when you want a structured handoff."
        kind="users"
        references={references}
        skipNote="Existing emails, duplicate rows, and rows with blocking issues are skipped."
        title="Users"
      />
      <ImportCard
        description="Export category structure or import category rows through explicit Level 1-5 hierarchy columns with duplicate-safe skip behavior."
        exportHref="/api/settings/export/categories"
        fields={CATEGORY_IMPORT_FIELDS}
        formatGuidance="CSV/XLSX use explicit Level 1-5 columns for deterministic spreadsheet round-trips. JSON remains available for structured exchange."
        importNote="Populate category hierarchy left to right across Level 1 through Level 5. Trailing blanks are ignored, but hierarchy gaps such as Level 1 plus Level 3 fail validation."
        kind="categories"
        references={references}
        skipNote="Existing full category paths, repeated full paths in the same file, and invalid hierarchy-gap rows are skipped."
        title="Categories"
      />
      <ImportCard
        description="Export departments or import department records with duplicate-safe skip behavior."
        exportHref="/api/settings/export/scopes"
        fields={SCOPE_IMPORT_FIELDS}
        formatGuidance="CSV/XLSX are best for spreadsheet editing. JSON is available when you need a structured export."
        kind="scopes"
        references={references}
        skipNote="Existing department names and repeated names in the same file are skipped."
        title="Departments"
      />
      <ImportCard
        description="Export location structure or import location paths with duplicate-safe skip behavior."
        exportHref="/api/settings/export/locations"
        fields={LOCATION_IMPORT_FIELDS}
        formatGuidance="CSV/XLSX are best for editing nested location paths in a spreadsheet. JSON is available for structured exchange."
        kind="locations"
        references={references}
        skipNote="Existing location paths and repeated paths in the same file are skipped."
        title="Locations"
      />
      <LabelsImportCard references={references} />

      <Link className={`${cardClass} block transition hover:-translate-y-0.5 hover:border-[#f0c48d] hover:shadow-[0_22px_42px_rgba(246,150,41,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69629]/40 dark:hover:border-[#f0a853] dark:hover:shadow-[0_18px_34px_rgba(0,0,0,0.22)]`} href="/settings/reset">
        <section>
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Settings shortcut</p>
            <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-slate-100">Reset / Administrative Actions</h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">Manage destructive administrative actions such as clearing assets, users, categories, and other system data.</p>
          </div>
          <div className="mt-5">
            <span className="inline-flex rounded-full bg-[rgba(246,150,41,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">
              Open Reset
            </span>
          </div>
        </section>
      </Link>
    </div>
  );
}



