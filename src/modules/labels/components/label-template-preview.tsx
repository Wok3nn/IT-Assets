"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  clampLabelElementToBounds,
  getLabelElementKey,
  getLabelPreviewRenderData,
  getLabelTemplateUnitLabel,
  LABEL_TEMPLATE_NUDGE_LARGE_STEP,
  LABEL_TEMPLATE_NUDGE_STEP,
  LABEL_TEMPLATE_SNAP_STEP,
  type LabelTemplateEditorValues,
  type LabelTemplateElementDefinition,
} from "../label-template.shared";
import {
  getLabelElementFrameStyle,
  getLabelRenderScaleFactor,
  LabelTemplateRenderedValue,
} from "./label-template-rendering";

const PREVIEW_MAX_WIDTH = 440;
const PREVIEW_MAX_HEIGHT = 320;
const RESIZE_HANDLES = [
  { key: "nw", className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
  { key: "ne", className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
  { key: "sw", className: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
  { key: "se", className: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
] as const;

type ResizeHandle = (typeof RESIZE_HANDLES)[number]["key"];

type InteractionState = {
  elementKey: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startElement: LabelTemplateElementDefinition;
  wasSelectedOnPointerDown: boolean;
} & (
  | { mode: "move" }
  | { mode: "resize"; handle: ResizeHandle }
);

function getPreviewScale(width: number, height: number) {
  const safeWidth = Math.max(width, 0.1);
  const safeHeight = Math.max(height, 0.1);
  return Math.min(PREVIEW_MAX_WIDTH / safeWidth, PREVIEW_MAX_HEIGHT / safeHeight);
}

function snapValue(value: number) {
  return Math.round(value / LABEL_TEMPLATE_SNAP_STEP) * LABEL_TEMPLATE_SNAP_STEP;
}

function snapElement(element: LabelTemplateElementDefinition, mode: InteractionState["mode"]) {
  return {
    ...element,
    x: snapValue(element.x),
    y: snapValue(element.y),
    width: mode === "resize" ? snapValue(element.width) : element.width,
    height: mode === "resize" ? snapValue(element.height) : element.height,
  };
}

function getResizedElement({
  deltaX,
  deltaY,
  handle,
  startElement,
}: {
  deltaX: number;
  deltaY: number;
  handle: ResizeHandle;
  startElement: LabelTemplateElementDefinition;
}) {
  if (handle === "se") {
    return {
      ...startElement,
      width: startElement.width + deltaX,
      height: startElement.height + deltaY,
    };
  }

  if (handle === "sw") {
    return {
      ...startElement,
      x: startElement.x + deltaX,
      width: startElement.width - deltaX,
      height: startElement.height + deltaY,
    };
  }

  if (handle === "ne") {
    return {
      ...startElement,
      y: startElement.y + deltaY,
      width: startElement.width + deltaX,
      height: startElement.height - deltaY,
    };
  }

  return {
    ...startElement,
    x: startElement.x + deltaX,
    y: startElement.y + deltaY,
    width: startElement.width - deltaX,
    height: startElement.height - deltaY,
  };
}

export function LabelTemplatePreview({
  template,
  elements,
  selectedElementKey,
  onMoveElement,
  onSelectElement,
}: {
  template: Pick<LabelTemplateEditorValues, "width" | "height" | "unit" | "orientation" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft">;
  elements: LabelTemplateElementDefinition[];
  selectedElementKey: string | null;
  onMoveElement: (elementKey: string, next: LabelTemplateElementDefinition) => void;
  onSelectElement: (elementKey: string | null) => void;
}) {
  const width = Math.max(template.width, 0.1);
  const height = Math.max(template.height, 0.1);
  const scale = getPreviewScale(width, height);
  const previewWidth = width * scale;
  const previewHeight = height * scale;
  const renderScaleFactor = getLabelRenderScaleFactor({
    renderedWidthPx: previewWidth,
    templateWidth: width,
    unit: template.unit,
  });
  const safeAreaLeft = Math.max(template.marginLeft, 0) * scale;
  const safeAreaTop = Math.max(template.marginTop, 0) * scale;
  const safeAreaWidth = Math.max(width - Math.max(template.marginLeft, 0) - Math.max(template.marginRight, 0), 0) * scale;
  const safeAreaHeight = Math.max(height - Math.max(template.marginTop, 0) - Math.max(template.marginBottom, 0), 0) * scale;
  const [interactionState, setInteractionState] = useState<InteractionState | null>(null);
  const interactionStateRef = useRef<InteractionState | null>(null);
  const interactionDidMoveRef = useRef(false);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const previewRenderData = useMemo(() => getLabelPreviewRenderData(), []);
  const elementsByKey = useMemo(
    () => Object.fromEntries(elements.map((element) => [getLabelElementKey(element), element])) as Record<string, LabelTemplateElementDefinition>,
    [elements],
  );

  useEffect(() => {
    interactionStateRef.current = interactionState;
  }, [interactionState]);

  useEffect(() => {
    if (!selectedElementKey) {
      return;
    }

    previewCanvasRef.current?.focus();
  }, [selectedElementKey]);

  useEffect(() => {
    if (!interactionState) {
      return undefined;
    }

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      const activeInteraction = interactionStateRef.current;

      if (!activeInteraction || event.pointerId !== activeInteraction.pointerId) {
        return;
      }

      const current = elementsByKey[activeInteraction.elementKey];

      if (!current) {
        return;
      }

      const deltaClientX = event.clientX - activeInteraction.startClientX;
      const deltaClientY = event.clientY - activeInteraction.startClientY;

      if (Math.abs(deltaClientX) > 3 || Math.abs(deltaClientY) > 3) {
        interactionDidMoveRef.current = true;
      }

      const deltaX = deltaClientX / scale;
      const deltaY = deltaClientY / scale;
      const rawNext = activeInteraction.mode === "move"
        ? {
          ...current,
          x: activeInteraction.startElement.x + deltaX,
          y: activeInteraction.startElement.y + deltaY,
        }
        : getResizedElement({
          deltaX,
          deltaY,
          handle: activeInteraction.handle,
          startElement: activeInteraction.startElement,
        });
      const next = clampLabelElementToBounds(snapElement(rawNext, activeInteraction.mode), { width, height });

      onMoveElement(activeInteraction.elementKey, next);
    };

    const finishInteraction = (event: PointerEvent) => {
      const activeInteraction = interactionStateRef.current;

      if (!activeInteraction || event.pointerId !== activeInteraction.pointerId) {
        return;
      }

      if (!interactionDidMoveRef.current && activeInteraction.wasSelectedOnPointerDown) {
        onSelectElement(null);
      }

      interactionDidMoveRef.current = false;
      setInteractionState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishInteraction);
    window.addEventListener("pointercancel", finishInteraction);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishInteraction);
      window.removeEventListener("pointercancel", finishInteraction);
    };
  }, [elementsByKey, height, interactionState, onMoveElement, onSelectElement, scale, width]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span>{template.width} x {template.height} {getLabelTemplateUnitLabel(template.unit)}</span>
        <span className="rounded-full bg-[rgba(246,150,41,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">{template.orientation}</span>
      </div>

      <div className="rounded-[28px] border border-[#ece7df] bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,249,251,0.94))] p-5 dark:border-[#4b5255] dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.12),_transparent_58%),linear-gradient(180deg,rgba(52,57,60,0.98),rgba(47,52,55,0.96))]">
        <div className="flex min-h-[340px] items-center justify-center rounded-[24px] border border-dashed border-[rgba(246,150,41,0.25)] bg-[linear-gradient(transparent_23px,rgba(148,163,184,0.08)_24px),linear-gradient(90deg,transparent_23px,rgba(148,163,184,0.08)_24px)] bg-[length:24px_24px] p-5 dark:border-[rgba(246,150,41,0.24)] dark:bg-[linear-gradient(transparent_23px,rgba(148,163,184,0.08)_24px),linear-gradient(90deg,transparent_23px,rgba(148,163,184,0.08)_24px)] dark:bg-[length:24px_24px]">
          <div
            ref={previewCanvasRef}
            className="relative overflow-hidden rounded-[16px] border border-[#d7dce2] bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)] outline-none ring-offset-2 ring-offset-white focus-visible:ring-2 focus-visible:ring-[rgba(246,150,41,0.25)] dark:border-[#5b6368] dark:bg-[#1f2326] dark:ring-offset-[#1f2326] dark:shadow-[0_20px_40px_rgba(0,0,0,0.32)] dark:focus-visible:ring-[rgba(246,150,41,0.35)]"
            onKeyDown={(event) => {
              if (!selectedElementKey) {
                return;
              }

              const selectedElement = elementsByKey[selectedElementKey];

              if (!selectedElement) {
                return;
              }

              const largeStep = event.shiftKey ? LABEL_TEMPLATE_NUDGE_LARGE_STEP : LABEL_TEMPLATE_NUDGE_STEP;
              let next: LabelTemplateElementDefinition | null = null;

              if (event.key === "ArrowLeft") {
                next = { ...selectedElement, x: selectedElement.x - largeStep };
              } else if (event.key === "ArrowRight") {
                next = { ...selectedElement, x: selectedElement.x + largeStep };
              } else if (event.key === "ArrowUp") {
                next = { ...selectedElement, y: selectedElement.y - largeStep };
              } else if (event.key === "ArrowDown") {
                next = { ...selectedElement, y: selectedElement.y + largeStep };
              }

              if (!next) {
                return;
              }

              event.preventDefault();
              onMoveElement(selectedElementKey, clampLabelElementToBounds(snapElement(next, "move"), { width, height }));
            }}
            onPointerDown={(event) => {
              previewCanvasRef.current?.focus();
              if (event.target === event.currentTarget) {
                onSelectElement(null);
              }
            }}
            style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
            tabIndex={0}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent_28%)]" />
            {safeAreaWidth > 0 && safeAreaHeight > 0 ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-[12px] border border-dashed border-[rgba(246,150,41,0.34)] dark:border-[rgba(247,179,93,0.3)]"
                style={{
                  left: `${safeAreaLeft}px`,
                  top: `${safeAreaTop}px`,
                  width: `${safeAreaWidth}px`,
                  height: `${safeAreaHeight}px`,
                }}
              />
            ) : null}
            {elements.filter((element) => element.isVisible).map((element) => {
              const elementKey = getLabelElementKey(element);
              const isSelected = selectedElementKey === elementKey;
              const isMoving = interactionState?.mode === "move" && interactionState.elementKey === elementKey;
              const isResizing = interactionState?.mode === "resize" && interactionState.elementKey === elementKey;

              return (
                <div
                  key={elementKey}
                  className="absolute"
                  style={getLabelElementFrameStyle({
                    element,
                    templateHeight: height,
                    templateWidth: width,
                    zIndex: isSelected ? element.zIndex + 10 : element.zIndex,
                  })}
                >
                  <button
                    className={isSelected
                      ? "relative h-full w-full overflow-hidden rounded-[6px] bg-transparent outline-none"
                      : "relative h-full w-full overflow-hidden rounded-[6px] bg-transparent outline-none transition hover:bg-[rgba(246,150,41,0.05)] dark:hover:bg-[rgba(246,150,41,0.08)]"}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      previewCanvasRef.current?.focus();
                      interactionDidMoveRef.current = false;
                      onSelectElement(elementKey);
                      setInteractionState({
                        elementKey,
                        mode: "move",
                        pointerId: event.pointerId,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        startElement: element,
                        wasSelectedOnPointerDown: isSelected,
                      });
                    }}
                    style={{
                      cursor: isMoving ? "grabbing" : "grab",
                      touchAction: "none",
                    }}
                    type="button"
                  >
                    <LabelTemplateRenderedValue element={element} renderData={previewRenderData} renderScaleFactor={renderScaleFactor} />
                  </button>

                  {isSelected ? (
                    <>
                      <div className="pointer-events-none absolute -inset-1 rounded-[10px] border border-dashed border-[rgba(246,150,41,0.48)] shadow-[0_0_0_1px_rgba(246,150,41,0.14)] dark:border-[rgba(247,179,93,0.58)]" />
                      {RESIZE_HANDLES.map((handle) => (
                        <button
                          key={handle.key}
                          className={`absolute h-3.5 w-3.5 rounded-full border border-[#f0a853] bg-white shadow-[0_6px_12px_rgba(15,23,42,0.18)] transition hover:scale-105 hover:bg-[#fff5ea] dark:border-[#f7b35d] dark:bg-[#2f3437] dark:hover:bg-[#3a4043] ${handle.className}`}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            previewCanvasRef.current?.focus();
                            interactionDidMoveRef.current = false;
                            onSelectElement(elementKey);
                            setInteractionState({
                              elementKey,
                              handle: handle.key,
                              mode: "resize",
                              pointerId: event.pointerId,
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                              startElement: element,
                              wasSelectedOnPointerDown: isSelected,
                            });
                          }}
                          style={{ cursor: isResizing ? "grabbing" : undefined }}
                          type="button"
                        />
                      ))}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
