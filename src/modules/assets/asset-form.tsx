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
  name: string;
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
const defaultIncludedLevels = Array.from({ length: MAX_CATEGORY_LEVELS }, (_, index) => index === MAX_CATEGORY_LEVELS - 1);
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
  const initialCategoryName = useMemo(
    () => buildLineage(categories, initialValue?.categoryId ?? null).at(-1)?.name ?? "",
    [categories, initialValue?.categoryId],
  );

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialLineage);
  const [useCategoryName, setUseCategoryName] = useState(
    mode === "create" ? true : Boolean(initialValue?.categoryId && initialValue?.name === initialCategoryName),
  );
  const [customName, setCustomName] = useState(initialValue?.name ?? "");
  const [includedLevels, setIncludedLevels] = useState<boolean[]>(defaultIncludedLevels);

  useEffect(() => {
    setSelectedCategoryIds(initialLineage);
  }, [initialLineage]);

  useEffect(() => {
    setCustomName(initialValue?.name ?? "");
  }, [initialValue?.name]);

  useEffect(() => {
    if (mode === "edit") {
      setUseCategoryName(Boolean(initialValue?.categoryId && initialValue?.name === initialCategoryName));
    }
  }, [initialCategoryName, initialValue?.categoryId, initialValue?.name, mode]);

  const selectedLineage = useMemo(
    () => buildLineage(categories, selectedCategoryIds[selectedCategoryIds.length - 1] ?? null),
    [categories, selectedCategoryIds],
  );

  useEffect(() => {
    setIncludedLevels((current) => {
      const next = Array.from({ length: MAX_CATEGORY_LEVELS }, (_, index) => current[index] ?? false);
      const deepestIndex = selectedLineage.length - 1;

      if (deepestIndex >= 0 && !next.some((value, index) => value && index < selectedLineage.length)) {
        next[deepestIndex] = true;
      }

      for (let index = selectedLineage.length; index < MAX_CATEGORY_LEVELS; index += 1) {
        next[index] = false;
      }

      return next;
    });
  }, [selectedLineage]);

  const deepestCategory = selectedLineage.at(-1) ?? null;
  const generatedName = useMemo(() => {
    const parts = selectedLineage
      .filter((_, index) => includedLevels[index])
      .map((category) => category.name);

    return parts.join(" ").trim();
  }, [includedLevels, selectedLineage]);
  const resolvedName = useCategoryName ? generatedName : customName;
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

  const visibleLevelIndexes = useMemo(
    () => Array.from({ length: selectedLineage.length }, (_, index) => index),
    [selectedLineage.length],
  );

  const isSubmitDisabled = !resolvedName || !deepestCategory || (mode === "create" && !createModeAssetTag);

  return (
    <form action={action} className="mt-5 space-y-4">
      {initialValue?.id ? <input name="assetId" type="hidden" value={initialValue.id} /> : null}
      {hiddenFields}
      <input name="name" type="hidden" value={resolvedName} />
      <input name="categoryId" type="hidden" value={deepestCategory?.id ?? ""} />

      <div className={insetCardClassName}>
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Category path</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Select up to five category levels. The deepest selected category is saved on the asset.
          </p>
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

      <div className={insetCardClassName}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <label className="flex items-start gap-3 xl:flex-1">
            <input
              checked={useCategoryName}
              className="ui-switch mt-0.5"
              onChange={(event) => setUseCategoryName(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Use selected category as asset name
              </span>
              <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                Choose which parts of the selected category path should appear in the generated asset name.
              </span>
            </span>
          </label>

          {useCategoryName && visibleLevelIndexes.length > 0 ? (
            <div className="flex flex-wrap items-center justify-start gap-3 xl:min-h-[44px] xl:justify-end xl:pl-8">
              {visibleLevelIndexes.map((index) => (
                <label
                  key={index}
                  className="inline-flex min-h-[3rem] items-center gap-5 whitespace-nowrap rounded-full border border-[#ece7df] bg-white px-5 py-3 text-sm text-slate-700 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-200"
                >
                  <input
                    checked={includedLevels[index]}
                    className="ui-check"
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setIncludedLevels((current) => {
                        const next = [...current];
                        next[index] = checked;

                        if (!next.some((value, levelIndex) => value && levelIndex < selectedLineage.length)) {
                          const fallbackIndex = Math.max(selectedLineage.length - 1, 0);
                          next[fallbackIndex] = true;
                        }

                        return next;
                      });
                    }}
                    type="checkbox"
                  />
                  <span>{getLevelLabel(index)}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        {useCategoryName ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#ece7df] px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:text-slate-300">
            Asset name preview: {resolvedName || "Select a category path first"}
          </div>
        ) : (
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Custom asset name</span>
            <input
              className={textFieldClassName}
              name="customName"
              onChange={(event) => setCustomName(event.target.value)}
              required={!useCategoryName}
              type="text"
              value={customName}
            />
          </label>
        )}
      </div>

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

      <Button className="w-full" disabled={isSubmitDisabled} type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
