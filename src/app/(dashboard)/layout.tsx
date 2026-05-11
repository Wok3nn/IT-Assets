import { requireBootstrapPage } from "@/lib/bootstrap.server";
import { AppShellRoot } from "@/components/navigation/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireBootstrapPage();

  return <AppShellRoot>{children}</AppShellRoot>;
}
