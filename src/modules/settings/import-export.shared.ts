export type ImportKind = "assets" | "users" | "categories" | "scopes" | "locations" | "labels";
export type ImportFormat = "csv" | "xlsx" | "json";

export type ImportColumnMapping = {
  header: string;
  fieldId: string | null;
};

export type CsvParseResult = {
  headers: string[];
  rows: string[][];
};

export type TabularData = {
  headers: string[];
  rows: string[][];
};

export type ImportFieldDefinition = {
  id: string;
  label: string;
  required: boolean;
  aliases: string[];
  description?: string;
};

export type ImportResolutionAction = "create" | "map" | "skip";

export type ImportResolutionEntry = {
  sourceValue: string;
  action: ImportResolutionAction;
  targetValue?: string | null;
};

export type AssetImportResolutions = {
  categories?: ImportResolutionEntry[];
  statuses?: ImportResolutionEntry[];
  scopes?: ImportResolutionEntry[];
};

export type UserImportResolutions = {
  roles?: ImportResolutionEntry[];
  scopes?: ImportResolutionEntry[];
};

export type ImportResolutionPayload = {
  assets?: AssetImportResolutions;
  users?: UserImportResolutions;
};

export type ImportExportReferenceData = {
  assets: {
    categories: Array<{ id: string; label: string; name: string; parentId: string | null }>;
    departments: Array<{ id: string; label: string }>;
    locations: Array<{ id: string; label: string }>;
    statuses: Array<{ id: string; label: string }>;
    users: Array<{ id: string; name: string; email: string }>;
    existingAssetTags: string[];
  };
  users: {
    departments: Array<{ id: string; label: string }>;
    roles: Array<{ key: string; name: string }>;
    existingEmails: string[];
  };
  categories: {
    existingPaths: string[];
  };
  scopes: {
    existingNames: string[];
  };
  locations: {
    existingPaths: string[];
  };
  labels: {
    existingNames: string[];
  };
};

export const IGNORE_FIELD_ID = "__ignore__";
export const IMPORT_FILE_ACCEPT = ".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const EXPORT_FORMATS: ImportFormat[] = ["csv", "xlsx", "json"];

export const ASSET_IMPORT_FIELDS: ImportFieldDefinition[] = [
  { id: "assetTag", label: "Asset Tag", required: true, aliases: ["asset tag", "tag", "asset id"] },
  { id: "name", label: "Asset Name", required: false, aliases: ["asset name", "name", "device name"] },
  { id: "make", label: "Make", required: false, aliases: ["make", "manufacturer", "brand", "vendor"] },
  { id: "model", label: "Model", required: false, aliases: ["model", "device model", "hardware model", "product model"] },
  { id: "status", label: "Status", required: false, aliases: ["status", "asset status"] },
  { id: "assignedUser", label: "Assignee", required: false, aliases: ["assigned to", "assigned user", "assignee", "user", "email", "user email", "assigned user email"] },
  { id: "location", label: "Location", required: false, aliases: ["location", "assigned location", "site", "office"] },
  { id: "category", label: "Category", required: false, aliases: ["category", "asset category", "category path"] },
  { id: "scopes", label: "Department", required: false, aliases: ["department", "departments", "group", "groups", "scope", "scopes"] },
  { id: "serialNumber", label: "Serial Number", required: false, aliases: ["serial number", "serial", "serial #", "sn"] },
  { id: "purchaseDate", label: "Purchase Date", required: false, aliases: ["purchase date", "purchased", "date purchased"] },
  { id: "warrantyExpiry", label: "Warranty Expiry", required: false, aliases: ["warranty expiry", "warranty", "warranty end"] },
  { id: "notes", label: "Notes", required: false, aliases: ["notes", "note", "comments", "comment"] },
];

export const USER_IMPORT_FIELDS: ImportFieldDefinition[] = [
  { id: "name", label: "Display Name", required: true, aliases: ["display name", "name", "full name", "user name"] },
  { id: "email", label: "Email", required: true, aliases: ["email", "email address", "mail"] },
  { id: "role", label: "Role", required: false, aliases: ["role", "user role", "permission"] },
  { id: "scopes", label: "Department", required: false, aliases: ["department", "departments", "group", "groups", "scope", "scopes"] },
  { id: "isActive", label: "Active", required: false, aliases: ["active", "status", "enabled"] },
];

export const CATEGORY_IMPORT_FIELDS: ImportFieldDefinition[] = [
  { id: "level1", label: "Level 1", required: true, aliases: ["level 1", "category level 1", "hierarchy level 1"] },
  { id: "level2", label: "Level 2", required: false, aliases: ["level 2", "category level 2", "hierarchy level 2"] },
  { id: "level3", label: "Level 3", required: false, aliases: ["level 3", "category level 3", "hierarchy level 3"] },
  { id: "level4", label: "Level 4", required: false, aliases: ["level 4", "category level 4", "hierarchy level 4"] },
  { id: "level5", label: "Level 5", required: false, aliases: ["level 5", "category level 5", "hierarchy level 5"] },
  { id: "slug", label: "Category Slug", required: false, aliases: ["category slug", "slug"] },
  { id: "colorHex", label: "Color Hex", required: false, aliases: ["color", "hex", "color hex"] },
  { id: "colorMode", label: "Color Mode", required: false, aliases: ["color mode", "appearance"] },
];

export const SCOPE_IMPORT_FIELDS: ImportFieldDefinition[] = [
  { id: "name", label: "Department Name", required: true, aliases: ["department", "department name", "name", "scope", "scope name"] },
  { id: "description", label: "Description", required: false, aliases: ["description", "details", "notes"] },
  { id: "colorHex", label: "Color Hex", required: false, aliases: ["color", "hex", "color hex"] },
  { id: "colorMode", label: "Color Mode", required: false, aliases: ["color mode", "appearance"] },
];

export const LOCATION_IMPORT_FIELDS: ImportFieldDefinition[] = [
  { id: "path", label: "Location Path", required: true, aliases: ["location path", "path", "location", "full path"] },
  { id: "name", label: "Location Name", required: false, aliases: ["name", "location name"] },
  { id: "parentPath", label: "Parent Location", required: false, aliases: ["parent location", "parent path", "parent"] },
  { id: "description", label: "Description", required: false, aliases: ["description", "details", "notes"] },
  { id: "colorHex", label: "Color Hex", required: false, aliases: ["color", "hex", "color hex"] },
  { id: "colorMode", label: "Color Mode", required: false, aliases: ["color mode", "appearance"] },
];

export function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function suggestFieldId(header: string, fields: ImportFieldDefinition[]) {
  const normalizedHeader = normalizeHeader(header);

  for (const field of fields) {
    if (normalizeHeader(field.label) === normalizedHeader) {
      return field.id;
    }
  }

  for (const field of fields) {
    if (field.aliases.some((alias) => normalizeHeader(alias) === normalizedHeader)) {
      return field.id;
    }
  }

  for (const field of fields) {
    if (field.aliases.some((alias) => normalizedHeader.includes(normalizeHeader(alias)) || normalizeHeader(alias).includes(normalizedHeader))) {
      return field.id;
    }
  }

  return null;
}

export function parseCsv(text: string): CsvParseResult {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  const sanitizedRows = rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  const [headers = [], ...bodyRows] = sanitizedRows;
  return { headers, rows: bodyRows };
}

export function stringifyCsv(headers: string[], rows: string[][]) {
  const escapeCell = (value: string | null | undefined) => {
    const safeValue = value ?? "";
    if (/[",\n\r]/.test(safeValue)) {
      return `"${safeValue.replace(/"/g, '""')}"`;
    }
    return safeValue;
  };

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCell(cell)).join(","))
    .join("\r\n");
}

export function splitMultiValue(value: string) {
  return value
    .split(/[;,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function detectImportFormat(fileName: string): ImportFormat | null {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".csv")) return "csv";
  if (normalized.endsWith(".xlsx")) return "xlsx";
  if (normalized.endsWith(".json")) return "json";
  return null;
}

export function buildRowsFromObjectRecords(records: Array<Record<string, unknown>>): TabularData {
  const headers = Array.from(
    new Set(
      records.flatMap((record) => Object.keys(record)),
    ),
  );

  const rows = records.map((record) =>
    headers.map((header) => {
      const value = record[header];
      if (value == null) return "";
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      return JSON.stringify(value);
    }),
  );

  return { headers, rows };
}

export function parseJsonRecords(text: string): TabularData {
  const parsed = JSON.parse(text) as unknown;

  const records = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)
      ? (parsed as { records: unknown[] }).records
      : null;

  if (!records) {
    throw new Error("JSON import must be an array of records or an object with a records array.");
  }

  const objectRecords = records.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`JSON record ${index + 1} must be an object.`);
    }

    return record as Record<string, unknown>;
  });

  return buildRowsFromObjectRecords(objectRecords);
}

export function rowsToObjectRecords(headers: string[], rows: string[][]) {
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

export function parseBooleanish(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "yes", "y", "1", "active", "enabled"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "inactive", "disabled"].includes(normalized)) return false;
  return null;
}

export function formatDateForCsv(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function isBlankRow(row: string[]) {
  return row.every((cell) => cell.trim().length === 0);
}
