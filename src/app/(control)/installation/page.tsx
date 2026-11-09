import { notFound, redirect } from "next/navigation";
import { managed } from "@/modules/database-management/control-store";
export const dynamic = "force-dynamic";
export default function Installation() {
  if (!managed()) notFound();
  redirect("/setup");
}
