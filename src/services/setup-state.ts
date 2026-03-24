import { db } from "@/services/database";

export type SetupState = {
  id?: string;
  isCompleted: boolean;
  siteName: string;
  initializedAt: string;
};

export async function readSetupState() {
  const state = await db.setupState.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!state) {
    return null;
  }

  return {
    id: state.id,
    isCompleted: state.isCompleted,
    siteName: state.siteName ?? "",
    initializedAt: (state.initializedAt ?? state.createdAt).toISOString(),
  } satisfies SetupState;
}

export async function writeSetupState(state: SetupState) {
  const initializedAt = new Date(state.initializedAt);

  return db.setupState.upsert({
    where: {
      id: state.id ?? "setup-state",
    },
    update: {
      isCompleted: state.isCompleted,
      siteName: state.siteName,
      initializedAt,
    },
    create: {
      id: state.id ?? "setup-state",
      isCompleted: state.isCompleted,
      siteName: state.siteName,
      initializedAt,
    },
  });
}

