import type { ImportColumnMapping } from "@/modules/settings/import-export.shared";

export type ImportSummary = {
  totalRowsRead: number;
  rowsValid: number;
  rowsImported: number;
  rowsSkipped: number;
  rowsFailed: number;
  assetsAssignedToUsers?: number;
  assetsLeftUnassigned?: number;
  warnings: string[];
  rowResults: Array<{ rowNumber: number; status: "imported" | "skipped" | "failed"; messages: string[] }>;
};

export type ParsedImportState = {
  fileName: string;
  rows: string[][];
  columns: ImportColumnMapping[];
  visibleOptionalColumnIndexes: number[];
};

export type ValidationState = {
  globalErrors: string[];
  rowErrors: Array<{ rowNumber: number; messages: string[] }>;
  rowWarnings: Array<{ rowNumber: number; messages: string[] }>;
  validRows: number;
};

export type PreviewHeader = {
  key: string;
  label: string;
};
