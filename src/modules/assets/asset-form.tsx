"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { textFieldClassName } from "@/components/forms/text-field";
import { insetCardClassName } from "@/components/layout/inset-card";
import { Button } from "@/components/ui/button";

type CategoryOption = {
  id: string;
  name: string;
  parentId: string | null;
};

type ScopeOption = {
  id: string;
  name: string;
  slug: string;
};

type StatusOption = {
  id: string;
  name: string;
};

type UserOption = {
  id: string;
  name: string;
};

type LocationOption = {
  id: string;
  name: string;
  parentId: string | null;
};

type AssetFormValue = {
  id?: string;
  name?: string | null;
  make?: string | null;
  model?: string | null;
  assetTag?: string;
  serialNumber?: string | null;
  notes?: string | null;
  purchaseDate?: string;
  warrantyExpiry?: string;
  categoryId?: string | null;
  statusId?: string | null;
  assignedUserId?: string | null;
  assignedLocationId?: string | null;
  scopeIds?: string[];
};

type AssetFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  categories: CategoryOption[];
  scopes: ScopeOption[];
  statuses: StatusOption[];
  users: UserOption[];
  locations: LocationOption[];
  hiddenFields: ReactNode;
  submitLabel: string;
  defaultAssetTag?: string;
  initialValue?: AssetFormValue;
};

const MAX_CATEGORY_LEVELS = 5;
const scopeOptionClassName = "flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-[#f0c48d] dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-200 dark:hover:border-[#f0a853]";

function buildLineage(categories: CategoryOption[], categoryId: string | null | undefined) {
  if (!categoryId) {
    return [];
  }

  const byId = new Map(categories.map((category) => [category.id, category]));
  const lineage: CategoryOption[] = [];
  let current = byId.get(categoryId) ?? null;

  while (current) {
    lineage.unshift(current);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }

  return lineage.slice(0, MAX_CATEGORY_LEVELS);
}

function buildLocationLabel(locations: LocationOption[], location: LocationOption) {
  const byId = new Map(locations.map((entry) => [entry.id, entry]));
  const names = [location.name];
  let parent = location.parentId ? byId.get(location.parentId) ?? null : null;

  while (parent) {
    names.unshift(parent.name);
    parent = parent.parentId ? byId.get(parent.parentId) ?? null : null;
  }

  return names.join(" / ");
}

function getLevelLabel(index: number) {
  return index === 0 ? "Category" : `Sub-category ${index}`;
}

export function AssetForm({
  mode,
  action,
  categories,
  scopes,
  statuses,
  users,
  locations,
  hiddenFields,
  submitLabel,
  defaultAssetTag,
  initialValue,
}: AssetFormProps) {
  const initialLineage = useMemo(
    () => buildLineage(categories, initialValue?.categoryId ?? null).map((category) => category.id),
    [categories, initialValue?.categoryId],
  );

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialLineage);

  useEffect(() => {
    setSelectedCategoryIds(initialLineage);
  }, [initialLineage]);

  const selectedLineage = useMemo(
    () => buildLineage(categories, selectedCategoryIds[selectedCategoryIds.length - 1] ?? null),
    [categories, selectedCategoryIds],
  );

  const deepestCategory = selectedLineage.at(-1) ?? null;
  const selectedCategoryPath = selectedLineage.map((category) => category.name).join(" > ");
  const createModeAssetTag = defaultAssetTag ?? "";
  const locationLabels = useMemo(
    () => new Map(locations.map((location) => [location.id, buildLocationLabel(locations, location)])),
    [locations],
  );

  const levelOptions = useMemo(() => {
    const options: CategoryOption[][] = [];
    let parentId: string | null = null;

    for (let index = 0; index < MAX_CATEGORY_LEVELS; index += 1) {
      const matching = categories.filter((category) => category.parentId === parentId);
      if (matching.length === 0) {
        break;
      }

      options.push(matching);
      const nextId = selectedCategoryIds[index];
      if (!nextId) {
        break;
      }

      parentId = nextId;
    }

    return options;
  }, [categories, selectedCategoryIds]);

  return (
    <form action={action} className="mt-5 space-y-4">
      {initialValue?.id ? <input name="assetId" type="hidden" value={initialValue.id} /> : null}
      {hiddenFields}
      <input name="categoryId" type="hidden" value={deepestCategory?.id ?? ""} />

      <div className={insetCardClassName}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Category path</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Select up to five levels. The deepest selected category is saved on the asset.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-[#ece7df] px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:text-slate-300 lg:min-w-[260px]">
            {selectedCategoryPath || "No category selected"}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {levelOptions.map((options, index) => (
            <label key={index} className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{getLevelLabel(index)}</span>
              <select
                className={textFieldClassName}
                value={selectedCategoryIds[index] ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSelectedCategoryIds((current) => {
                    const next = current.slice(0, index);
                    if (nextValue) {
                      next[index] = nextValue;
                    }
                    return next;
                  });
                }}
              >
                <option value="">{index === 0 ? "Select category" : "Select sub-category"}</option>
                {options.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Model</span>
          <input
            className={textFieldClassName}
            defaultValue={initialValue?.model ?? ""}
            name="model"
            placeholder="Latitude 5420"
            type="text"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">Primary device identity for create, edit, and import flows.</p>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Make</span>
          <input
            className={textFieldClassName}
            defaultValue={initialValue?.make ?? ""}
            name="make"
            placeholder="Dell"
            type="text"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">Manufacturer or brand for the selected model.</p>
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Asset name</span>
        <input
          className={textFieldClassName}
          defaultValue={initialValue?.name ?? ""}
          name="name"
          placeholder="Optional friendly name"
          type="text"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">Optional compatibility field for a descriptive or legacy display name.</p>
      </label>

      {mode === "create" ? (
        <label className="block space-y-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Asset tag</span>
            <span className="inline-flex min-h-[1.75rem] items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-[11px] font-semibold leading-none text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
              <span>Configured in General Settings</span>
              <span aria-hidden="true" className="h-2 w-2 opacity-0"></span>
            </span>
          </span>
          <input className={`${textFieldClassName} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-[#4b5255] dark:bg-[#262b2e] dark:text-slate-400`} name="assetTag" readOnly type="text" value={createModeAssetTag} />
        </label>
      ) : (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Asset tag</span>
          <input
            className={textFieldClassName}
            defaultValue={initialValue?.assetTag ?? ""}
            name="assetTag"
            required
            type="text"
          />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Serial number</span>
          <input defaultValue={initialValue?.serialNumber ?? ""} name="serialNumber" className={textFieldClassName} type="text" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Status</span>
          <select defaultValue={initialValue?.statusId ?? ""} name="statusId" className={textFieldClassName}>
            <option value="">No status</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Assigned user</span>
          <select defaultValue={initialValue?.assignedUserId ?? ""} name="assignedUserId" className={textFieldClassName}>
            <option value="">Nobody</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Location</span>
          <select defaultValue={initialValue?.assignedLocationId ?? ""} name="assignedLocationId" className={textFieldClassName}>
            <option value="">No location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabels.get(location.id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Purchase date</span>
          <input defaultValue={initialValue?.purchaseDate ?? ""} name="purchaseDate" className={textFieldClassName} type="date" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Warranty expiry</span>
          <input defaultValue={initialValue?.warrantyExpiry ?? ""} name="warrantyExpiry" className={textFieldClassName} type="date" />
        </label>
      </div>

      <div className={insetCardClassName}>
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Departments</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use department tags for visibility and filtering.</p>
        </div>
        <div className="mt-4 space-y-2">
          {scopes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#ece7df] px-4 py-3 text-sm text-slate-500 dark:border-[#4b5255] dark:text-slate-400">
              No departments exist yet.
            </p>
          ) : (
            scopes.map((scope) => {
              const isChecked = initialValue?.scopeIds?.includes(scope.id) ?? false;

              return (
                <label
                  key={scope.id}
                  className={scopeOptionClassName}
                >
                  <input
                    className="ui-check"
                    defaultChecked={isChecked}
                    name="scopeIds"
                    type="checkbox"
                    value={scope.id}
                  />
                  <span className="flex-1">{scope.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{scope.slug}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Notes</span>
        <textarea defaultValue={initialValue?.notes ?? ""} name="notes" rows={4} className={textFieldClassName} />
      </label>

      <Button className="w-full" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
