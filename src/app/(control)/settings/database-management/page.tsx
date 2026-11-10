import { notFound, redirect } from "next/navigation";
import { control, managed } from "@/modules/database-management/control-store";
import { ManagementShell } from "@/modules/database-management/management-shell";
import { Form } from "@/modules/database-management/action-form";
import { Field } from "@/modules/database-management/panel";
import { Button } from "@/components/ui/button";
import { PanelCard } from "@/components/layout/panel-card";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Entry({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!managed()) notFound();
  if (!control().registered()) redirect("/setup");
  const { message } = await searchParams;
  return (
    <ManagementShell>
      <div className="space-y-5">
        <h1 className="text-3xl font-semibold">Database Management</h1>
        {control().state().active && (
          <Link href="/settings" prefetch={false} className="underline">Back to Settings</Link>
        )}
        <PanelCard className="max-w-xl">
          <h2 className="mb-3 text-xl font-semibold">Installation administrator sign-in</h2>
          <p className="mb-4 text-sm">Sign in separately to manage database connections. Your workspace session stays signed in.</p>
          {message && <p role="status">{message}</p>}
          <Form op="login">
            <Field name="email" label="Administrator email" type="email" />
            <Field name="password" label="Password" type="password" />
            <Button type="submit">Sign in</Button>
          </Form>
        </PanelCard>
      </div>
    </ManagementShell>
  );
}
