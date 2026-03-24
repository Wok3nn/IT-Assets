import { Button } from "@/components/ui/button";
import { fieldClass, mappingRowClass } from "./import-export.styles";
import type { ParsedImportState } from "./import-export.types";
import { IGNORE_FIELD_ID, type ImportColumnMapping, type ImportFieldDefinition } from "@/modules/settings/import-export.shared";

type MappingSectionProps = {
  state: ParsedImportState;
  requiredMappingRows: Array<{ field: ImportFieldDefinition; columnIndex: number }>;
  visibleOptionalRows: Array<{ columnIndex: number; column: ImportColumnMapping; mappedField: ImportFieldDefinition | null }>;
  addableHeaderOptions: Array<{ index: number; label: string }>;
  showAddMapping: boolean;
  selectedHeaderToAdd: string;
  onSelectedHeaderToAddChange: (value: string) => void;
  onToggleAddMapping: () => void;
  onAddOptionalMapping: () => void;
  onCancelAddMapping: () => void;
  onUpdateRequiredHeader: (fieldId: string, nextColumnIndexValue: string) => void;
  onUpdateOptionalField: (columnIndex: number, nextFieldId: string) => void;
  onRemoveOptionalMapping: (columnIndex: number) => void;
  getOptionalFieldOptions: (columnIndex: number) => ImportFieldDefinition[];
  formatHeaderLabel: (index: number) => string;
};

export function MappingSection({
  state,
  requiredMappingRows,
  visibleOptionalRows,
  addableHeaderOptions,
  showAddMapping,
  selectedHeaderToAdd,
  onSelectedHeaderToAddChange,
  onToggleAddMapping,
  onAddOptionalMapping,
  onCancelAddMapping,
  onUpdateRequiredHeader,
  onUpdateOptionalField,
  onRemoveOptionalMapping,
  getOptionalFieldOptions,
  formatHeaderLabel,
}: MappingSectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Required mappings</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Locked fields stay visible and must be connected to a CSV header.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-2">
          {requiredMappingRows.map(({ field, columnIndex }) => {
            const availableHeaderIndexes = state.columns
              .map((column, index) => ({ column, index }))
              .filter(({ index, column }) => index === columnIndex || (column.fieldId === null && !state.visibleOptionalColumnIndexes.includes(index)));

            return (
              <div key={field.id} className={mappingRowClass}>
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">CSV field</span>
                  <select className={fieldClass} onChange={(event) => onUpdateRequiredHeader(field.id, event.target.value)} value={columnIndex >= 0 ? String(columnIndex) : ""}>
                    <option value="" disabled>Select CSV header</option>
                    {availableHeaderIndexes.map(({ index }) => <option key={`${state.columns[index]?.header}-${index}`} value={index}>{formatHeaderLabel(index)}</option>)}
                  </select>
                </label>
                <div className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">App field</span>
                  <div className={`${fieldClass} flex items-center justify-between gap-3 bg-[#fff7ee] text-slate-900 dark:bg-[#3b342b] dark:text-slate-100`}>
                    <span className="font-medium">{field.label}</span>
                    <span className="rounded-full bg-[rgba(246,150,41,0.14)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">Locked</span>
                  </div>
                </div>
                <div className="hidden lg:block" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Additional mappings</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add only the CSV fields you want to import beyond the required set.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end">
            <Button onClick={onToggleAddMapping} type="button" variant="secondary">+ Add Field Mapping</Button>
          </div>
        </div>

        {showAddMapping ? (
          <div className="grid gap-3 rounded-2xl border border-dashed border-[#f2c28c] bg-[rgba(246,150,41,0.08)] p-3 dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.12)] xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-end">
            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Choose CSV header</span>
              <select className={fieldClass} onChange={(event) => onSelectedHeaderToAddChange(event.target.value)} value={selectedHeaderToAdd}>
                <option value="">Select CSV header</option>
                {addableHeaderOptions.map((option) => <option key={`add-${option.index}`} value={String(option.index)}>{option.label}</option>)}
              </select>
            </label>
            <Button disabled={!selectedHeaderToAdd} onClick={onAddOptionalMapping} type="button">Add mapping</Button>
            <Button onClick={onCancelAddMapping} type="button" variant="ghost">Cancel</Button>
          </div>
        ) : null}

        {visibleOptionalRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-[#4b5255] dark:text-slate-400">
            No additional mappings yet. Click `Add Field Mapping` to begin.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-2">
            {visibleOptionalRows.map(({ columnIndex, column, mappedField }) => (
              <div key={`${column.header}-${columnIndex}`} className={mappingRowClass}>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatHeaderLabel(columnIndex)}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">CSV field</p>
                </div>
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Map to app field</span>
                  <select className={fieldClass} onChange={(event) => onUpdateOptionalField(columnIndex, event.target.value)} value={column.fieldId ?? IGNORE_FIELD_ID}>
                    <option value={IGNORE_FIELD_ID}>Select app field</option>
                    {getOptionalFieldOptions(columnIndex).map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
                  </select>
                  {mappedField ? <p className="text-xs text-slate-500 dark:text-slate-400">{mappedField.label} selected</p> : <p className="text-xs text-slate-500 dark:text-slate-400">Choose the app field this CSV column should populate.</p>}
                </label>
                <div className="flex items-end lg:justify-end">
                  <Button onClick={() => onRemoveOptionalMapping(columnIndex)} type="button" variant="ghost">Remove</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

