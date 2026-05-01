"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export type AssetListTransferState = {
  ok: boolean;
  message: string;
  mode?: "checkin" | "checkout";
};

export const initialAssetListTransferState: AssetListTransferState = {
  ok: false,
  message: "",
};

type TransferOption = {
  id: string;
  label: string;
};

type AssetListTransferDialogProps = {
  action: (state: AssetListTransferState, formData: FormData) => Promise<AssetListTransferState>;
  asset: {
    id: string;
    assetTag: string;
    assetName: string;
    model: string | null;
    checkLabel: "Check out" | "Check in";
  };
  isActive: boolean;
  locations: TransferOption[];
  returnTo: string;
  users: TransferOption[];
};

const actionButtonStyle = { width: "96px", height: "36px" } as const;
const disabledPillStyle = { borderColor: "#cbd5e1", backgroundColor: "#f1f5f9", color: "#64748b" } as const;
const activeButtonStyle = { borderColor: "#d9892c", backgroundColor: "#F69629", color: "#ffffff" } as const;
const overlayLayerClassName = "fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px] dark:bg-black/35";
const feedbackLayerClassName = "fixed bottom-5 right-5 z-[1010] max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-lg";

function getAssetSummary(asset: AssetListTransferDialogProps["asset"]) {
  return asset.model?.trim() || asset.assetName.trim() || asset.assetTag;
}

function filterOptions(options: TransferOption[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function AssetListTransferDialog({
  action,
  asset,
  isActive,
  locations,
  returnTo,
  users,
}: AssetListTransferDialogProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<AssetListTransferState | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [state, formAction] = useActionState(action, initialAssetListTransferState);
  const mode = asset.checkLabel === "Check in" ? "checkin" : "checkout";
  const isCheckOut = mode === "checkout";
  const title = isCheckOut ? "Check Out Asset" : "Check In Asset";
  const summary = getAssetSummary(asset);

  const filteredUsers = useMemo(() => filterOptions(users, userQuery), [userQuery, users]);

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

  if (!isActive) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-slate-500 dark:text-slate-200"
        style={{ ...actionButtonStyle, ...disabledPillStyle }}
      >
        {asset.checkLabel}
      </span>
    );
  }

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
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-950 dark:text-slate-100">{asset.assetTag}</span>
              {" - "}
              {summary}
            </p>
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
          <input name="assetId" type="hidden" value={asset.id} />
          <input name="mode" type="hidden" value={mode} />
          <input name="returnTo" type="hidden" value={returnTo} />

          {isCheckOut ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={`checkout-user-${asset.id}`}>
                Assign to user
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-100"
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Search users"
                type="search"
                value={userQuery}
              />
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-100"
                id={`checkout-user-${asset.id}`}
                name="assignedUserId"
                required
              >
                <option value="">Select user</option>
                {filteredUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={`checkin-location-${asset.id}`}>
                Return location
              </label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-100"
                id={`checkin-location-${asset.id}`}
                name="locationId"
              >
                <option value="">No location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.label}</option>
                ))}
              </select>
            </div>
          )}

          {state.message && !state.ok ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {state.message}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onClick={() => setOpen(false)} type="button" variant="ghost">Cancel</Button>
            <SubmitButton label={isCheckOut ? "Check out asset" : "Check in asset"} />
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        className="inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-white"
        onClick={(event) => {
          event.stopPropagation();
          setFeedback(null);
          setOpen(true);
        }}
        style={{ ...actionButtonStyle, ...activeButtonStyle }}
        type="button"
      >
        {asset.checkLabel}
      </button>

      {isMounted && feedbackToast ? createPortal(feedbackToast, document.body) : null}
      {isMounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
