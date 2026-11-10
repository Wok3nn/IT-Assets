import { AppShellRoot } from "@/components/navigation/app-shell";
import { getCurrentSession } from "@/lib/session.server";
import { ControlShell } from "./control-shell";
import { control } from "./control-store";

export async function ManagementShell({ children }: { children: React.ReactNode }) {
  const store = control();
  if (store.state().active) {
    try {
      if (await getCurrentSession()) return await AppShellRoot({ children });
    } catch {
      // Recovery remains reachable when the selected inventory is unavailable.
    }
  }
  return (
    <ControlShell
      title={store.organization()?.appTitle ?? "IT Assets"}
      active={Boolean(store.state().active)}
    >
      {children}
    </ControlShell>
  );
}
