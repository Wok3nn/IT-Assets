"use client";

import { useMemo, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { ImportCardShell } from "@/modules/settings/components/import-card-shell";
import { ImportSummaryCard } from "@/modules/settings/components/import-summary-card";
import type { ImportSummary, ParsedImportState, ValidationState } from "@/modules/settings/components/import-export.types";
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
  type ImportColumnMapping,
  type ImportExportReferenceData,
  type ImportFieldDefinition,
  type ImportKind,
} from "@/modules/settings/import-export.shared";

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

function buildAssetValidation(state: ParsedImportState, references: ImportExportReferenceData): ValidationState {
  const globalErrors: string[] = [];
  const rowErrors: Array<{ rowNumber: number; messages: string[] }> = [];
  const rowWarnings: Array<{ rowNumber: number; messages: string[] }> = [];
  const fieldIds = state.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string);
  const duplicates = fieldIds.filter((fieldId, index) => fieldIds.indexOf(fieldId) !== index);

  if (duplicates.length > 0) {
    globalErrors.push("Each app field can only be mapped once.");
  }

  if (!fieldIds.includes("name")) {
    globalErrors.push("Asset Name must be mapped before import can continue.");
  }

  const existingAssetTags = new Set(references.assets.existingAssetTags.map((value) => value.toUpperCase()));
  const seenAssetTags = new Set<string>();
  const categoryLabels = new Set(references.assets.categories.map((item) => normalizeValue(item.label)));
  const locationLabels = new Set(references.assets.locations.map((item) => normalizeValue(item.label)));
  const statusLabels = new Set(references.assets.statuses.map((item) => normalizeValue(item.label)));
  const departmentLabels = new Set(references.assets.departments.map((item) => normalizeValue(item.label)));
  const userEmails = new Set(references.assets.users.map((item) => normalizeValue(item.email)));
  const userNames = new Set(references.assets.users.map((item) => normalizeValue(item.name)));

  let validRows = 0;

  nonBlankRows(state.rows).forEach((row, index) => {
    const rowNumber = index + 2;
    const mapped = getMappedValues(state.columns, row);
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = mapped.get("name") ?? "";
    if (!name.trim()) {
      errors.push("Asset Name is required.");
    }

    const assetTag = (mapped.get("assetTag") ?? "").trim().toUpperCase();
    if (assetTag) {
      if (existingAssetTags.has(assetTag)) {
        errors.push(`Asset Tag already exists: ${assetTag}`);
      }
      if (seenAssetTags.has(assetTag)) {
        errors.push(`Asset Tag is duplicated in this file: ${assetTag}`);
      }
      seenAssetTags.add(assetTag);
    }

    const purchaseDate = normalizeDate(mapped.get("purchaseDate") ?? "");
    if (!purchaseDate.ok) {
      errors.push(`Purchase Date is invalid: ${purchaseDate.value}`);
    }

    const warrantyExpiry = normalizeDate(mapped.get("warrantyExpiry") ?? "");
    if (!warrantyExpiry.ok) {
      errors.push(`Warranty Expiry is invalid: ${warrantyExpiry.value}`);
    }

    const category = normalizeValue(mapped.get("category") ?? "");
    if (category && !categoryLabels.has(category)) {
      errors.push(`Category not found: ${mapped.get("category")}`);
    }

    const location = normalizeValue(mapped.get("location") ?? "");
    if (location && !locationLabels.has(location)) {
      errors.push(`Location not found: ${mapped.get("location")}`);
    }

    const status = normalizeValue(mapped.get("status") ?? "");
    if (status && !statusLabels.has(status)) {
      errors.push(`Status not found: ${mapped.get("status")}`);
    }

    for (const department of splitMultiValue(mapped.get("scopes") ?? "")) {
      if (!departmentLabels.has(normalizeValue(department))) {
        errors.push(`Department not found: ${department}`);
      }
    }

    const assignedUser = (mapped.get("assignedUser") ?? "").trim();
    if (assignedUser) {
      const normalizedAssignedUser = normalizeValue(assignedUser);
      if (!userEmails.has(normalizedAssignedUser) && !userNames.has(normalizedAssignedUser)) {
        warnings.push(`User not found for assignment: ${assignedUser}. Asset will import as unassigned.`);
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

  return { globalErrors, rowErrors, rowWarnings, validRows };
}

function buildUserValidation(state: ParsedImportState, references: ImportExportReferenceData): ValidationState {
  const globalErrors: string[] = [];
  const rowErrors: Array<{ rowNumber: number; messages: string[] }> = [];
  const rowWarnings: Array<{ rowNumber: number; messages: string[] }> = [];
  const fieldIds = state.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string);
  const duplicates = fieldIds.filter((fieldId, index) => fieldIds.indexOf(fieldId) !== index);

  if (duplicates.length > 0) {
    globalErrors.push("Each app field can only be mapped once.");
  }

  if (!fieldIds.includes("name")) {
    globalErrors.push("Display Name must be mapped before import can continue.");
  }

  if (!fieldIds.includes("email")) {
    globalErrors.push("Email must be mapped before import can continue.");
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
      errors.push(`Email is invalid: ${email}`);
    } else {
      if (existingEmails.has(email)) {
        errors.push(`Email already exists: ${email}`);
      }
      if (seenEmails.has(email)) {
        errors.push(`Email is duplicated in this file: ${email}`);
      }
      seenEmails.add(email);
    }

    if (role && !roleNames.has(normalizeValue(role)) && !roleKeys.has(normalizeValue(role))) {
      errors.push(`Role not found: ${role}`);
    }

    for (const department of splitMultiValue(mapped.get("scopes") ?? "")) {
      if (!departmentLabels.has(normalizeValue(department))) {
        errors.push(`Department not found: ${department}`);
      }
    }

    if (isActive && parseBooleanish(isActive) === null) {
      errors.push(`Active value is invalid: ${isActive}`);
    }

    if (errors.length > 0) {
      rowErrors.push({ rowNumber, messages: errors });
    } else {
      validRows += 1;
    }
  });

  return { globalErrors, rowErrors, rowWarnings, validRows };
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

  const requiredFields = useMemo(() => fields.filter((field) => field.required), [fields]);
  const optionalFields = useMemo(() => fields.filter((field) => !field.required), [fields]);

  const validation = useMemo(() => {
    if (!state) return null;
    return kind === "assets" ? buildAssetValidation(state, references) : buildUserValidation(state, references);
  }, [kind, references, state]);

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

  async function handleImport() {
    if (!state || !validation) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setImportSummary(null);

    try {
      const response = await fetch(`/api/settings/import/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: state.columns, rows: nonBlankRows(state.rows) }),
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
              <Button onClick={() => { setState(null); setImportSummary(null); setSubmitError(null); setShowAddMapping(false); setSelectedHeaderToAdd(""); }} type="button" variant="ghost">Choose another file</Button>
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

          {validation ? (
            <ValidationSummary
              actionBar={
                <div className="sticky bottom-4 z-10 rounded-2xl border border-[#ece7df] bg-white/95 p-4 shadow-panel backdrop-blur dark:border-[#4b5255] dark:bg-[#2f3437]/95">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Import only creates new records. Rows with blocking issues are skipped.</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button className="min-w-36" onClick={resetMappings} type="button" variant="secondary">Reset mapping</Button>
                      <Button disabled={isSubmitting || validation.globalErrors.length > 0 || validation.rowErrors.length > 0 || validation.validRows === 0} onClick={handleImport} type="button">{isSubmitting ? "Importing..." : `Confirm import ${validation.validRows} row${validation.validRows === 1 ? "" : "s"}`}</Button>
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
    <div className="space-y-6">
      <ImportCard description="Export assets to CSV or import new assets through a header-mapping workflow with validation, preview, and confirmation." exportHref="/api/settings/export/assets" fields={ASSET_IMPORT_FIELDS} importNote="For best results, import users before importing assets so asset-to-user assignments can be matched automatically." kind="assets" references={references} title="Assets CSV" />
      <ImportCard description="Export users to CSV or import new users with role and department mapping before confirmation." exportHref="/api/settings/export/users" fields={USER_IMPORT_FIELDS} kind="users" references={references} title="Users CSV" />
    </div>
  );
}


