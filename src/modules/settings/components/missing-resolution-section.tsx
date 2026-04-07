import { fieldClass } from "@/modules/settings/components/import-export.styles";
import type {
  MissingResolutionGroup,
  ResolutionSelection,
  ResolutionSelections,
  ResolutionSummary,
} from "@/modules/settings/components/import-export.types";
import { type ImportResolutionAction } from "@/modules/settings/import-export.shared";

type MissingResolutionSectionProps = {
  groups: MissingResolutionGroup[];
  summary: ResolutionSummary;
  selections: ResolutionSelections;
  onSelectAllCategoryCreates: (values: string[]) => void;
  onUpdateSelection: (groupKey: string, sourceValue: string, next: Partial<ResolutionSelection>) => void;
};

const resolutionActionLabels: Record<ImportResolutionAction, string> = {
  create: "Create new",
  map: "Map to existing",
  skip: "Skip",
};

const compactFieldClass = `${fieldClass} min-h-10 px-3 py-2 text-sm`;
const categoryGridClass = "grid gap-3 px-4 py-2.5 md:grid-cols-[minmax(0,1.15fr)_minmax(360px,1.65fr)_minmax(0,0.95fr)] md:items-center";
const defaultGridClass = "grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.25fr)_180px_minmax(0,1.25fr)_minmax(0,1fr)] md:items-center md:gap-3";

function getSelectionKey(groupKey: string, sourceValue: string) {
  return groupKey + ":" + sourceValue.trim().toLowerCase();
}

function getSelection(selections: ResolutionSelections, groupKey: string, sourceValue: string) {
  return selections[getSelectionKey(groupKey, sourceValue)] ?? { action: "", targetValue: "" };
}

function isCategoryGroup(groupKey: string) {
  return groupKey === "categories";
}

function getHelperText(selection: ResolutionSelection, canMap: boolean, categoryRow: boolean) {
  if (selection.action === "create") {
    return categoryRow
      ? "Creates this missing path node in the resolved hierarchy before import."
      : "Creates this value before the matching rows import.";
  }

  if (selection.action === "skip") {
    return "Imports matching rows with this field left blank.";
  }

  if (selection.action === "map") {
    return selection.targetValue
      ? "Uses the selected existing value during import."
      : "Choose the existing value this import should use.";
  }

  return canMap
    ? "Select how this imported value should be handled."
    : "Only create or skip are available because there are no existing values to map to.";
}

export function MissingResolutionSection({
  groups,
  summary,
  selections,
  onSelectAllCategoryCreates,
  onUpdateSelection,
}: MissingResolutionSectionProps) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-amber-950 dark:text-amber-100">Resolve missing values</h3>
          <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200">
            Review imported values that do not match the current app setup before the import is committed.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-[#34393c] dark:text-amber-200">
          {summary.createCount} create, {summary.mapCount} map, {summary.skipCount} skip, {summary.unresolvedCount} unresolved
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((group) => {
          const categoryGroup = isCategoryGroup(group.key);

          return (
            <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white/90 dark:border-amber-900/50 dark:bg-[#34393c]" key={group.key}>
              <div className="flex flex-col gap-2 border-b border-slate-200/80 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-[#4b5255]">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{group.label}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Resolve each imported value with a compact action row before continuing.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {categoryGroup ? (
                    <button
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
                      onClick={() => onSelectAllCategoryCreates(group.values)}
                      type="button"
                    >
                      Select all create
                    </button>
                  ) : null}
                  <div className="rounded-full border border-slate-200 bg-slate-100/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-300">
                    {group.values.length} unresolved
                  </div>
                </div>
              </div>

              {categoryGroup ? (
                <div className="hidden border-b border-slate-200/80 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(360px,1.65fr)_minmax(0,0.95fr)] md:gap-3 dark:border-[#4b5255] dark:bg-[#2f3437]/70 dark:text-slate-400">
                  <span>Imported value</span>
                  <span>Actions</span>
                  <span>Notes</span>
                </div>
              ) : (
                <div className="hidden border-b border-slate-200/80 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid md:grid-cols-[minmax(0,1.25fr)_180px_minmax(0,1.25fr)_minmax(0,1fr)] md:gap-3 dark:border-[#4b5255] dark:bg-[#2f3437]/70 dark:text-slate-400">
                  <span>Imported value</span>
                  <span>Action</span>
                  <span>Map to</span>
                  <span>Notes</span>
                </div>
              )}

              <div className="divide-y divide-slate-200/80 dark:divide-[#4b5255]">
                {group.values.map((value) => {
                  const selection = getSelection(selections, group.key, value);
                  const canMap = group.options.length > 0;
                  const singularLabel = group.label.endsWith("s") ? group.label.slice(0, -1).toLowerCase() : group.label.toLowerCase();
                  const helperText = getHelperText(selection, canMap, categoryGroup);

                  if (categoryGroup) {
                    return (
                      <div className={categoryGridClass} key={group.key + ":" + value}>
                        <div className="min-w-0">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden dark:text-slate-400">Imported value</p>
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100" title={value}>{value}</p>
                        </div>

                        <div className="min-w-0">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden dark:text-slate-400">Actions</p>
                          <div className="flex min-h-10 flex-wrap items-center gap-2 md:flex-nowrap">
                            {group.allowCreate ? (
                              <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm font-medium text-slate-700 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-200">
                                <input
                                  checked={selection.action === "create"}
                                  className="ui-check"
                                  onChange={(event) =>
                                    onUpdateSelection(group.key, value, {
                                      action: event.target.checked ? "create" : "",
                                      targetValue: "",
                                    })
                                  }
                                  type="checkbox"
                                />
                                <span>Create new</span>
                              </label>
                            ) : null}

                            {group.allowSkip ? (
                              <button
                                className={selection.action === "skip"
                                  ? "shrink-0 rounded-full border border-slate-300 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white dark:border-slate-500 dark:bg-slate-100 dark:text-slate-900"
                                  : "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300 dark:hover:border-slate-400"}
                                onClick={() =>
                                  onUpdateSelection(group.key, value, {
                                    action: selection.action === "skip" ? "" : "skip",
                                    targetValue: "",
                                  })
                                }
                                type="button"
                              >
                                Skip
                              </button>
                            ) : null}

                            <label className="min-w-0 flex-1">
                              <span className="sr-only">Map to existing {singularLabel}</span>
                              <select
                                className={`${compactFieldClass} min-w-[220px]`}
                                onChange={(event) =>
                                  onUpdateSelection(group.key, value, {
                                    action: event.target.value ? "map" : selection.action === "map" ? "" : selection.action,
                                    targetValue: event.target.value,
                                  })
                                }
                                value={selection.action === "map" ? selection.targetValue : ""}
                              >
                                <option value="">Map to existing {singularLabel}</option>
                                {group.options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden dark:text-slate-400">Notes</p>
                          <p className="text-xs leading-4.5 text-slate-500 dark:text-slate-400">{helperText}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className={defaultGridClass} key={group.key + ":" + value}>
                      <div className="min-w-0">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden dark:text-slate-400">Imported value</p>
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100" title={value}>{value}</p>
                      </div>

                      <label className="block min-w-0">
                        <span className="sr-only">Action</span>
                        <span aria-hidden="true" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden dark:text-slate-400">Action</span>
                        <select
                          className={compactFieldClass}
                          onChange={(event) =>
                            onUpdateSelection(group.key, value, {
                              action: event.target.value as ImportResolutionAction,
                              targetValue: event.target.value === "map" ? selection.targetValue : "",
                            })
                          }
                          value={selection.action}
                        >
                          <option value="">Choose action</option>
                          {group.allowCreate ? <option value="create">{resolutionActionLabels.create}</option> : null}
                          {canMap ? <option value="map">{resolutionActionLabels.map}</option> : null}
                          {group.allowSkip ? <option value="skip">{resolutionActionLabels.skip}</option> : null}
                        </select>
                      </label>

                      <label className="block min-w-0">
                        <span className="sr-only">Map to</span>
                        <span aria-hidden="true" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden dark:text-slate-400">Map to</span>
                        {selection.action === "map" ? (
                          <select
                            className={compactFieldClass}
                            onChange={(event) =>
                              onUpdateSelection(group.key, value, {
                                action: event.target.value ? "map" : "",
                                targetValue: event.target.value,
                              })
                            }
                            value={selection.targetValue}
                          >
                            <option value="">Choose existing {singularLabel}</option>
                            {group.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex min-h-10 items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-400 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-500">
                            {selection.action ? "Not needed" : "Choose an action first"}
                          </div>
                        )}
                      </label>

                      <div className="min-w-0">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden dark:text-slate-400">Notes</p>
                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{helperText}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
