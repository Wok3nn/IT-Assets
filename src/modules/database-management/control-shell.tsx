import { AppShellClient } from "@/components/navigation/app-shell.client";
import { Button } from "@/components/ui/button";
import { Form } from "./action-form";
import { control, managed } from "./control-store";
export function ControlShell({
  children,
  title,
  active,
}: {
  children: React.ReactNode;
  title: string;
  active: boolean;
}) {
  const presentation = managed() ? control().presentation() : null;
  return (
    <AppShellClient
      mode="control"
      appTitle={presentation?.appTitle ?? title}
      branding={presentation?.branding ?? {
        lightLogoUrl: "/branding/asset-tracker-logo-light-transparent.png",
        darkLogoUrl: "/branding/asset-tracker-logo-dark-transparent.png",
      }}
      initialSidebarCollapsed={false}
      visibleNavItemIds={[]}
      controlActions={<ControlExit active={active} />}
    >
      {children}
    </AppShellClient>
  );
}
export function ControlExit({ active }: { active: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Form op="exit">
        <input type="hidden" name="destination" value="inventory" />
        <Button variant="secondary" type="submit">
          {active ? "Back to IT Assets" : "First-run setup"}
        </Button>
      </Form>
      {active && (
        <Form op="exit">
          <input type="hidden" name="destination" value="settings" />
          <Button variant="ghost" type="submit">
            Settings
          </Button>
        </Form>
      )}
      <Form op="logout">
        <Button variant="ghost" type="submit">
          Sign out of Database Management
        </Button>
      </Form>
    </div>
  );
}
