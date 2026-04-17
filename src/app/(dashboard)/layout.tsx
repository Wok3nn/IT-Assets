import { requireBootstrapPage } from "@/lib/bootstrap.server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireBootstrapPage();

  return children;
}
