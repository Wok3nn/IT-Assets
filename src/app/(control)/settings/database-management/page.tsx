import { notFound, redirect } from "next/navigation";
import { control, managed } from "@/modules/database-management/control-store";
import { SetupEntry } from "@/modules/database-management/setup-entry";
export const dynamic = "force-dynamic";
export default async function Entry({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!managed()) notFound();
  if (!control().registered()) redirect("/setup");
  return <SetupEntry registered message={(await searchParams).message} />;
}
