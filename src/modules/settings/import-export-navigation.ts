import type { ImportKind } from "@/modules/settings/import-export.shared";

export type ImportExportEntitySlug =
  | "assets"
  | "users"
  | "categories"
  | "departments"
  | "locations"
  | "labels";

export type ImportExportEntityConfig = {
  slug: ImportExportEntitySlug;
  href: string;
  panelKind: ImportKind;
  recommendedOrder: number;
  title: string;
  description: string;
  pageDescription: string;
  recommendedNote: string;
  duplicateNote: string;
  formatNote: string;
};

export const importExportEntityConfigs: ImportExportEntityConfig[] = [
  {
    slug: "categories",
    href: "/settings/import-export/categories",
    panelKind: "categories",
    recommendedOrder: 1,
    title: "Categories",
    description: "Import and export category hierarchy using explicit Level 1-5 spreadsheet columns.",
    pageDescription: "Manage category hierarchy imports and exports with deterministic Level 1-5 spreadsheet columns and duplicate-safe path matching.",
    recommendedNote: "Use CSV/XLSX when admins need to review or edit hierarchy in a spreadsheet. JSON remains available for structured exchange.",
    duplicateNote: "Existing full category paths, repeated full paths, and invalid hierarchy-gap rows are skipped.",
    formatNote: "CSV, XLSX, and JSON are supported. Spreadsheet exports use explicit Level 1 through Level 5 columns.",
  },
  {
    slug: "departments",
    href: "/settings/import-export/departments",
    panelKind: "scopes",
    recommendedOrder: 2,
    title: "Departments",
    description: "Import and export department records without mixing them into the broader import workspace.",
    pageDescription: "Manage department imports and exports with focused duplicate-safe handling and compact spreadsheet workflows.",
    recommendedNote: "Use CSV/XLSX for straightforward department maintenance and bulk cleanup. JSON remains available when you need a structured export file.",
    duplicateNote: "Existing department names and repeated names in the same file are skipped.",
    formatNote: "CSV, XLSX, and JSON are supported.",
  },
  {
    slug: "locations",
    href: "/settings/import-export/locations",
    panelKind: "locations",
    recommendedOrder: 3,
    title: "Locations",
    description: "Import and export nested location structures through a dedicated location workspace.",
    pageDescription: "Manage location imports and exports with nested path validation and duplicate-safe location matching.",
    recommendedNote: "Use CSV/XLSX for spreadsheet editing of nested location data. JSON remains available for structured exchange.",
    duplicateNote: "Existing location paths and repeated paths in the same file are skipped.",
    formatNote: "CSV, XLSX, and JSON are supported.",
  },
  {
    slug: "labels",
    href: "/settings/import-export/labels",
    panelKind: "labels",
    recommendedOrder: 4,
    title: "Labels",
    description: "Import and export full-fidelity label templates through the JSON-first label workflow.",
    pageDescription: "Manage label template imports and exports with the dedicated JSON-first workflow for full template fidelity.",
    recommendedNote: "Use JSON when moving label templates because it preserves dimensions, margins, enabled fields, and element definitions without flattening.",
    duplicateNote: "Existing label templates are skipped by normalized template name during import.",
    formatNote: "Labels use a JSON-first workflow for full-fidelity structured data transfer.",
  },
  {
    slug: "users",
    href: "/settings/import-export/users",
    panelKind: "users",
    recommendedOrder: 5,
    title: "Users",
    description: "Import and export user records with role and department resolution before commit.",
    pageDescription: "Manage user imports and exports with focused mapping, validation, and role or department resolution.",
    recommendedNote: "Use CSV/XLSX for spreadsheet administration and structured onboarding cleanup. JSON remains available for structured handoffs.",
    duplicateNote: "Existing emails, duplicate file rows, and rows with blocking validation issues are skipped.",
    formatNote: "CSV, XLSX, and JSON are supported.",
  },
  {
    slug: "assets",
    href: "/settings/import-export/assets",
    panelKind: "assets",
    recommendedOrder: 6,
    title: "Assets",
    description: "Import and export asset records with mapping, validation, and duplicate-safe skip behavior.",
    pageDescription: "Manage asset imports and exports with mapping, validation, duplicate-safe skipping, and related-value resolution.",
    recommendedNote: "Use CSV/XLSX for spreadsheet cleanup and bulk operational updates. Import users first when you want asset assignment matching to resolve cleanly.",
    duplicateNote: "Existing asset tags, duplicate file rows, and rows with blocking validation issues are skipped.",
    formatNote: "CSV, XLSX, and JSON are supported. CSV/XLSX are usually the best fit for admin editing.",
  },
];

export function getImportExportEntityConfig(slug: string) {
  return importExportEntityConfigs.find((config) => config.slug === slug) ?? null;
}
