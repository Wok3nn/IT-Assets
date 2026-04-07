"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import {
  getLabelElementKey,
  getLabelTemplateCssUnit,
  getLabelTemplateUnitLabel,
  type LabelTemplateEditorValues,
  type LabelTemplateElementDefinition,
  type LabelTemplateRenderData,
} from "../label-template.shared";
import {
  getLabelCssPixelsPerUnit,
  getLabelElementFrameStyle,
  getLabelRenderScaleFactor,
  LabelTemplateRenderedValue,
} from "./label-template-rendering";

export function LabelTemplatePrintPreview({
  backHref,
  backLabel = "Back to editor",
  caption,
  description = "This view prints at the template&apos;s real dimensions with only the label on the page.",
  renderData,
  template,
  templateName,
  toolbarContent,
}: {
  backHref: string;
  backLabel?: string;
  caption?: string;
  description?: string;
  renderData?: LabelTemplateRenderData;
  template: Pick<LabelTemplateEditorValues, "width" | "height" | "unit" | "orientation"> & {
    elements: LabelTemplateElementDefinition[];
  };
  templateName: string;
  toolbarContent?: ReactNode;
}) {
  const cssUnit = getLabelTemplateCssUnit(template.unit);
  const visibleElements = template.elements.filter((element) => element.isVisible);
  const renderedWidthPx = template.width * getLabelCssPixelsPerUnit(template.unit);
  const renderScaleFactor = getLabelRenderScaleFactor({
    renderedWidthPx,
    templateWidth: template.width,
    unit: template.unit,
  });

  return (
    <>
      <style jsx global>{`
        @page {
          margin: 0;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          body {
            margin: 0;
          }

          .label-print-toolbar,
          .label-print-caption {
            display: none !important;
          }

          .label-print-stage {
            min-height: auto !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .label-print-sheet {
            margin: 0 !important;
            box-shadow: none !important;
            border-color: transparent !important;
          }
        }
      `}</style>

      <div className="label-print-stage flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_48%),linear-gradient(180deg,#f8fafc_0%,#eef2f6_100%)] px-6 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.14),_transparent_48%),linear-gradient(180deg,#2f3437_0%,#252a2d_100%)]">
        <div className="label-print-toolbar mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Print preview</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{templateName}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {toolbarContent}
            <Link href={backHref}><Button type="button" variant="ghost">{backLabel}</Button></Link>
            <Button onClick={() => window.print()} type="button">Print</Button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10 print:py-0">
          <div className="flex flex-col items-center gap-4">
            <div
              className="label-print-sheet relative overflow-hidden rounded-[16px] border border-[#d7dce2] bg-white shadow-[0_20px_40px_rgba(15,23,42,0.14)]"
              style={{
                width: `${template.width}${cssUnit}`,
                height: `${template.height}${cssUnit}`,
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent_28%)]" />
              {visibleElements.map((element) => (
                <div
                  key={getLabelElementKey(element)}
                  className="absolute overflow-hidden"
                  style={getLabelElementFrameStyle({
                    element,
                    templateHeight: template.height,
                    templateWidth: template.width,
                  })}
                >
                  <LabelTemplateRenderedValue className="!text-slate-950 dark:!text-slate-950" element={element} renderData={renderData} renderScaleFactor={renderScaleFactor} />
                </div>
              ))}
            </div>
            <p className="label-print-caption text-sm text-slate-500 dark:text-slate-400">
              {caption ?? `${template.width} x ${template.height} ${getLabelTemplateUnitLabel(template.unit)} - ${template.orientation}`}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
