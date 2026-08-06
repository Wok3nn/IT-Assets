"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { SearchCombobox, type SearchComboboxOption } from "@/components/forms/search-combobox";
import { Button } from "@/components/ui/button";
import type { AvailableAssetForAssignment } from "@/modules/assets/asset.service";

export type UserAssignAssetState = {
  ok: boolean;
  message: string;
};

export const initialUserAssignAssetState: UserAssignAssetState = {
  ok: false,
  message: "",
};

type UserAssignAssetDialogProps = {
  action: (state: UserAssignAssetState, formData: FormData) => Promise<UserAssignAssetState>;
  assets: AvailableAssetForAssignment[];
  recipient: {
    label: string;
    description?: string;
  };
};

const overlayLayerClassName = "fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px] dark:bg-black/35";
const feedbackLayerClassName = "fixed bottom-5 right-5 z-[1010] max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-lg";

function getAssetOptionLabel(asset: AvailableAssetForAssignment) {
  const displayName = [asset.make, asset.model].filter((value) => value?.trim()).join(" ").trim() || asset.model?.trim() || asset.name.trim();
  return `${asset.assetTag || "No tag"} - ${displayName}`;
}

function getAssetOptionDescription(asset: AvailableAssetForAssignment) {
  const details = [
    asset.categoryPath,
    asset.serialNumber ? `SN: ${asset.serialNumber}` : null,
    asset.assignedLocationName ? `Stored at ${asset.assignedLocationName}` : null,
  ].filter(Boolean);

  return details.join(" · ");
}

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending || disabled} type="submit">
      {pending ? "Assigning..." : "Assign asset"}
    </Button>
  );
}

export function UserAssignAssetDialog({ action, assets, recipient }: UserAssignAssetDialogProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SearchComboboxOption | null>(null);
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState<UserAssignAssetState | null>(null);
  const [state, formAction] = useActionState(action, initialUserAssignAssetState);

  const assetOptions = useMemo<SearchComboboxOption[]>(
    () => assets.map((asset) => ({
      id: asset.id,
      label: getAssetOptionLabel(asset),
      description: getAssetOptionDescription(asset),
      kind: "Asset",
      searchText: [
        asset.assetTag,
        asset.name,
        asset.make,
        asset.model,
        asset.serialNumber,
        asset.categoryPath,
        asset.assignedLocationName,
      ].filter(Boolean).join(" "),
    })),
    [assets],
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!state.message) {
      return;
    }

    setFeedback(state);

    if (state.ok) {
      setOpen(false);
      setSelectedAsset(null);
      setComment("");
      router.refresh();
    } else {
      setSelectedAsset(null);
      router.refresh();
    }
  }, [router, state]);

  useEffect(() => {
    if (!feedback?.ok) {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!open) {
      setSelectedAsset(null);
      setComment("");
    }
  }, [open]);

  const feedbackToast = feedback ? (
    <div
      className={`${feedbackLayerClassName} ${feedback.ok
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"}`}
      role="status"
    >
      {feedback.message}
    </div>
  ) : null;

  const dialog = open ? (
    <div
      aria-modal="true"
      className={overlayLayerClassName}
      onClick={() => setOpen(false)}
      role="dialog"
    >
      <div
        className="w-full max-w-lg rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:border-[#4b5255] dark:bg-[#2f3437]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Assign asset</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Assign asset to: <span className="font-medium text-slate-950 dark:text-slate-100">{recipient.label}</span>
            </p>
            {recipient.description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{recipient.description}</p> : null}
          </div>
          <button
            aria-label="Close"
            className="rounded-full px-3 py-1.5 text-lg leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#3c4347] dark:hover:text-slate-100"
            onClick={() => setOpen(false)}
            type="button"
          >
            x
          </button>
        </div>

        <form action={formAction} className="mt-5 space-y-4">
          <input name="assetId" type="hidden" value={selectedAsset?.id ?? ""} />
          <SearchCombobox
            emptyMessage="No available assets match that search."
            label="Asset"
            onChange={setSelectedAsset}
            options={assetOptions}
            placeholder="Search by tag, make, model, serial, or category"
            value={selectedAsset?.id ?? null}
          />

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Comment</span>
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-100"
              maxLength={2000}
              name="transferNote"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional handoff note"
              rows={3}
              value={comment}
            />
          </label>

          {state.message && !state.ok ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {state.message}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onClick={() => setOpen(false)} type="button" variant="ghost">Cancel</Button>
            <SubmitButton disabled={!selectedAsset} />
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        onClick={() => {
          setFeedback(null);
          setOpen(true);
        }}
        type="button"
        variant="secondary"
      >
        Assign asset
      </Button>
      {isMounted && feedbackToast ? createPortal(feedbackToast, document.body) : null}
      {isMounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
