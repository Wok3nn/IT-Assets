import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserAssetPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import {
  BORROWED_ITEMS_HREF,
  buildBorrowedItemsUrl,
  parseBorrowedItemsPage,
  parseBorrowedItemsPageSize,
  parseBorrowedItemsStatus,
} from "@/modules/borrowed-items/borrowed-items-routing";
import { BorrowedItemsPanel, type BorrowedItemsActionState } from "@/modules/borrowed-items/components/borrowed-items-panel";
import {
  createBorrowedItem,
  listAssetsAvailableForBorrowing,
  listBorrowedItems,
  listBorrowersForBorrowedItems,
  markBorrowedItemReturned,
} from "@/modules/borrowed-items/borrowed-items.service";
import { formatDateTimeLocalInput } from "@/modules/borrowed-items/borrowed-items.shared";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type BorrowedItemsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function buildActionState(error: unknown, fallback: string): BorrowedItemsActionState {
  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback,
  };
}

async function createBorrowedItemAction(
  _state: BorrowedItemsActionState,
  formData: FormData,
): Promise<BorrowedItemsActionState> {
  "use server";

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const permissionContext = await getCurrentUserAssetPermissionContext();
  if (!permissionContext.capabilities.manageBorrowedItems) {
    return { ok: false, message: "You do not have permission to manage borrowed items." };
  }

  try {
    const created = await createBorrowedItem({
      itemType: String(formData.get("itemType") ?? "") === "manual" ? "manual" : "asset",
      assetId: String(formData.get("assetId") ?? ""),
      itemName: String(formData.get("itemName") ?? ""),
      quantity: Number(formData.get("quantity") ?? 1),
      borrowerUserId: String(formData.get("borrowerUserId") ?? ""),
      borrowedAt: String(formData.get("borrowedAt") ?? ""),
      dueAt: String(formData.get("dueAt") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      actorUserId: currentUser.id,
      accessScope: permissionContext.assetScope,
    });

    revalidatePath(BORROWED_ITEMS_HREF);
    revalidatePath(`/users/${created.borrowerUserId}`);
    if (created.assetId) revalidatePath(`/assets/${created.assetId}`);

    return { ok: true, message: "Borrowing record created." };
  } catch (error) {
    return buildActionState(error, "Borrowing record could not be created.");
  }
}

async function markBorrowedItemReturnedAction(
  _state: BorrowedItemsActionState,
  formData: FormData,
): Promise<BorrowedItemsActionState> {
  "use server";

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const permissionContext = await getCurrentUserAssetPermissionContext();
  if (!permissionContext.capabilities.manageBorrowedItems) {
    return { ok: false, message: "You do not have permission to manage borrowed items." };
  }

  try {
    const returned = await markBorrowedItemReturned({
      borrowedItemId: String(formData.get("borrowedItemId") ?? ""),
      returnedAt: String(formData.get("returnedAt") ?? ""),
      actorUserId: currentUser.id,
      accessScope: permissionContext.assetScope,
    });

    revalidatePath(BORROWED_ITEMS_HREF);
    revalidatePath(`/users/${returned.borrowerUserId}`);
    if (returned.assetId) revalidatePath(`/assets/${returned.assetId}`);

    return { ok: true, message: "Item marked returned." };
  } catch (error) {
    return buildActionState(error, "Item could not be marked returned.");
  }
}

export default async function BorrowedItemsPage({ searchParams }: BorrowedItemsPageProps) {
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const status = parseBorrowedItemsStatus(params.status);
  const page = parseBorrowedItemsPage(params.page);
  const pageSize = parseBorrowedItemsPageSize(params.pageSize);

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserAssetPermissionContext(),
  ]);

  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.viewBorrowedItems) notFound();

  const [borrowedItemsResult, borrowers, assets] = await Promise.all([
    listBorrowedItems({
      q: query,
      status,
      page,
      pageSize,
      accessScope: permissionContext.assetScope,
    }),
    permissionContext.capabilities.manageBorrowedItems ? listBorrowersForBorrowedItems() : Promise.resolve([]),
    permissionContext.capabilities.manageBorrowedItems
      ? listAssetsAvailableForBorrowing({ accessScope: permissionContext.assetScope })
      : Promise.resolve([]),
  ]);

  if (page > borrowedItemsResult.totalPages) {
    redirect(buildBorrowedItemsUrl({ q: query || null, status, page: borrowedItemsResult.totalPages, pageSize }));
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Borrowed Items</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Loan management</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                Track temporary loans for existing assets and small miscellaneous items without changing normal asset assignment.
              </p>
            </div>
          </div>
        </PageHero>

        <PageHero>
          <BorrowedItemsPanel
            assets={assets}
            borrowers={borrowers}
            canManageBorrowedItems={permissionContext.capabilities.manageBorrowedItems}
            createAction={createBorrowedItemAction}
            defaultBorrowedAt={formatDateTimeLocalInput(new Date())}
            items={borrowedItemsResult.items}
            markReturnedAction={markBorrowedItemReturnedAction}
            page={borrowedItemsResult.page}
            pageSize={pageSize}
            query={query}
            status={status}
            totalCount={borrowedItemsResult.totalCount}
            totalPages={borrowedItemsResult.totalPages}
          />
        </PageHero>
      </div>
    </AppShell>
  );
}
