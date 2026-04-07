import type { CSSProperties } from "react";

import { getBarcodeSvgMarkup, getQrSvgMarkup } from "../label-template-codes";
import {
  getLabelElementValue,
  type LabelTemplateElementDefinition,
  type LabelTemplateRenderData,
  type LabelTemplateUnit,
} from "../label-template.shared";

export function getLabelCssPixelsPerUnit(unit: LabelTemplateUnit) {
  if (unit === "millimeters") {
    return 96 / 25.4;
  }

  if (unit === "centimeters") {
    return 96 / 2.54;
  }

  return 96;
}

export function getLabelRenderScaleFactor({
  renderedWidthPx,
  templateWidth,
  unit,
}: {
  renderedWidthPx: number;
  templateWidth: number;
  unit: LabelTemplateUnit;
}) {
  const actualCssWidth = Math.max(templateWidth * getLabelCssPixelsPerUnit(unit), 1);
  return renderedWidthPx / actualCssWidth;
}

export function getLabelElementFrameStyle({
  element,
  templateHeight,
  templateWidth,
  zIndex,
}: {
  element: LabelTemplateElementDefinition;
  templateHeight: number;
  templateWidth: number;
  zIndex?: number;
}): CSSProperties {
  return {
    left: `${(element.x / templateWidth) * 100}%`,
    top: `${(element.y / templateHeight) * 100}%`,
    width: `${(element.width / templateWidth) * 100}%`,
    height: `${(element.height / templateHeight) * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: zIndex ?? element.zIndex,
  };
}

export function getLabelElementContentStyle({
  element,
  renderScaleFactor,
}: {
  element: LabelTemplateElementDefinition;
  renderScaleFactor: number;
}): CSSProperties {
  const scale = Math.max(renderScaleFactor, 0.8);

  return {
    fontSize: `${Math.max(element.fontSize * scale, 10)}px`,
    fontWeight: element.fontWeight,
    fontStyle: element.italic ? "italic" : "normal",
    justifyContent:
      element.textAlign === "center"
        ? "center"
        : element.textAlign === "right"
          ? "flex-end"
          : "flex-start",
    textAlign: element.textAlign,
    paddingInline: `${Math.max(4 * scale, 3)}px`,
    paddingBlock: `${Math.max(1.5 * scale, 1)}px`,
  };
}

function MachineLabelGraphic({
  element,
  renderData,
}: {
  element: LabelTemplateElementDefinition;
  renderData?: LabelTemplateRenderData;
}) {
  const value = getLabelElementValue(element.fieldKey, renderData);
  const markup = element.type === "barcode"
    ? getBarcodeSvgMarkup(value)
    : getQrSvgMarkup(value);

  if (!markup) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[4px] border border-dashed border-slate-300 bg-white px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:border-slate-600 dark:bg-slate-100 dark:text-slate-600">
        No data
      </div>
    );
  }

  return (
    <div
      className="h-full w-full overflow-hidden rounded-[4px] bg-white"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export function LabelTemplateRenderedValue({
  className = "",
  element,
  renderData,
  renderScaleFactor,
}: {
  className?: string;
  element: LabelTemplateElementDefinition;
  renderData?: LabelTemplateRenderData;
  renderScaleFactor: number;
}) {
  if (element.type === "barcode" || element.type === "qr") {
    return <MachineLabelGraphic element={element} renderData={renderData} />;
  }

  return (
    <div
      className={`flex h-full w-full overflow-hidden whitespace-nowrap text-slate-950 dark:text-white ${className}`.trim()}
      style={getLabelElementContentStyle({ element, renderScaleFactor })}
    >
      <span className="block w-full truncate leading-none">{getLabelElementValue(element.fieldKey, renderData)}</span>
    </div>
  );
}
