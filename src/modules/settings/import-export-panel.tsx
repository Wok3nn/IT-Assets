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
  IGNORE_FIELD_ID,
  USER_IMPORT_FIELDS,
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
  collectMissingCategoryPaths,
  previewResolvedCategoryPath,
  sortCategoryPathLabels,
} from "@/modules/settings/category-import-paths";

type ImportExportPanelProps = {
  references: ImportExportReferenceData;
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
function ImportCard({
  kind,
  title,
  description,
  exportHref,
  fields,
  references,
  importNote,
}: {
  kind: ImportKind;
  title: string;
  description: string;
  exportHref: string;
  fields: ImportFieldDefinition[];
  references: ImportExportReferenceData;
  importNote?: string;
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
    return kind === "assets" ? buildAssetResolutionGroups(state, references) : buildUserResolutionGroups(state, references);
  }, [kind, references, state]);

  useEffect(() => {
    setResolutionSelections((current) => {
      const next = reconcileResolutionSelections(current, resolutionGroups);
      return areResolutionSelectionsEqual(current, next) ? current : next;
    });
  }, [resolutionGroups]);

  const validation = useMemo(() => {
    if (!state) return null;
    return kind === "assets"
      ? buildAssetValidation(state, references, resolutionGroups, resolutionSelections)
      : buildUserValidation(state, references, resolutionGroups, resolutionSelections);
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

    const text = await file.text();
    const parsed = parseCsv(text);

    if (parsed.headers.length === 0) {
      setSubmitError("The uploaded CSV does not contain a header row.");
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
    <ImportCardShell description={description} exportHref={exportHref} importNote={importNote} onFileChange={handleFileChange} title={title}>
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">Import only creates new records. Rows with blocking issues are skipped.</p>
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

export function ImportExportPanel({ references }: ImportExportPanelProps) {
  return (
    <div className="min-w-0 space-y-6">
      <ImportCard description="Export assets to CSV or import new assets through a header-mapping workflow with validation, preview, and confirmation." exportHref="/api/settings/export/assets" fields={ASSET_IMPORT_FIELDS} importNote="For best results, import users before importing assets so asset-to-user assignments can be matched automatically." kind="assets" references={references} title="Assets CSV" />
      <ImportCard description="Export users to CSV or import new users with role and department mapping before confirmation." exportHref="/api/settings/export/users" fields={USER_IMPORT_FIELDS} kind="users" references={references} title="Users CSV" />

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



