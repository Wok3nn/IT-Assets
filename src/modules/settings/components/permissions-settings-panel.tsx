"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { AdminSelectField } from "@/components/admin/admin-fields";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
import {
  PERMISSION_CAPABILITY_OPTIONS,
  PERMISSION_NAV_OPTIONS,
  type PermissionCapabilityKey,
  type PermissionNavigationKey,
  type RoleAssetScopeConfig,
  type RolePermissionConfig,
} from "@/lib/permissions";

type RoleOption = {
  id: string;
  key: string;
  name: string;
};

type ScopeOption = {
  id: string;
  label: string;
  helper?: string;
};

type PermissionsSettingsPanelProps = {
  categoryOptions: ScopeOption[];
  departmentOptions: ScopeOption[];
  initialError?: string | null;
  initialSaved: boolean;
  locationOptions: ScopeOption[];
  roles: RoleOption[];
  saveAction: (formData: FormData) => void | Promise<void>;
  selectedConfig: RolePermissionConfig | null;
  selectedRole: RoleOption | null;
};

function SectionActions({
  clearLabel = "Clear all",
  onClear,
  onSelectAll,
  selectLabel = "Select all",
}: {
  clearLabel?: string;
  onClear: () => void;
  onSelectAll: () => void;
  selectLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="inline-flex items-center justify-center rounded-full border border-[#e2c39c] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#b56613] transition hover:bg-[rgba(246,150,41,0.1)] dark:border-[#75552d] dark:text-[#ffd1a0] dark:hover:bg-[rgba(246,150,41,0.16)]"
        onClick={onSelectAll}
        type="button"
      >
        {selectLabel}
      </button>
      <button
        className="inline-flex items-center justify-center rounded-full border border-[#d7dde4] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:bg-slate-100 dark:border-[#556068] dark:text-slate-300 dark:hover:bg-[#3a4043]"
        onClick={onClear}
        type="button"
      >
        {clearLabel}
      </button>
    </div>
  );
}

function PermissionToggle({
  checked,
  description,
  name,
  onCheckedChange,
  title,
}: {
  checked: boolean;
  description: string;
  name: string;
  onCheckedChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <label className="flex h-full items-start gap-3 rounded-[22px] border border-[#ece7df] bg-[#f8f9fb] px-4 py-3 transition hover:border-[#f0c48d] dark:border-[#4b5255] dark:bg-[#2f3437] dark:hover:border-[#f0a853]">
      <input
        checked={checked}
        className="ui-switch mt-0.5 shrink-0"
        name={name}
        onChange={(event) => onCheckedChange(event.target.checked)}
        type="checkbox"
        value="true"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{description}</span>
      </span>
    </label>
  );
}

function ScopeSelectionList({
  controlId,
  countLabel,
  description,
  enabled,
  helperText,
  onClearSelection,
  onEnabledChange,
  onSelectAllSelection,
  onSelectedIdsChange,
  options,
  selectedIds,
  title,
  toggleName,
  valueName,
}: {
  controlId: string;
  countLabel: string;
  description: string;
  enabled: boolean;
  helperText: string;
  onClearSelection: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onSelectAllSelection: () => void;
  onSelectedIdsChange: (ids: string[]) => void;
  options: ScopeOption[];
  selectedIds: string[];
  title: string;
  toggleName: string;
  valueName: string;
}) {
  const selectedCount = selectedIds.length;

  return (
    <div className="rounded-[24px] border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#2f3437]">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          checked={enabled}
          className="ui-switch mt-0.5 shrink-0"
          id={controlId}
          name={toggleName}
          onChange={(event) => onEnabledChange(event.target.checked)}
          type="checkbox"
          value="true"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
          <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{description}</span>
        </span>
      </label>
      {enabled ? (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[rgba(246,150,41,0.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">
                {selectedCount} {countLabel}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{helperText}</span>
            </div>
            <SectionActions onClear={onClearSelection} onSelectAll={onSelectAllSelection} />
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {options.map((option) => {
              const isSelected = selectedIds.includes(option.id);

              return (
                <label
                  key={option.id}
                  className="flex items-start gap-3 rounded-[18px] border border-[#e4e8ee] bg-white/85 px-3 py-2.5 transition hover:border-[#f0c48d] dark:border-[#50585d] dark:bg-[#34393c] dark:hover:border-[#f0a853]"
                >
                  <input
                    checked={isSelected}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#f69629] focus:ring-[#f69629] dark:border-[#66737b] dark:bg-[#2f3437]"
                    name={valueName}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onSelectedIdsChange([...selectedIds, option.id]);
                        return;
                      }

                      onSelectedIdsChange(selectedIds.filter((id) => id !== option.id));
                    }}
                    type="checkbox"
                    value={option.id}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{option.label}</span>
                    {option.helper ? (
                      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{option.helper}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PermissionsSettingsPanel({
  categoryOptions,
  departmentOptions,
  initialError,
  initialSaved,
  locationOptions,
  roles,
  saveAction,
  selectedConfig,
  selectedRole,
}: PermissionsSettingsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [draftRoleKey, setDraftRoleKey] = useState(selectedRole?.key ?? roles[0]?.key ?? "");
  const [config, setConfig] = useState<RolePermissionConfig | null>(selectedConfig);

  useEffect(() => {
    setDraftRoleKey(selectedRole?.key ?? roles[0]?.key ?? "");
  }, [roles, selectedRole?.key]);

  useEffect(() => {
    setConfig(selectedConfig);
  }, [selectedConfig, selectedRole?.key]);

  function updateCapability(key: PermissionCapabilityKey, checked: boolean) {
    setConfig((current) =>
      current
        ? {
            ...current,
            capabilities: {
              ...current.capabilities,
              [key]: checked,
            },
          }
        : current,
    );
  }

  function updateNavigation(key: PermissionNavigationKey, checked: boolean) {
    setConfig((current) =>
      current
        ? {
            ...current,
            navigation: {
              ...current.navigation,
              [key]: checked,
            },
          }
        : current,
    );
  }

  function updateAssetScope(nextAssetScope: RoleAssetScopeConfig) {
    setConfig((current) => (current ? { ...current, assetScope: nextAssetScope } : current));
  }

  function updateAssetScopeRule(
    key: "categories" | "departments" | "locations",
    value: RoleAssetScopeConfig["categories"],
  ) {
    if (!config) {
      return;
    }

    updateAssetScope({
      ...config.assetScope,
      [key]: value,
    });
  }

  function handleRoleLoad(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextRoleKey = draftRoleKey.trim();
    const nextSearch = nextRoleKey ? `?roleKey=${encodeURIComponent(nextRoleKey)}` : "";

    startTransition(() => {
      router.replace(`${pathname}${nextSearch}`, { scroll: false });
    });
  }

  if (!selectedRole || !config) {
    return (
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Permissions</h1>
            </div>
            <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
          </div>
        </PageHero>
      </div>
    );
  }

  const isLimitedScope = config.assetScope.accessMode === "limited";

  return (
    <div className="space-y-6">
      <PageHero>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Permissions</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              Configure capabilities, sidebar visibility, and role-level asset scope without pushing complex permission logic back into the settings hub.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {initialSaved ? (
              <span className="inline-flex rounded-full bg-[rgba(63,178,109,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#2f8f57] dark:bg-[rgba(63,178,109,0.18)] dark:text-[#8be0a8]">
                Saved
              </span>
            ) : null}
            {initialError ? (
              <span className="inline-flex rounded-full bg-[rgba(220,68,55,0.12)] px-3 py-1 text-xs font-semibold text-[#b42318] dark:bg-[rgba(220,68,55,0.18)] dark:text-[#ffb4ad]">
                {initialError}
              </span>
            ) : null}
            <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
          </div>
        </div>
      </PageHero>

      <PanelCard>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">Role selection</p>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Select one role at a time to load its saved capability, navigation, and asset-scope configuration.
            </p>
          </div>
          <form className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto" onSubmit={handleRoleLoad}>
            <label className="min-w-0 flex-1 xl:w-[320px]">
              <span className="sr-only">Selected role</span>
              <AdminSelectField name="roleKey" onChange={(event) => setDraftRoleKey(event.target.value)} value={draftRoleKey}>
                {roles.map((role) => (
                  <option key={role.id} value={role.key}>{role.name}</option>
                ))}
              </AdminSelectField>
            </label>
            <Button disabled={isPending || draftRoleKey === selectedRole.key} type="submit" variant="secondary">
              {isPending ? "Loading role..." : "Load role"}
            </Button>
          </form>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[24px] border border-[#ece7df] bg-[#f8f9fb] px-4 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Selected role</span>
          <span className="rounded-full bg-[rgba(246,150,41,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">
            {selectedRole.name}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">Role key: {selectedRole.key}</span>
        </div>
      </PanelCard>

      <form action={saveAction} className="space-y-4">
        <input name="roleKey" type="hidden" value={selectedRole.key} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <PanelCard>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Permissions section</p>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Capabilities</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Control what the selected role can do across assets, users, admin records, labels, settings, and the permissions workspace itself.
                </p>
              </div>
              <SectionActions
                onClear={() =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          capabilities: Object.fromEntries(
                            PERMISSION_CAPABILITY_OPTIONS.map((option) => [option.key, false]),
                          ) as Record<PermissionCapabilityKey, boolean>,
                        }
                      : current,
                  )
                }
                onSelectAll={() =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          capabilities: Object.fromEntries(
                            PERMISSION_CAPABILITY_OPTIONS.map((option) => [option.key, true]),
                          ) as Record<PermissionCapabilityKey, boolean>,
                        }
                      : current,
                  )
                }
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {PERMISSION_CAPABILITY_OPTIONS.map((option) => (
                <PermissionToggle
                  key={option.key}
                  checked={config.capabilities[option.key]}
                  description={option.description}
                  name={`capability:${option.key}`}
                  onCheckedChange={(checked) => updateCapability(option.key, checked)}
                  title={option.label}
                />
              ))}
            </div>
          </PanelCard>

          <PanelCard>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Permissions section</p>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Navigation visibility</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Control which sidebar destinations remain visible for users with this role. This phase saves UI visibility without enforcing route access.
                </p>
              </div>
              <SectionActions
                onClear={() =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          navigation: Object.fromEntries(
                            PERMISSION_NAV_OPTIONS.map((option) => [option.key, false]),
                          ) as Record<PermissionNavigationKey, boolean>,
                        }
                      : current,
                  )
                }
                onSelectAll={() =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          navigation: Object.fromEntries(
                            PERMISSION_NAV_OPTIONS.map((option) => [option.key, true]),
                          ) as Record<PermissionNavigationKey, boolean>,
                        }
                      : current,
                  )
                }
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {PERMISSION_NAV_OPTIONS.map((option) => (
                <PermissionToggle
                  key={option.key}
                  checked={config.navigation[option.key]}
                  description={`Show ${option.label} in the main app navigation.`}
                  name={`navigation:${option.key}`}
                  onCheckedChange={(checked) => updateNavigation(option.key, checked)}
                  title={option.label}
                />
              ))}
            </div>
          </PanelCard>
        </div>

        <PanelCard>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Permissions section</p>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Asset scope</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Limit visible assets by category branch, department, and location. Matching is permissive: an asset stays visible if it matches any enabled allowed rule.
              </p>
            </div>
            <SectionActions
              clearLabel="Clear rules"
              onClear={() =>
                updateAssetScope({
                  accessMode: "limited",
                  categories: {
                    enabled: false,
                    ids: [],
                  },
                  departments: {
                    enabled: false,
                    ids: [],
                  },
                  locations: {
                    enabled: false,
                    ids: [],
                  },
                })
              }
              onSelectAll={() =>
                updateAssetScope({
                  accessMode: "limited",
                  categories: {
                    enabled: true,
                    ids: categoryOptions.map((option) => option.id),
                  },
                  departments: {
                    enabled: true,
                    ids: departmentOptions.map((option) => option.id),
                  },
                  locations: {
                    enabled: true,
                    ids: locationOptions.map((option) => option.id),
                  },
                })
              }
              selectLabel="Select all rules"
            />
          </div>

          <div className="mt-4 rounded-[24px] border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#2f3437]">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-[rgba(246,150,41,0.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">
                  Scope mode
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">Choose whether this role sees every asset or only allowed scope matches.</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-[#e4e8ee] bg-white/85 px-4 py-3 transition hover:border-[#f0c48d] dark:border-[#50585d] dark:bg-[#34393c] dark:hover:border-[#f0a853]">
                  <input
                    checked={!isLimitedScope}
                    name="assetScope:accessMode"
                    onChange={() =>
                      updateAssetScope({
                        ...config.assetScope,
                        accessMode: "all",
                      })
                    }
                    type="radio"
                    value="all"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">All assets</span>
                    <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">This role can browse the full asset inventory.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-[#e4e8ee] bg-white/85 px-4 py-3 transition hover:border-[#f0c48d] dark:border-[#50585d] dark:bg-[#34393c] dark:hover:border-[#f0a853]">
                  <input
                    checked={isLimitedScope}
                    name="assetScope:accessMode"
                    onChange={() =>
                      updateAssetScope({
                        ...config.assetScope,
                        accessMode: "limited",
                      })
                    }
                    type="radio"
                    value="limited"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">Limited assets</span>
                    <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">Show only assets that match at least one enabled scope rule.</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {isLimitedScope ? (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-[rgba(59,130,246,0.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb] dark:bg-[rgba(59,130,246,0.18)] dark:text-[#93c5fd]">
                  Limited mode saved
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Enable any combination of category, department, and location rules below. Parent categories include descendants automatically.
                </span>
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <ScopeSelectionList
                  controlId="asset-scope-categories"
                  countLabel="categories"
                  description="Limit access by category branch."
                  enabled={config.assetScope.categories.enabled}
                  helperText="Selecting a parent category includes all descendants."
                  onClearSelection={() => updateAssetScopeRule("categories", { ...config.assetScope.categories, ids: [] })}
                  onEnabledChange={(enabled) =>
                    updateAssetScopeRule("categories", {
                      ...config.assetScope.categories,
                      enabled,
                    })
                  }
                  onSelectAllSelection={() =>
                    updateAssetScopeRule("categories", {
                      ...config.assetScope.categories,
                      ids: categoryOptions.map((option) => option.id),
                    })
                  }
                  onSelectedIdsChange={(ids) =>
                    updateAssetScopeRule("categories", {
                      ...config.assetScope.categories,
                      ids: Array.from(new Set(ids)),
                    })
                  }
                  options={categoryOptions}
                  selectedIds={config.assetScope.categories.ids}
                  title="Restrict by category"
                  toggleName="assetScope:categories:enabled"
                  valueName="assetScope:categories:ids"
                />
                <ScopeSelectionList
                  controlId="asset-scope-departments"
                  countLabel="departments"
                  description="Limit access by allowed departments."
                  enabled={config.assetScope.departments.enabled}
                  helperText="Department matches are evaluated with OR logic."
                  onClearSelection={() => updateAssetScopeRule("departments", { ...config.assetScope.departments, ids: [] })}
                  onEnabledChange={(enabled) =>
                    updateAssetScopeRule("departments", {
                      ...config.assetScope.departments,
                      enabled,
                    })
                  }
                  onSelectAllSelection={() =>
                    updateAssetScopeRule("departments", {
                      ...config.assetScope.departments,
                      ids: departmentOptions.map((option) => option.id),
                    })
                  }
                  onSelectedIdsChange={(ids) =>
                    updateAssetScopeRule("departments", {
                      ...config.assetScope.departments,
                      ids: Array.from(new Set(ids)),
                    })
                  }
                  options={departmentOptions}
                  selectedIds={config.assetScope.departments.ids}
                  title="Restrict by department"
                  toggleName="assetScope:departments:enabled"
                  valueName="assetScope:departments:ids"
                />
                <ScopeSelectionList
                  controlId="asset-scope-locations"
                  countLabel="locations"
                  description="Limit access by allowed locations."
                  enabled={config.assetScope.locations.enabled}
                  helperText="Location rules join category and department with OR logic."
                  onClearSelection={() => updateAssetScopeRule("locations", { ...config.assetScope.locations, ids: [] })}
                  onEnabledChange={(enabled) =>
                    updateAssetScopeRule("locations", {
                      ...config.assetScope.locations,
                      enabled,
                    })
                  }
                  onSelectAllSelection={() =>
                    updateAssetScopeRule("locations", {
                      ...config.assetScope.locations,
                      ids: locationOptions.map((option) => option.id),
                    })
                  }
                  onSelectedIdsChange={(ids) =>
                    updateAssetScopeRule("locations", {
                      ...config.assetScope.locations,
                      ids: Array.from(new Set(ids)),
                    })
                  }
                  options={locationOptions}
                  selectedIds={config.assetScope.locations.ids}
                  title="Restrict by location"
                  toggleName="assetScope:locations:enabled"
                  valueName="assetScope:locations:ids"
                />
              </div>
            </div>
          ) : null}
        </PanelCard>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href={`/settings/permissions?roleKey=${encodeURIComponent(selectedRole.key)}`}>
            <Button type="button" variant="ghost">Reset changes</Button>
          </Link>
          <Button type="submit">Save permissions</Button>
        </div>
      </form>
    </div>
  );
}
