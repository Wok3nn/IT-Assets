import { createAsset } from "@/modules/assets/asset.service";
import { createUser } from "@/modules/users/user.service";
import { ensureDefaultAssetStatuses } from "@/modules/settings/settings.service";
import {
  formatDateForCsv,
  isBlankRow,
  parseBooleanish,
  splitMultiValue,
  stringifyCsv,
  type ImportColumnMapping,
  type ImportExportReferenceData,
} from "@/modules/settings/import-export.shared";
import { db } from "@/services/database";

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

export async function getImportExportReferenceData(): Promise<ImportExportReferenceData> {
  await ensureDefaultAssetStatuses();

  const [categories, scopes, locations, statuses, users, roles, assets] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, parentId: true }, orderBy: [{ name: "asc" }] }),
    db.scope.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }] }),
    db.location.findMany({ select: { id: true, name: true, parentId: true }, orderBy: [{ name: "asc" }] }),
    db.assetStatus.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }] }),
    db.user.findMany({ select: { id: true, name: true, email: true }, orderBy: [{ name: "asc" }] }),
    db.role.findMany({ select: { key: true, name: true }, orderBy: [{ name: "asc" }] }),
    db.asset.findMany({ select: { assetTag: true } }),
  ]);

  return {
    assets: {
      categories: categories.map((item) => ({ id: item.id, label: buildTreeLabel(categories, item.id) ?? item.name })),
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
  };
}

export async function exportAssetsCsv() {
  await ensureDefaultAssetStatuses();

  const assets = await db.asset.findMany({
    select: {
      assetTag: true,
      name: true,
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

  return stringifyCsv(headers, rows);
}

export async function exportUsersCsv() {
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

  return stringifyCsv(headers, rows);
}

export async function importAssetsFromRows(input: {
  columns: ImportColumnMapping[];
  rows: string[][];
  actorUserId: string;
}) {
  validateUniqueMappings(input.columns);

  const references = await getImportExportReferenceData();
  const categoryLookup = buildLookupByLabel(references.assets.categories);
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
  const requiredMappings = new Set(["name"]);
  const mappedFieldIds = new Set(input.columns.filter((column) => column.fieldId).map((column) => column.fieldId as string));
  for (const requiredField of requiredMappings) {
    if (!mappedFieldIds.has(requiredField)) {
      throw new Error(`Missing required asset import mapping: ${requiredField}`);
    }
  }

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
    const assetTag = (mapped.get("assetTag") ?? "").trim().toUpperCase();
    const serialNumber = mapped.get("serialNumber") ?? "";
    const notes = mapped.get("notes") ?? "";
    const purchaseDate = normalizeDateInput(mapped.get("purchaseDate") ?? "");
    const warrantyExpiry = normalizeDateInput(mapped.get("warrantyExpiry") ?? "");

    if (!name.trim()) {
      messages.push("Asset Name is required.");
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
    const category = categoryValue ? resolveLookup(categoryValue, categoryLookup) : null;
    if (categoryValue && !category) {
      messages.push(`Category not found: ${categoryValue}`);
    }

    const statusValue = mapped.get("status") ?? "";
    const status = statusValue ? resolveLookup(statusValue, statusLookup) : null;
    if (statusValue && !status) {
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
      const scope = resolveLookup(value, departmentLookup);
      if (!scope) {
        messages.push(`Department not found: ${value}`);
      } else {
        scopeIds.push(scope.id);
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
        assetTag: assetTag || undefined,
        serialNumber,
        notes,
        purchaseDate: purchaseDate ?? undefined,
        warrantyExpiry: warrantyExpiry ?? undefined,
        categoryId: category?.id,
        statusId: status?.id,
        assignedUserId,
        assignedLocationId: location?.id,
        scopeIds,
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
}) {
  validateUniqueMappings(input.columns);

  const references = await getImportExportReferenceData();
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

    const resolvedRole = roleValue ? roleByKey.get(roleValue.toLowerCase()) ?? roleByName.get(roleValue.toLowerCase()) : roleByKey.get("viewer");
    if (roleValue && !resolvedRole) {
      messages.push(`Role not found: ${roleValue}`);
    }

    const scopeValues = splitMultiValue(mapped.get("scopes") ?? "");
    const scopeIds: string[] = [];
    for (const value of scopeValues) {
      const scope = resolveLookup(value, departmentLookup);
      if (!scope) {
        messages.push(`Department not found: ${value}`);
      } else {
        scopeIds.push(scope.id);
      }
    }

    const isActiveParsed = isActiveValue ? parseBooleanish(isActiveValue) : true;
    if (isActiveValue && isActiveParsed === null) {
      messages.push(`Active value is invalid: ${isActiveValue}`);
    }

    if (messages.length > 0) {
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
        scopeIds,
        isActive: Boolean(isActiveParsed),
      });

      existingEmails.add(email);
      seenEmails.add(email);
      summary.rowsImported += 1;
      summary.rowResults.push({ rowNumber, status: "imported", messages: ["Imported successfully."] });
    } catch (error) {
      summary.rowsFailed += 1;
      const message = error instanceof Error ? error.message : "Unexpected import error.";
      summary.rowResults.push({ rowNumber, status: "failed", messages: [message] });
    }
  }

  return summary;
}