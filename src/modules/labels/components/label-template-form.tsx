"use client";

import { Check, Info, QrCode, ScanBarcode } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { AdminSelectField, AdminTextField, AdminTextareaField } from "@/components/admin/admin-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

import { LabelTemplateElementControlList } from "./label-template-element-controls";
import { LabelTemplatePreview } from "./label-template-preview";
import {
  clampLabelElementToBounds,
  createDefaultLabelElement,
  createDefaultMachineLabelElement,
  getLabelElementKey,
  LABEL_TEMPLATE_FIELD_OPTIONS,
  LABEL_TEMPLATE_MACHINE_ELEMENT_OPTIONS,
  LABEL_TEMPLATE_ORIENTATIONS,
  LABEL_TEMPLATE_UNITS,
  type LabelTemplateEditorValues,
  type LabelTemplateElementDefinition,
  type LabelTemplateFieldKey,
} from "../label-template.shared";

const SAVED_MESSAGE_TIMEOUT_MS = 2500;

type MachineElementType = "barcode" | "qr";

type LabelTemplateNormalizedState = {
  name: string;
  description: string;
  width: number;
  height: number;
  unit: LabelTemplateEditorValues["unit"];
  orientation: LabelTemplateEditorValues["orientation"];
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  isEnabled: boolean;
  enabledFieldKeys: LabelTemplateFieldKey[];
  extraElementKeys: string[];
  elements: Array<{
    type: LabelTemplateElementDefinition["type"];
    fieldKey: LabelTemplateElementDefinition["fieldKey"];
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: LabelTemplateElementDefinition["fontWeight"];
    italic: boolean;
    textAlign: LabelTemplateElementDefinition["textAlign"];
    isVisible: boolean;
    rotation: number;
    zIndex: number;
  }>;
};

function indexElementsByKey(elements: LabelTemplateElementDefinition[]) {
  return Object.fromEntries(elements.map((element) => [getLabelElementKey(element), element])) as Record<string, LabelTemplateElementDefinition>;
}

function getMachineElementKey(type: MachineElementType) {
  return type === "barcode" ? "barcode:assetTag" : "qr:assetDetailsUrl";
}

function getDefaultRenderedElement(args: {
  elementKey: string;
  order: number;
  templateWidth: number;
  templateHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}) {
  if (args.elementKey === "barcode:assetTag") {
    return createDefaultMachineLabelElement({
      type: "barcode",
      order: args.order,
      templateWidth: args.templateWidth,
      templateHeight: args.templateHeight,
      marginTop: args.marginTop,
      marginRight: args.marginRight,
      marginBottom: args.marginBottom,
      marginLeft: args.marginLeft,
    });
  }

  if (args.elementKey === "qr:assetDetailsUrl") {
    return createDefaultMachineLabelElement({
      type: "qr",
      order: args.order,
      templateWidth: args.templateWidth,
      templateHeight: args.templateHeight,
      marginTop: args.marginTop,
      marginRight: args.marginRight,
      marginBottom: args.marginBottom,
      marginLeft: args.marginLeft,
    });
  }

  const fieldKey = args.elementKey.replace(/^text:/, "") as LabelTemplateFieldKey;

  return createDefaultLabelElement({
    fieldKey,
    order: args.order,
    templateWidth: args.templateWidth,
    templateHeight: args.templateHeight,
    marginTop: args.marginTop,
    marginRight: args.marginRight,
    marginBottom: args.marginBottom,
    marginLeft: args.marginLeft,
  });
}

function buildRenderedElements(input: {
  enabledFieldKeys: LabelTemplateFieldKey[];
  extraElementKeys: string[];
  elementsByKey: Record<string, LabelTemplateElementDefinition>;
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}) {
  const textElements = input.enabledFieldKeys.map((fieldKey, index) => {
    const elementKey = getLabelElementKey({ type: "text", fieldKey });
    const current = input.elementsByKey[elementKey];

    if (current) {
      return { ...current, zIndex: index };
    }

    return getDefaultRenderedElement({
      elementKey,
      order: index,
      templateWidth: input.width,
      templateHeight: input.height,
      marginTop: input.marginTop,
      marginRight: input.marginRight,
      marginBottom: input.marginBottom,
      marginLeft: input.marginLeft,
    });
  });

  const extraElements = input.extraElementKeys.map((elementKey, index) => {
    const current = input.elementsByKey[elementKey];

    if (current) {
      return { ...current, zIndex: textElements.length + index };
    }

    return getDefaultRenderedElement({
      elementKey,
      order: textElements.length + index,
      templateWidth: input.width,
      templateHeight: input.height,
      marginTop: input.marginTop,
      marginRight: input.marginRight,
      marginBottom: input.marginBottom,
      marginLeft: input.marginLeft,
    });
  });

  return [...textElements, ...extraElements].filter((element) => element.isVisible);
}

function normalizeEditorState(input: {
  name: string;
  description: string;
  width: number;
  height: number;
  unit: LabelTemplateEditorValues["unit"];
  orientation: LabelTemplateEditorValues["orientation"];
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  isEnabled: boolean;
  enabledFieldKeys: LabelTemplateFieldKey[];
  extraElementKeys: string[];
  elements: LabelTemplateElementDefinition[];
}): LabelTemplateNormalizedState {
  return {
    name: input.name,
    description: input.description,
    width: input.width,
    height: input.height,
    unit: input.unit,
    orientation: input.orientation,
    marginTop: input.marginTop,
    marginRight: input.marginRight,
    marginBottom: input.marginBottom,
    marginLeft: input.marginLeft,
    isEnabled: input.isEnabled,
    enabledFieldKeys: input.enabledFieldKeys,
    extraElementKeys: input.extraElementKeys,
    elements: input.elements.map((element) => ({
      type: element.type,
      fieldKey: element.fieldKey,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      italic: element.italic,
      textAlign: element.textAlign,
      isVisible: element.isVisible,
      rotation: element.rotation,
      zIndex: element.zIndex,
    })),
  };
}

function InfoTooltip({ message }: { message: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        aria-expanded={isOpen}
        aria-label="QR link information"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#dcc7ac] bg-white/86 text-slate-500 transition hover:border-[#f0a853] hover:text-[#b56613] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(246,150,41,0.28)] dark:border-[#5b4a36] dark:bg-[#2f3437] dark:text-slate-300 dark:hover:border-[#f0a853] dark:hover:text-[#ffd1a0]"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
        type="button"
      >
        <Info aria-hidden="true" className="h-3.5 w-3.5" />
      </button>

      {isOpen ? (
        <div
          className="absolute left-1/2 top-[calc(100%+0.55rem)] z-20 w-64 -translate-x-1/2 rounded-2xl border border-[#4a5257] bg-[#2f3437] px-3 py-2.5 text-xs font-medium leading-5 text-slate-100 shadow-[0_18px_36px_rgba(15,23,42,0.28)]"
          role="tooltip"
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}

function LabelTemplateHeaderActions({
  cancelHref,
  cancelLabel,
  extraActions,
  isDirty,
  isSaved,
  submitLabel,
  submittingLabel,
}: {
  cancelHref: string;
  cancelLabel: string;
  extraActions?: ReactNode;
  isDirty: boolean;
  isSaved: boolean;
  submitLabel: string;
  submittingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap items-start gap-3 lg:flex-nowrap lg:justify-end">
      <div className="flex min-h-10 min-w-[10.5rem] items-center lg:justify-end">
        {isDirty ? <span className="text-sm font-medium text-[#b56613] dark:text-[#ffd1a0]">Unsaved changes</span> : null}
        {!isDirty && isSaved ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <Check aria-hidden="true" className="h-4 w-4" />
            <span>Saved</span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {extraActions}
        <Link href={cancelHref}><Button type="button" variant="ghost">{cancelLabel}</Button></Link>
        <Button
          className={isDirty ? "ring-2 ring-[rgba(246,150,41,0.22)]" : undefined}
          disabled={!isDirty || pending}
          type="submit"
        >
          {pending ? submittingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function LabelTemplateForm({
  action,
  cancelHref,
  cancelLabel,
  description,
  extraHeaderActions,
  initialValues,
  initialSaved = false,
  submitLabel,
  submittingLabel,
  title,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  cancelLabel: string;
  description: string;
  extraHeaderActions?: ReactNode;
  initialValues: LabelTemplateEditorValues;
  initialSaved?: boolean;
  submitLabel: string;
  submittingLabel: string;
  title: string;
}) {
  const initialExtraElementKeys = useMemo(
    () => initialValues.elements.filter((element) => element.type !== "text").map((element) => getLabelElementKey(element)),
    [initialValues.elements],
  );
  const [name, setName] = useState(initialValues.name);
  const [descriptionValue, setDescriptionValue] = useState(initialValues.description);
  const [width, setWidth] = useState(initialValues.width);
  const [height, setHeight] = useState(initialValues.height);
  const [unit, setUnit] = useState(initialValues.unit);
  const [orientation, setOrientation] = useState(initialValues.orientation);
  const [marginTop, setMarginTop] = useState(initialValues.marginTop);
  const [marginRight, setMarginRight] = useState(initialValues.marginRight);
  const [marginBottom, setMarginBottom] = useState(initialValues.marginBottom);
  const [marginLeft, setMarginLeft] = useState(initialValues.marginLeft);
  const [isEnabled, setIsEnabled] = useState(initialValues.isEnabled);
  const [enabledFieldKeys, setEnabledFieldKeys] = useState<LabelTemplateFieldKey[]>(initialValues.enabledFieldKeys);
  const [extraElementKeys, setExtraElementKeys] = useState<string[]>(initialExtraElementKeys);
  const [elementsByKey, setElementsByKey] = useState<Record<string, LabelTemplateElementDefinition>>(
    indexElementsByKey(initialValues.elements),
  );
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSavedTimeout = () => {
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    setIsSaved(initialSaved);
    clearSavedTimeout();

    if (initialSaved) {
      savedTimeoutRef.current = setTimeout(() => {
        setIsSaved(false);
        savedTimeoutRef.current = null;
      }, SAVED_MESSAGE_TIMEOUT_MS);
    }

    return () => {
      clearSavedTimeout();
    };
  }, [initialSaved]);

  const renderedElements = useMemo(
    () => buildRenderedElements({
      enabledFieldKeys,
      extraElementKeys,
      elementsByKey,
      width,
      height,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    }),
    [elementsByKey, enabledFieldKeys, extraElementKeys, height, marginBottom, marginLeft, marginRight, marginTop, width],
  );

  useEffect(() => {
    if (!selectedElementKey) {
      return;
    }

    if (!renderedElements.some((element) => getLabelElementKey(element) === selectedElementKey)) {
      setSelectedElementKey(null);
    }
  }, [renderedElements, selectedElementKey]);

  const clearSavedState = () => {
    if (isSaved) {
      setIsSaved(false);
    }
    clearSavedTimeout();
  };

  const baselineState = useMemo(
    () => JSON.stringify(normalizeEditorState({
      name: initialValues.name,
      description: initialValues.description,
      width: initialValues.width,
      height: initialValues.height,
      unit: initialValues.unit,
      orientation: initialValues.orientation,
      marginTop: initialValues.marginTop,
      marginRight: initialValues.marginRight,
      marginBottom: initialValues.marginBottom,
      marginLeft: initialValues.marginLeft,
      isEnabled: initialValues.isEnabled,
      enabledFieldKeys: initialValues.enabledFieldKeys,
      extraElementKeys: initialExtraElementKeys,
      elements: buildRenderedElements({
        enabledFieldKeys: initialValues.enabledFieldKeys,
        extraElementKeys: initialExtraElementKeys,
        elementsByKey: indexElementsByKey(initialValues.elements),
        width: initialValues.width,
        height: initialValues.height,
        marginTop: initialValues.marginTop,
        marginRight: initialValues.marginRight,
        marginBottom: initialValues.marginBottom,
        marginLeft: initialValues.marginLeft,
      }),
    })),
    [initialExtraElementKeys, initialValues],
  );

  const currentState = useMemo(
    () => JSON.stringify(normalizeEditorState({
      name,
      description: descriptionValue,
      width,
      height,
      unit,
      orientation,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      isEnabled,
      enabledFieldKeys,
      extraElementKeys,
      elements: renderedElements,
    })),
    [descriptionValue, enabledFieldKeys, extraElementKeys, height, isEnabled, marginBottom, marginLeft, marginRight, marginTop, name, orientation, renderedElements, unit, width],
  );

  const isDirty = currentState !== baselineState;

  const toggleField = (fieldKey: LabelTemplateFieldKey) => {
    clearSavedState();
    setEnabledFieldKeys((current) => {
      if (current.includes(fieldKey)) {
        return current.filter((value) => value !== fieldKey);
      }

      const next = [...current, fieldKey];
      const elementKey = getLabelElementKey({ type: "text", fieldKey });
      setSelectedElementKey(elementKey);
      setElementsByKey((existing) => ({
        ...existing,
        [elementKey]: existing[elementKey] ?? createDefaultLabelElement({
          fieldKey,
          order: current.length,
          templateWidth: width,
          templateHeight: height,
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
        }),
      }));
      return next;
    });
  };

  const toggleMachineElement = (type: MachineElementType) => {
    clearSavedState();
    const elementKey = getMachineElementKey(type);

    setExtraElementKeys((current) => {
      if (current.includes(elementKey)) {
        return current.filter((value) => value !== elementKey);
      }

      setSelectedElementKey(elementKey);
      setElementsByKey((existing) => ({
        ...existing,
        [elementKey]: existing[elementKey] ?? createDefaultMachineLabelElement({
          type,
          order: enabledFieldKeys.length + current.length,
          templateWidth: width,
          templateHeight: height,
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
        }),
      }));

      return [...current, elementKey];
    });
  };

  const updateElement = (elementKey: string, next: LabelTemplateElementDefinition) => {
    clearSavedState();
    setElementsByKey((current) => ({
      ...current,
      [elementKey]: clampLabelElementToBounds(next, { width, height }),
    }));
  };

  const resetEnabledElementsToDefaultLayout = () => {
    clearSavedState();
    setElementsByKey((current) => Object.fromEntries(
      renderedElements.map((element, index) => {
        const elementKey = getLabelElementKey(element);
        const defaultElement = getDefaultRenderedElement({
          elementKey,
          order: index,
          templateWidth: width,
          templateHeight: height,
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
        });

        return [
          elementKey,
          current[elementKey]
            ? {
              ...current[elementKey],
              x: defaultElement.x,
              y: defaultElement.y,
              width: defaultElement.width,
              height: defaultElement.height,
              zIndex: index,
            }
            : defaultElement,
        ];
      }),
    ) as Record<string, LabelTemplateElementDefinition>);
  };

  return (
    <form action={action} className="space-y-6">
      <PageHero>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Labels</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{title}</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">{description}</p>
          </div>
          <LabelTemplateHeaderActions
            cancelHref={cancelHref}
            cancelLabel={cancelLabel}
            extraActions={(
              <>
                <Button onClick={resetEnabledElementsToDefaultLayout} type="button" variant="ghost">Reset layout</Button>
                {extraHeaderActions}
              </>
            )}
            isDirty={isDirty}
            isSaved={isSaved}
            submitLabel={submitLabel}
            submittingLabel={submittingLabel}
          />
        </div>
      </PageHero>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)] xl:items-start">
        <div className="space-y-6">
          <PanelCard>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Template setup</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Define the label size, saved metadata, and the text and machine-readable elements that should appear on the template.</p>

            <div className="mt-5 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel className="md:col-span-2">
                  <FieldLabelText>Template name</FieldLabelText>
                  <AdminTextField maxLength={80} minLength={2} name="name" onChange={(event) => {
                    clearSavedState();
                    setName(event.target.value);
                  }} placeholder="2x1 Service Tag" required type="text" value={name} />
                </FieldLabel>

                <FieldLabel className="md:col-span-2">
                  <FieldLabelText>Description</FieldLabelText>
                  <AdminTextareaField maxLength={240} name="description" onChange={(event) => {
                    clearSavedState();
                    setDescriptionValue(event.target.value);
                  }} placeholder="Compact landscape label for laptops and docking stations." rows={4} value={descriptionValue} />
                </FieldLabel>

                <FieldLabel>
                  <FieldLabelText>Width</FieldLabelText>
                  <AdminTextField min={0.1} name="width" onChange={(event) => {
                    clearSavedState();
                    setWidth(Number(event.target.value) || 0.1);
                  }} required step="0.01" type="number" value={width} />
                </FieldLabel>

                <FieldLabel>
                  <FieldLabelText>Height</FieldLabelText>
                  <AdminTextField min={0.1} name="height" onChange={(event) => {
                    clearSavedState();
                    setHeight(Number(event.target.value) || 0.1);
                  }} required step="0.01" type="number" value={height} />
                </FieldLabel>

                <FieldLabel>
                  <FieldLabelText>Unit</FieldLabelText>
                  <AdminSelectField name="unit" onChange={(event) => {
                    clearSavedState();
                    setUnit(event.target.value as LabelTemplateEditorValues["unit"]);
                  }} value={unit}>
                    {LABEL_TEMPLATE_UNITS.map((option) => (
                      <option key={option} value={option}>
                        {option === "millimeters" ? "Millimeters" : option === "centimeters" ? "Centimeters" : "Inches"}
                      </option>
                    ))}
                  </AdminSelectField>
                </FieldLabel>

                <FieldLabel>
                  <FieldLabelText>Orientation</FieldLabelText>
                  <AdminSelectField name="orientation" onChange={(event) => {
                    clearSavedState();
                    setOrientation(event.target.value as LabelTemplateEditorValues["orientation"]);
                  }} value={orientation}>
                    {LABEL_TEMPLATE_ORIENTATIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "landscape" ? "Landscape" : "Portrait"}
                      </option>
                    ))}
                  </AdminSelectField>
                </FieldLabel>
              </div>

              <div className="rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#2f3437]">
                <div className="flex items-start gap-3">
                  <input checked={isEnabled} className="ui-switch mt-1" id="label-template-enabled" name="isEnabled" onChange={(event) => {
                    clearSavedState();
                    setIsEnabled(event.target.checked);
                  }} type="checkbox" value="true" />
                  <div>
                    <label className="block cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="label-template-enabled">Template enabled</label>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep this enabled so future printing flows can offer the template immediately after it is created.</p>
                  </div>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">Default margins</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">These values become the baseline inner padding for future preview and print rendering.</p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FieldLabel>
                    <FieldLabelText>Top</FieldLabelText>
                    <AdminTextField min={0} name="marginTop" onChange={(event) => {
                      clearSavedState();
                      setMarginTop(Number(event.target.value) || 0);
                    }} step="0.01" type="number" value={marginTop} />
                  </FieldLabel>
                  <FieldLabel>
                    <FieldLabelText>Right</FieldLabelText>
                    <AdminTextField min={0} name="marginRight" onChange={(event) => {
                      clearSavedState();
                      setMarginRight(Number(event.target.value) || 0);
                    }} step="0.01" type="number" value={marginRight} />
                  </FieldLabel>
                  <FieldLabel>
                    <FieldLabelText>Bottom</FieldLabelText>
                    <AdminTextField min={0} name="marginBottom" onChange={(event) => {
                      clearSavedState();
                      setMarginBottom(Number(event.target.value) || 0);
                    }} step="0.01" type="number" value={marginBottom} />
                  </FieldLabel>
                  <FieldLabel>
                    <FieldLabelText>Left</FieldLabelText>
                    <AdminTextField min={0} name="marginLeft" onChange={(event) => {
                      clearSavedState();
                      setMarginLeft(Number(event.target.value) || 0);
                    }} step="0.01" type="number" value={marginLeft} />
                  </FieldLabel>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">Initial label fields</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Enable the asset fields that should appear as text elements on the template.</p>
                </div>
                <div className="mt-4 grid gap-3">
                  {LABEL_TEMPLATE_FIELD_OPTIONS.map((field) => {
                    const isChecked = enabledFieldKeys.includes(field.key);

                    return (
                      <label key={field.key} className="flex items-start gap-3 rounded-3xl border border-[#ece7df] bg-[#f8f9fb] px-4 py-3 text-sm text-slate-700 transition hover:border-[#f0c48d] dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-200 dark:hover:border-[#f0a853]">
                        <input checked={isChecked} className="ui-check mt-1" name="enabledFieldKeys" onChange={() => toggleField(field.key)} type="checkbox" value={field.key} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{field.label}</span>
                          <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{field.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div>
                  <div className="flex items-center gap-2"><h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">Machine-readable elements</h3><InfoTooltip message="Internal QR links may only work on devices that can reach and trust your internal app. Personal or external phones may not be able to open those links." /></div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Add scanable barcode and QR elements that use the same drag, resize, preview, and print workflow as text elements.</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {LABEL_TEMPLATE_MACHINE_ELEMENT_OPTIONS.map((option) => {
                    const isAdded = extraElementKeys.includes(getMachineElementKey(option.type));
                    const Icon = option.type === "barcode" ? ScanBarcode : QrCode;

                    return (
                      <div key={option.type} className="rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#2f3437]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                              <Icon aria-hidden="true" className="h-4 w-4" />
                              <h4 className="text-sm font-semibold">{option.label}</h4>
                            </div>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{option.description}</p>
                          </div>
                          <Button onClick={() => toggleMachineElement(option.type)} type="button" variant={isAdded ? "secondary" : "ghost"}>
                            {isAdded ? "Remove" : "Add"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">Element controls</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Edit every enabled element from one inspector workflow. Text, barcode, and QR elements all render through the same preview and print model.</p>
                </div>
                <div className="mt-4 space-y-3">
                  {!selectedElementKey && renderedElements.length > 0 ? (
                    <PanelCard className="border-dashed bg-[#f8f9fb] text-sm text-slate-500 dark:bg-[#2f3437] dark:text-slate-400">
                      Select an element from the preview or the list below to open its inspector.
                    </PanelCard>
                  ) : null}
                  {renderedElements.length === 0 ? (
                    <PanelCard className="border-dashed bg-[#f8f9fb] text-sm text-slate-500 dark:bg-[#2f3437] dark:text-slate-400">
                      Enable at least one field or add a machine-readable element to edit its layout.
                    </PanelCard>
                  ) : (
                    <LabelTemplateElementControlList
                      elements={renderedElements}
                      marginBottom={marginBottom}
                      marginLeft={marginLeft}
                      marginRight={marginRight}
                      marginTop={marginTop}
                      onChange={updateElement}
                      onSelect={setSelectedElementKey}
                      selectedElementKey={selectedElementKey}
                      templateHeight={height}
                      templateWidth={width}
                      unit={unit}
                    />
                  )}
                </div>
              </div>
            </div>
          </PanelCard>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <PanelCard>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Live preview</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Sample asset data, barcode, and QR content render here using the same layout model as print output.</p>

            <div className="mt-5">
              <LabelTemplatePreview
                elements={renderedElements}
                onMoveElement={updateElement}
                onSelectElement={setSelectedElementKey}
                selectedElementKey={selectedElementKey}
                template={{
                  width,
                  height,
                  unit,
                  orientation,
                  marginTop,
                  marginRight,
                  marginBottom,
                  marginLeft,
                }}
              />
            </div>
          </PanelCard>
        </div>
      </div>

      {renderedElements.map((element, index) => (
        <div key={`hidden-${getLabelElementKey(element)}`}>
          <input name="elementFieldKey" type="hidden" value={element.fieldKey} />
          <input name="elementType" type="hidden" value={element.type} />
          <input name="elementX" type="hidden" value={String(element.x)} />
          <input name="elementY" type="hidden" value={String(element.y)} />
          <input name="elementWidth" type="hidden" value={String(element.width)} />
          <input name="elementHeight" type="hidden" value={String(element.height)} />
          <input name="elementFontSize" type="hidden" value={String(element.fontSize)} />
          <input name="elementFontWeight" type="hidden" value={element.fontWeight} />
          <input name="elementItalic" type="hidden" value={element.italic ? "true" : "false"} />
          <input name="elementTextAlign" type="hidden" value={element.textAlign} />
          <input name="elementRotation" type="hidden" value={String(element.rotation)} />
          <input name="elementZIndex" type="hidden" value={String(index)} />
        </div>
      ))}
    </form>
  );
}
