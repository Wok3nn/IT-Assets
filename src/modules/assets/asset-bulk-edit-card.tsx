"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { textFieldClassName } from "@/components/forms/text-field";
import { insetCardClassName } from "@/components/layout/inset-card";
import { Button } from "@/components/ui/button";

type SelectedAsset = {
  id: string;
  assetTag: string;
  displayName: string;
  make: string | null;
  model: string | null;
  categoryLabel: string;
  locationLabel: string;
  scopeLabel: string;
};

type Option = {
  id: string;
  label: string;
};

type AssetBulkEditCardProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  returnTo: string;
  selectedAssets: SelectedAsset[];
  categoryOptions: Option[];
  locationOptions: Option[];
  scopeOptions: Option[];
};

const compactPanelClassName = "rounded-[22px] border border-[#d7dde4] bg-white/92 p-3 dark:border-[#556068] dark:bg-[#2f3437]";
const compactFieldCardClassName = "rounded-[20px] border border-[#dfe5ec] bg-[#fbfcfd] p-3 dark:border-[#4b5255] dark:bg-[#34393c]";
const compactListCellClassName = "px-3 py-2 text-xs text-slate-600 dark:text-slate-300";

function BulkFieldToggle({
  checked,
  description,
  name,
  title,
  onChange,
  children,
}: {
  checked: boolean;
  description: string;
  name: string;
  title: string;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={compactFieldCardClassName}>
      <label className="flex items-start gap-3">
        <input
          checked={checked}
          className="ui-check mt-1"
          name={name}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
          value="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
        </span>
      </label>
      {checked ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function AssetBulkEditCard({
  action,
  cancelHref,
  returnTo,
  selectedAssets,
  categoryOptions,
  locationOptions,
  scopeOptions,
}: AssetBulkEditCardProps) {
  const [applyMake, setApplyMake] = useState(false);
  const [make, setMake] = useState("");
  const [applyModel, setApplyModel] = useState(false);
  const [model, setModel] = useState("");
  const [applyCategory, setApplyCategory] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [applyLocation, setApplyLocation] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [applyScope, setApplyScope] = useState(false);
  const [scopeId, setScopeId] = useState("");

  const selectedCategoryLabel = categoryOptions.find((option) => option.id === categoryId)?.label ?? "";
  const selectedLocationLabel = locationOptions.find((option) => option.id === locationId)?.label ?? "";
  const selectedScopeLabel = scopeOptions.find((option) => option.id === scopeId)?.label ?? "";

  const summaryLines = useMemo(() => {
    const lines: string[] = [];

    if (applyMake && make.trim()) {
      lines.push(`Make -> ${make.trim()}`);
    }

    if (applyModel && model.trim()) {
      lines.push(`Model -> ${model.trim()}`);
    }

    if (applyCategory && selectedCategoryLabel) {
      lines.push(`Category -> ${selectedCategoryLabel}`);
    }

    if (applyLocation && selectedLocationLabel) {
      lines.push(`Location -> ${selectedLocationLabel}`);
    }

    if (applyScope && selectedScopeLabel) {
      lines.push(`Department -> ${selectedScopeLabel}`);
    }

    return lines;
  }, [applyCategory, applyLocation, applyMake, applyModel, applyScope, make, model, selectedCategoryLabel, selectedLocationLabel, selectedScopeLabel]);

  const canSubmit = summaryLines.length > 0;

  return (
    <form action={action} className="space-y-4">
      {selectedAssets.map((asset) => (
        <input key={asset.id} name="assetIds" type="hidden" value={asset.id} />
      ))}
      <input name="returnTo" type="hidden" value={returnTo} />

      <div className="grid gap-3 xl:grid-cols-2 xl:items-stretch">
        <div className={compactPanelClassName + " flex min-h-[320px] flex-col"}>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Selected assets</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Compact list of the assets that will receive the selected updates.
          </p>
          <div className="mt-3 flex-1 overflow-hidden rounded-[18px] border border-[#d7dde4] dark:border-[#556068]">
            <div className="h-full max-h-[320px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-700">
                <thead className="bg-[#f8f9fb] dark:bg-[#34393c]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Asset</th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Current fields</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white/95 dark:divide-slate-800 dark:bg-[#2f3437]">
                  {selectedAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td className={compactListCellClassName}>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-[#b56613] dark:text-[#ffd7ab]">{asset.assetTag}</p>
                          <p className="text-slate-900 dark:text-slate-100">{asset.displayName}</p>
                        </div>
                      </td>
                      <td className={compactListCellClassName}>
                        <div className="space-y-0.5">
                          <p>Make / Model: {[asset.make?.trim(), asset.model?.trim()].filter(Boolean).join(" / ") || "Not set"}</p>
                          <p>Category: {asset.categoryLabel}</p>
                          <p>Location: {asset.locationLabel}</p>
                          <p>Department: {asset.scopeLabel}</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={compactPanelClassName + " flex min-h-[320px] flex-col"}>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Changes to apply</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Only enabled fields below will be written to all {selectedAssets.length} selected asset{selectedAssets.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="mt-3 flex-1 space-y-2">
            {summaryLines.length === 0 ? (
              <div className={insetCardClassName}>No bulk changes selected yet.</div>
            ) : (
              summaryLines.map((line) => (
                <div key={line} className={insetCardClassName}>{line}</div>
              ))
            )}
          </div>
          <div className="mt-3 rounded-[18px] border border-dashed border-[#d7dde4] bg-[#fbfcfd] px-3 py-2 text-xs text-slate-500 dark:border-[#556068] dark:bg-[#34393c] dark:text-slate-300">
            Apply bulk changes writes the listed updates and returns to the asset list.
          </div>
        </div>
      </div>

      <div className={compactPanelClassName}>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Bulk update fields</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enable only the fields you want to change. Inputs stay hidden until their matching update is turned on.
          </p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <BulkFieldToggle
            checked={applyMake}
            description="Apply one manufacturer value."
            name="applyMake"
            onChange={setApplyMake}
            title="Update Make"
          >
            <input
              className={textFieldClassName}
              maxLength={240}
              name="make"
              onChange={(event) => setMake(event.target.value)}
              placeholder="Dell"
              type="text"
              value={make}
            />
          </BulkFieldToggle>

          <BulkFieldToggle
            checked={applyModel}
            description="Apply one model value."
            name="applyModel"
            onChange={setApplyModel}
            title="Update Model"
          >
            <input
              className={textFieldClassName}
              maxLength={240}
              name="model"
              onChange={(event) => setModel(event.target.value)}
              placeholder="Latitude 5420"
              type="text"
              value={model}
            />
          </BulkFieldToggle>

          <BulkFieldToggle
            checked={applyCategory}
            description="Choose one category path."
            name="applyCategory"
            onChange={setApplyCategory}
            title="Update Category"
          >
            <select
              className={textFieldClassName}
              name="categoryId"
              onChange={(event) => setCategoryId(event.target.value)}
              value={categoryId}
            >
              <option value="">Select category</option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </BulkFieldToggle>

          <BulkFieldToggle
            checked={applyLocation}
            description="Choose one location."
            name="applyLocation"
            onChange={setApplyLocation}
            title="Update Location"
          >
            <select
              className={textFieldClassName}
              name="assignedLocationId"
              onChange={(event) => setLocationId(event.target.value)}
              value={locationId}
            >
              <option value="">Select location</option>
              {locationOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </BulkFieldToggle>

          <BulkFieldToggle
            checked={applyScope}
            description="Apply one department."
            name="applyScope"
            onChange={setApplyScope}
            title="Update Department"
          >
            <select
              className={textFieldClassName}
              name="scopeId"
              onChange={(event) => setScopeId(event.target.value)}
              value={scopeId}
            >
              <option value="">Select department</option>
              {scopeOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </BulkFieldToggle>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={cancelHref}>
          <Button type="button" variant="ghost">Cancel</Button>
        </Link>
        <Button disabled={!canSubmit} type="submit">Apply bulk changes</Button>
      </div>
    </form>
  );
}
