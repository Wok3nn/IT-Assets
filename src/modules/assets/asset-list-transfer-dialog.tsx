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

function SubmitButton({ disabled = false, label }: { disabled?: boolean; label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending || disabled} type="submit">
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
  const [selectedUser, setSelectedUser] = useState<TransferOption | null>(null);
  const [state, formAction] = useActionState(action, initialAssetListTransferState);
  const mode = asset.checkLabel === "Check in" ? "checkin" : "checkout";
  const isCheckOut = mode === "checkout";
  const title = isCheckOut ? "Check Out Asset" : "Check In Asset";
  const summary = getAssetSummary(asset);

  const filteredUsers = useMemo(() => filterOptions(users, userQuery), [userQuery, users]);
  const visibleUsers = filteredUsers.slice(0, 8);

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

  useEffect(() => {
    if (!open) {
      setUserQuery("");
      setSelectedUser(null);
    }
  }, [open]);

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
          {isCheckOut ? <input name="assignedUserId" type="hidden" value={selectedUser?.id ?? ""} /> : null}

          {isCheckOut ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={`checkout-user-search-${asset.id}`}>
                Assign to user
              </label>
              <input
                aria-controls={`checkout-user-results-${asset.id}`}
                aria-describedby={selectedUser ? `checkout-user-selected-${asset.id}` : undefined}
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-100"
                id={`checkout-user-search-${asset.id}`}
                onChange={(event) => setUserQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && visibleUsers.length === 1) {
                    event.preventDefault();
                    setSelectedUser(visibleUsers[0]);
                    setUserQuery("");
                  }
                }}
                placeholder="Search users"
                role="combobox"
                aria-expanded="true"
                type="search"
                value={userQuery}
              />
              <div
                className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 dark:border-[#4b5255] dark:bg-[#34393c]"
                id={`checkout-user-results-${asset.id}`}
                role="listbox"
              >
                {visibleUsers.length > 0 ? (
                  visibleUsers.map((user) => {
                    const isSelected = selectedUser?.id === user.id;
                    return (
                      <button
                        aria-selected={isSelected}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${isSelected ? "bg-[#fff4e8] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd7ab]" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#3c4347]"}`}
                        key={user.id}
                        onClick={() => {
                          setSelectedUser(user);
                          setUserQuery("");
                        }}
                        role="option"
                        type="button"
                      >
                        <span className="min-w-0 truncate">{user.label}</span>
                        {isSelected ? <span className="ml-3 shrink-0 text-xs font-medium">Selected</span> : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No users match that search.</p>
                )}
              </div>
              {selectedUser ? (
                <div
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0d3b4] bg-[#fff8f0] px-3 py-2 text-sm text-slate-700 dark:border-[#6f5530] dark:bg-[rgba(246,150,41,0.12)] dark:text-slate-200"
                  id={`checkout-user-selected-${asset.id}`}
                >
                  <span className="min-w-0 truncate">Selected: <span className="font-medium text-slate-950 dark:text-slate-100">{selectedUser.label}</span></span>
                  <button
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-[#b56613] transition hover:bg-white/70 dark:text-[#ffd7ab] dark:hover:bg-white/10"
                    onClick={() => setSelectedUser(null)}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose a user from the results before checking out.</p>
              )}
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

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Comment</span>
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-100"
              maxLength={2000}
              name="transferNote"
              placeholder={isCheckOut ? "Optional handoff note" : "Optional return note"}
              rows={3}
            />
          </label>

          {state.message && !state.ok ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {state.message}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onClick={() => setOpen(false)} type="button" variant="ghost">Cancel</Button>
            <SubmitButton disabled={isCheckOut && !selectedUser} label={isCheckOut ? "Check out asset" : "Check in asset"} />
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
