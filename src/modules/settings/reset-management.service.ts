import { Prisma } from "@prisma/client";

import { db } from "@/services/database";

export const RESET_ACTIONS = [
  "assets",
  "users",
  "categories",
  "departments",
  "label-templates",
  "locations",
  "full-app",
] as const;

export type ResetActionKey = (typeof RESET_ACTIONS)[number];

export type ResetOverview = {
  assets: number;
  users: number;
  guestProfiles: number;
  categories: number;
  departments: number;
  labelTemplates: number;
  locations: number;
};

export type ResetActionResult =
  | {
      target: "assets";
      summary: { assetCount: number; detachedAssetScopeCount: number };
      shouldRedirectToLogin: false;
    }
  | {
      target: "users";
      summary: {
        userCount: number;
        clearedAssetAssignmentCount: number;
        detachedAuditEntryCount: number;
        deletedSessionCount: number;
        deletedUserRoleCount: number;
        deletedUserScopeCount: number;
      };
      shouldRedirectToLogin: true;
    }
  | {
      target: "categories";
      summary: {
        categoryCount: number;
        clearedAssetCategoryCount: number;
        clearedCategoryParentCount: number;
      };
      shouldRedirectToLogin: false;
    }
  | {
      target: "departments";
      summary: {
        departmentCount: number;
        detachedAssetScopeCount: number;
        detachedUserScopeCount: number;
      };
      shouldRedirectToLogin: false;
    }
  | {
      target: "label-templates";
      summary: {
        templateCount: number;
        deletedTemplateElementCount: number;
        clearedAssetTemplateCount: number;
        clearedCategoryDefaultTemplateCount: number;
      };
      shouldRedirectToLogin: false;
    }
  | {
      target: "locations";
      summary: {
        locationCount: number;
        clearedAssetLocationCount: number;
        clearedLocationParentCount: number;
      };
      shouldRedirectToLogin: false;
    }
  | {
      target: "full-app";
      summary: ResetOverview;
      shouldRedirectToLogin: true;
    };

type Tx = Prisma.TransactionClient;

export async function getResetOverview(): Promise<ResetOverview> {
  const [assets, users, guestProfiles, categories, departments, labelTemplates, locations] = await Promise.all([
    db.asset.count(),
    db.user.count(),
    db.guestProfile.count(),
    db.category.count(),
    db.scope.count(),
    db.labelTemplate.count(),
    db.location.count(),
  ]);

  return { assets, users, guestProfiles, categories, departments, labelTemplates, locations };
}

async function clearAssetsDataTx(tx: Tx) {
  await tx.borrowedItemNotification.deleteMany({
    where: {
      borrowedItem: {
        assetId: { not: null },
      },
    },
  });
  await tx.borrowedItem.deleteMany({
    where: {
      assetId: { not: null },
    },
  });
  const detachedScopes = await tx.assetScope.deleteMany({});
  const deletedAssets = await tx.asset.deleteMany({});

  return {
    assetCount: deletedAssets.count,
    detachedAssetScopeCount: detachedScopes.count,
  };
}

async function clearUsersDataTx(tx: Tx) {
  await tx.borrowedItemNotification.deleteMany({
    where: {
      borrowedItemId: { not: null },
    },
  });
  await tx.borrowedItem.deleteMany({});
  const clearedAssignments = await tx.asset.updateMany({
    where: {
      OR: [
        { assignedUserId: { not: null } },
        { assignedGuestProfileId: { not: null } },
      ],
    },
    data: {
      assignedUserId: null,
      assignedGuestProfileId: null,
    },
  });
  const detachedAuditEntries = await tx.auditLog.updateMany({
    where: { actorUserId: { not: null } },
    data: { actorUserId: null },
  });
  const deletedSessions = await tx.session.count();
  const deletedUserRoles = await tx.userRole.count();
  const deletedUserScopes = await tx.userScope.count();
  const deletedUsers = await tx.user.deleteMany({});

  return {
    userCount: deletedUsers.count,
    clearedAssetAssignmentCount: clearedAssignments.count,
    detachedAuditEntryCount: detachedAuditEntries.count,
    deletedSessionCount: deletedSessions,
    deletedUserRoleCount: deletedUserRoles,
    deletedUserScopeCount: deletedUserScopes,
  };
}

async function resetCategoriesDataTx(tx: Tx) {
  const clearedAssetCategories = await tx.asset.updateMany({
    where: { categoryId: { not: null } },
    data: { categoryId: null },
  });
  const clearedCategoryParents = await tx.category.updateMany({
    where: { parentId: { not: null } },
    data: { parentId: null },
  });
  const deletedCategories = await tx.category.deleteMany({});

  return {
    categoryCount: deletedCategories.count,
    clearedAssetCategoryCount: clearedAssetCategories.count,
    clearedCategoryParentCount: clearedCategoryParents.count,
  };
}

async function resetDepartmentsDataTx(tx: Tx) {
  const detachedAssetScopes = await tx.assetScope.deleteMany({});
  const detachedUserScopes = await tx.userScope.deleteMany({});
  const deletedDepartments = await tx.scope.deleteMany({});

  return {
    departmentCount: deletedDepartments.count,
    detachedAssetScopeCount: detachedAssetScopes.count,
    detachedUserScopeCount: detachedUserScopes.count,
  };
}

async function resetLabelTemplatesDataTx(tx: Tx) {
  const clearedAssetTemplates = await tx.asset.updateMany({
    where: { labelTemplateId: { not: null } },
    data: { labelTemplateId: null },
  });
  const clearedCategoryDefaultTemplates = await tx.category.updateMany({
    where: { defaultLabelTemplateId: { not: null } },
    data: { defaultLabelTemplateId: null },
  });
  const deletedTemplateElements = await tx.labelTemplateElement.deleteMany({});
  const deletedTemplates = await tx.labelTemplate.deleteMany({});

  return {
    templateCount: deletedTemplates.count,
    deletedTemplateElementCount: deletedTemplateElements.count,
    clearedAssetTemplateCount: clearedAssetTemplates.count,
    clearedCategoryDefaultTemplateCount: clearedCategoryDefaultTemplates.count,
  };
}

async function resetLocationsDataTx(tx: Tx) {
  const clearedAssetLocations = await tx.asset.updateMany({
    where: { assignedLocationId: { not: null } },
    data: { assignedLocationId: null },
  });
  const clearedLocationParents = await tx.location.updateMany({
    where: { parentId: { not: null } },
    data: { parentId: null },
  });
  const deletedLocations = await tx.location.deleteMany({});

  return {
    locationCount: deletedLocations.count,
    clearedAssetLocationCount: clearedAssetLocations.count,
    clearedLocationParentCount: clearedLocationParents.count,
  };
}

export async function clearAssetsData() {
  return db.$transaction((tx) => clearAssetsDataTx(tx));
}

export async function clearUsersData() {
  return db.$transaction((tx) => clearUsersDataTx(tx));
}

export async function resetCategoriesData() {
  return db.$transaction((tx) => resetCategoriesDataTx(tx));
}

export async function resetDepartmentsData() {
  return db.$transaction((tx) => resetDepartmentsDataTx(tx));
}

export async function resetLabelTemplatesData() {
  return db.$transaction((tx) => resetLabelTemplatesDataTx(tx));
}

export async function resetLocationsData() {
  return db.$transaction((tx) => resetLocationsDataTx(tx));
}

export async function resetFullAppData() {
  return db.$transaction(async (tx) => {
    const overview = await getResetOverview();

    await tx.borrowedItemNotification.deleteMany({});
    await clearAssetsDataTx(tx);
    await clearUsersDataTx(tx);
    await tx.guestProfile.deleteMany({});
    await resetLabelTemplatesDataTx(tx);
    await resetCategoriesDataTx(tx);
    await resetLocationsDataTx(tx);
    await resetDepartmentsDataTx(tx);

    return overview;
  });
}

export async function runResetAction(target: ResetActionKey): Promise<ResetActionResult> {
  switch (target) {
    case "assets":
      return { target, summary: await clearAssetsData(), shouldRedirectToLogin: false };
    case "users":
      return { target, summary: await clearUsersData(), shouldRedirectToLogin: true };
    case "categories":
      return { target, summary: await resetCategoriesData(), shouldRedirectToLogin: false };
    case "departments":
      return { target, summary: await resetDepartmentsData(), shouldRedirectToLogin: false };
    case "label-templates":
      return { target, summary: await resetLabelTemplatesData(), shouldRedirectToLogin: false };
    case "locations":
      return { target, summary: await resetLocationsData(), shouldRedirectToLogin: false };
    case "full-app":
      return { target, summary: await resetFullAppData(), shouldRedirectToLogin: true };
  }
}
