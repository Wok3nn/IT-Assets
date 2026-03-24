"use client";

import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";

type UserOption = {
  id: string;
  name: string;
};

type LocationOption = {
  id: string;
  label: string;
};

type AssetTransferPanelProps = {
  assetId: string;
  isCheckedOut: boolean;
  initialMode?: "checkout" | "checkin" | null;
  statusLabel: string;
  statusColor?: string | null;
  userLabel: string;
  locationLabel: string;
  initialAssignedUserId?: string | null;
  initialAssignedLocationId?: string | null;
  users: UserOption[];
  locations: LocationOption[];
  fieldClass: string;
  cardClass: string;
  checkOutAction: (formData: FormData) => void | Promise<void>;
  checkInAction: (formData: FormData) => void | Promise<void>;
  filterState: {
    q: string;
    statusId: string | null;
    categoryId: string | null;
    scopeId: string | null;
    locationId: string | null;
    userId: string | null;
    sort: string;
  };
  returnTo?: string | null;
};

export function AssetTransferPanel({
  assetId,
  isCheckedOut,
  initialMode,
  statusLabel,
  statusColor,
  userLabel,
  locationLabel,
  initialAssignedUserId,
  initialAssignedLocationId,
  users,
  locations,
  fieldClass,
  cardClass,
  checkOutAction,
  checkInAction,
  filterState,
  returnTo,
}: AssetTransferPanelProps) {
  const [activeMode, setActiveMode] = useState<"checkout" | "checkin" | null>(() => {
    if (initialMode === "checkout" && !isCheckedOut) {
      return "checkout";
    }

    if (initialMode === "checkin" && isCheckedOut) {
      return "checkin";
    }

    return null;
  });

  const currentState = isCheckedOut ? "checkout" : "checkin";
  const checkoutActive = activeMode === "checkout";
  const checkinActive = activeMode === "checkin";

  const mutedClass = "border-slate-200/80 bg-slate-100/80 text-slate-400 opacity-60 dark:border-[#454c50] dark:bg-[#2b3033] dark:text-slate-500";
  const activeClass = "border-[#f0c48d] bg-white shadow-[0_14px_24px_rgba(15,23,42,0.08)] dark:border-[#f0a853] dark:bg-[#2f3437]";

  const hiddenFields = (
    <>
      <input name="q" type="hidden" value={filterState.q} />
      <input name="statusIdFilter" type="hidden" value={filterState.statusId ?? ""} />
      <input name="categoryIdFilter" type="hidden" value={filterState.categoryId ?? ""} />
      <input name="scopeIdFilter" type="hidden" value={filterState.scopeId ?? ""} />
      <input name="locationIdFilter" type="hidden" value={filterState.locationId ?? ""} />
      <input name="userIdFilter" type="hidden" value={filterState.userId ?? ""} />
      <input name="sort" type="hidden" value={filterState.sort} />
      <input name="returnEditId" type="hidden" value={assetId} />
      <input name="assetId" type="hidden" value={assetId} />
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
    </>
  );

  return (
    <div className={cardClass}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">Asset movement</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Only one transfer path is active at a time. Start the opposite action from the current state card.
          </p>
        </div>
        <AssetStatusPill color={statusColor} label={statusLabel} />
      </div>

      <div className="my-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
        <ArrowLeftRight className="h-5 w-5" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`rounded-2xl border p-4 transition ${checkoutActive || currentState === "checkout" ? activeClass : mutedClass}`}>
          {checkoutActive ? (
            <form action={checkOutAction} className="space-y-3">
              {hiddenFields}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Check out asset</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Assign to a user, a location, or both.</p>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">User</span>
                <select className={fieldClass} defaultValue={initialAssignedUserId ?? ""} name="checkoutAssignedUserId">
                  <option value="">Nobody</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Location</span>
                <select className={fieldClass} defaultValue={initialAssignedLocationId ?? ""} name="checkoutLocationId">
                  <option value="">No location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Checkout note</span>
                <textarea className={fieldClass} name="checkoutNote" rows={3} placeholder="Optional handoff note" />
              </label>
              <div className="flex gap-3">
                <Button className="flex-1" type="submit">Confirm check out</Button>
                <Button className="flex-1" onClick={() => setActiveMode(null)} type="button" variant="ghost">Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Checked out</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">User {userLabel}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Location {locationLabel}</p>
              </div>
              {currentState === "checkout" ? (
                <Button className="w-full" onClick={() => setActiveMode("checkin")} type="button" variant="secondary">
                  Move to check in
                </Button>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-500">Checkout fields stay locked until you choose to move the asset out.</p>
              )}
            </div>
          )}
        </div>

        <div className={`rounded-2xl border p-4 transition ${checkinActive || currentState === "checkin" ? activeClass : mutedClass}`}>
          {checkinActive ? (
            <form action={checkInAction} className="space-y-3">
              {hiddenFields}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Check in asset</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Clear the assigned user and set a return location if needed.</p>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Return location</span>
                <select className={fieldClass} defaultValue={initialAssignedLocationId ?? ""} name="checkInLocationId">
                  <option value="">No location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Check-in note</span>
                <textarea className={fieldClass} name="checkInNote" rows={3} placeholder="Optional return note" />
              </label>
              <div className="flex gap-3">
                <Button className="flex-1" type="submit">Confirm check in</Button>
                <Button className="flex-1" onClick={() => setActiveMode(null)} type="button" variant="ghost">Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Checked in</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Location {locationLabel}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ready for assignment or storage.</p>
              </div>
              {currentState === "checkin" ? (
                <Button className="w-full" onClick={() => setActiveMode("checkout")} type="button" variant="secondary">
                  Move to check out
                </Button>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-500">Check-in fields stay locked until you choose to bring the asset back in.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
