import { QrCode, RotateCcw, ScanBarcode } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminSelectField, AdminTextField } from "@/components/admin/admin-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

import {
  clampLabelElementToBounds,
  createDefaultLabelElement,
  createDefaultMachineLabelElement,
  getLabelElementDescription,
  getLabelElementDisplayName,
  getLabelElementKey,
  getLabelTemplateFontWeightLabel,
  getLabelTemplateUnitLabel,
  LABEL_TEMPLATE_FONT_WEIGHTS,
  LABEL_TEMPLATE_MIN_ELEMENT_HEIGHT,
  LABEL_TEMPLATE_MIN_ELEMENT_WIDTH,
  LABEL_TEMPLATE_TEXT_ALIGNMENTS,
  type LabelTemplateElementDefinition,
  type LabelTemplateFieldKey,
  type LabelTemplateUnit,
} from "../label-template.shared";

function formatMeasure(value: number) {
  return Number(value.toFixed(2)).toString();
}

function ElementMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e8e1d7] bg-white/78 px-3 py-2 dark:border-[#4b5255] dark:bg-[#262b2e]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function DecimalInspectorField({
  label,
  min,
  unit,
  value,
  onCommit,
}: {
  label: string;
  min: number;
  unit: string;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    const normalized = draft.trim();

    if (!normalized) {
      setDraft(String(value));
      return;
    }

    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const next = Math.max(parsed, min);
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <FieldLabel>
      <FieldLabelText>{label} ({unit})</FieldLabelText>
      <AdminTextField
        inputMode="decimal"
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
        spellCheck={false}
        type="text"
        value={draft}
      />
    </FieldLabel>
  );
}

function getElementTypeSummary(element: LabelTemplateElementDefinition) {
  if (element.type === "barcode") {
    return "Barcode / Asset tag";
  }

  if (element.type === "qr") {
    return "QR / Asset lookup";
  }

  return `Text / ${element.textAlign}`;
}

function getElementTypeIcon(element: LabelTemplateElementDefinition) {
  if (element.type === "barcode") {
    return <ScanBarcode aria-hidden="true" className="h-4 w-4" />;
  }

  if (element.type === "qr") {
    return <QrCode aria-hidden="true" className="h-4 w-4" />;
  }

  return null;
}

export function LabelTemplateElementControls({
  defaultElement,
  element,
  isSelected,
  onChange,
  onSelect,
  templateHeight,
  templateWidth,
  unit,
}: {
  defaultElement: LabelTemplateElementDefinition;
  element: LabelTemplateElementDefinition;
  isSelected: boolean;
  onChange: (next: LabelTemplateElementDefinition) => void;
  onSelect: () => void;
  templateHeight: number;
  templateWidth: number;
  unit: LabelTemplateUnit;
}) {
  const updateElement = (next: LabelTemplateElementDefinition) => {
    onChange(clampLabelElementToBounds(next, { width: templateWidth, height: templateHeight }));
  };
  const measurementUnit = getLabelTemplateUnitLabel(unit);
  const icon = getElementTypeIcon(element);

  return (
    <PanelCard
      className={isSelected
        ? "border-[#f0c48d] bg-[linear-gradient(180deg,rgba(255,249,240,0.98),rgba(248,249,251,0.96))] shadow-[0_18px_36px_rgba(246,150,41,0.10)] ring-2 ring-[rgba(246,150,41,0.22)] dark:border-[#8b6332] dark:bg-[linear-gradient(180deg,rgba(62,53,44,0.96),rgba(47,52,55,0.96))]"
        : "border-[#ece7df] bg-[#f8f9fb]/92 opacity-88 transition hover:border-[#f0c48d] hover:opacity-100 dark:bg-[#2f3437]/92"}
    >
      <button
        className="w-full rounded-2xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[rgba(246,150,41,0.24)]"
        onClick={onSelect}
        type="button"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {icon ? <span className="text-slate-500 dark:text-slate-300">{icon}</span> : null}
              <h3 className={isSelected
                ? "text-base font-semibold text-slate-950 dark:text-slate-100"
                : "text-base font-medium text-slate-800 dark:text-slate-200"}
              >
                {getLabelElementDisplayName(element)}
              </h3>
              <span className={isSelected
                ? "rounded-full bg-[rgba(246,150,41,0.14)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.22)] dark:text-[#ffd1a0]"
                : "rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-700/80 dark:text-slate-300"}
              >
                {isSelected ? "Inspector" : "Preview element"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{getLabelElementDescription(element)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={isSelected
              ? "text-xs font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:text-[#ffd1a0]"
              : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500"}
            >
              {isSelected ? "Selected in preview" : "Click to inspect"}
            </p>
          </div>
        </div>
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ElementMetric label={`X (${measurementUnit})`} value={formatMeasure(element.x)} />
        <ElementMetric label={`Y (${measurementUnit})`} value={formatMeasure(element.y)} />
        <ElementMetric label={`Size (${measurementUnit})`} value={`${formatMeasure(element.width)} x ${formatMeasure(element.height)}`} />
        <ElementMetric label="Type" value={getElementTypeSummary(element)} />
      </div>

      {isSelected ? (
        <div className="mt-5 border-t border-[#eadfce] pt-5 dark:border-[#5a5047]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Selected element settings</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Changes apply to the preview immediately and stay in the template draft.</p>
            </div>
            <Button
              onClick={(event) => {
                event.stopPropagation();
                updateElement({
                  ...element,
                  x: defaultElement.x,
                  y: defaultElement.y,
                  width: defaultElement.width,
                  height: defaultElement.height,
                });
              }}
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" className="mr-2 h-4 w-4" />
              Reset frame
            </Button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DecimalInspectorField label="X" min={0} onCommit={(next) => updateElement({ ...element, x: next })} unit={measurementUnit} value={element.x} />
            <DecimalInspectorField label="Y" min={0} onCommit={(next) => updateElement({ ...element, y: next })} unit={measurementUnit} value={element.y} />
            <DecimalInspectorField label="Width" min={LABEL_TEMPLATE_MIN_ELEMENT_WIDTH} onCommit={(next) => updateElement({ ...element, width: next })} unit={measurementUnit} value={element.width} />
            <DecimalInspectorField label="Height" min={LABEL_TEMPLATE_MIN_ELEMENT_HEIGHT} onCommit={(next) => updateElement({ ...element, height: next })} unit={measurementUnit} value={element.height} />
          </div>

          {element.type === "text" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FieldLabel>
                <FieldLabelText>Font size</FieldLabelText>
                <AdminTextField min={6} onChange={(event) => updateElement({ ...element, fontSize: Math.max(6, Number(event.target.value) || 12) })} step="1" type="number" value={element.fontSize} />
              </FieldLabel>
              <FieldLabel>
                <FieldLabelText>Font weight</FieldLabelText>
                <AdminSelectField onChange={(event) => updateElement({ ...element, fontWeight: event.target.value as LabelTemplateElementDefinition["fontWeight"] })} value={element.fontWeight}>
                  {LABEL_TEMPLATE_FONT_WEIGHTS.map((weight) => (
                    <option key={weight} value={weight}>{getLabelTemplateFontWeightLabel(weight)}</option>
                  ))}
                </AdminSelectField>
              </FieldLabel>
              <FieldLabel>
                <FieldLabelText>Italic</FieldLabelText>
                <AdminSelectField onChange={(event) => updateElement({ ...element, italic: event.target.value === "true" })} value={element.italic ? "true" : "false"}>
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </AdminSelectField>
              </FieldLabel>
              <FieldLabel>
                <FieldLabelText>Text align</FieldLabelText>
                <AdminSelectField onChange={(event) => updateElement({ ...element, textAlign: event.target.value as LabelTemplateElementDefinition["textAlign"] })} value={element.textAlign}>
                  {LABEL_TEMPLATE_TEXT_ALIGNMENTS.map((alignment) => (
                    <option key={alignment} value={alignment}>{alignment[0].toUpperCase() + alignment.slice(1)}</option>
                  ))}
                </AdminSelectField>
              </FieldLabel>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#e8e1d7] px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:text-slate-300">
              {element.type === "barcode"
                ? "This barcode always encodes the asset tag value for reliable scanner lookup."
                : "This QR code always encodes the asset lookup URL so scans open the read-only asset details page."}
            </div>
          )}
        </div>
      ) : null}
    </PanelCard>
  );
}

export function LabelTemplateElementControlList({
  elements,
  marginBottom,
  marginLeft,
  marginRight,
  marginTop,
  onChange,
  onSelect,
  selectedElementKey,
  templateHeight,
  templateWidth,
  unit,
}: {
  elements: LabelTemplateElementDefinition[];
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  onChange: (elementKey: string, next: LabelTemplateElementDefinition) => void;
  onSelect: (elementKey: string) => void;
  selectedElementKey: string | null;
  templateHeight: number;
  templateWidth: number;
  unit: LabelTemplateUnit;
}) {
  return (
    <div className="space-y-3">
      {elements.map((element, index) => {
        const defaultElement = element.type === "text" && (element.fieldKey === "assetTag" || element.fieldKey === "serialNumber" || element.fieldKey === "assetName")
          ? createDefaultLabelElement({
            fieldKey: element.fieldKey as LabelTemplateFieldKey,
            order: index,
            templateWidth,
            templateHeight,
            marginTop,
            marginRight,
            marginBottom,
            marginLeft,
          })
          : createDefaultMachineLabelElement({
            type: element.type as "barcode" | "qr",
            order: index,
            templateWidth,
            templateHeight,
            marginTop,
            marginRight,
            marginBottom,
            marginLeft,
          });

        return (
          <LabelTemplateElementControls
            key={getLabelElementKey(element)}
            defaultElement={defaultElement}
            element={element}
            isSelected={selectedElementKey === getLabelElementKey(element)}
            onChange={(next) => onChange(getLabelElementKey(element), next)}
            onSelect={() => onSelect(getLabelElementKey(element))}
            templateHeight={templateHeight}
            templateWidth={templateWidth}
            unit={unit}
          />
        );
      })}
    </div>
  );
}
