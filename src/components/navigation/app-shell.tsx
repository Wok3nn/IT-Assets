"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, FolderTree, LayoutDashboard, MapPin, Settings2, Shield, Tags, Users } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/scopes", label: "Departments", icon: Shield },
  { href: "/labels", label: "Labels", icon: Tags },
  { href: "/users", label: "Users", icon: Users },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function getAssetSubnav(pathname: string) {
  if (pathname === "/assets/new") {
    return { baseHref: "/assets", items: [{ href: "/assets/new", label: "New asset" }] };
  }

  const sectionMatch = pathname.match(/^\/assets\/([^/]+)\/(edit|history)$/);
  if (sectionMatch) {
    const [, assetId] = sectionMatch;
    return {
      baseHref: "/assets",
      items: [
        { href: `/assets/${assetId}`, label: "View asset" },
        { href: `/assets/${assetId}/edit`, label: "Edit asset" },
        { href: `/assets/${assetId}/history`, label: "Asset history" },
      ],
    };
  }

  const viewMatch = pathname.match(/^\/assets\/([^/]+)$/);
  if (viewMatch) {
    const [, assetId] = viewMatch;
    return {
      baseHref: "/assets",
      items: [
        { href: `/assets/${assetId}`, label: "View asset" },
        { href: `/assets/${assetId}/edit`, label: "Edit asset" },
        { href: `/assets/${assetId}/history`, label: "Asset history" },
      ],
    };
  }

  return { baseHref: null as string | null, items: [] as Array<{ href: string; label: string }> };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const assetSubnav = getAssetSubnav(pathname);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_24%),linear-gradient(180deg,#fcfcfd_0%,#f6f7f9_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_24%),linear-gradient(180deg,#2f3437_0%,#2c3134_52%,#292e31_100%)]">
      <div className="flex min-h-screen w-full gap-6 px-4 py-6 lg:px-8 2xl:px-10">
        <aside className="hidden w-72 shrink-0 rounded-[32px] border border-[#ece7df] bg-white/92 p-5 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92 lg:flex lg:flex-col">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">IT-Asset-Tracker</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-[#fff3e4]">Modern asset operations</h1>
          </div>
          <nav className="space-y-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
              const showAssetSubnav = href === assetSubnav.baseHref && assetSubnav.items.length > 0;

              return (
                <div key={href} className="space-y-2">
                  <Link
                    href={href}
                    className={isActive
                      ? "flex items-center gap-3 rounded-2xl border border-[#f2c28c] bg-[rgba(246,150,41,0.16)] px-4 py-3 text-sm font-medium text-[#b56613] shadow-[0_10px_22px_rgba(246,150,41,0.12)] transition dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.22)] dark:text-[#ffd7ab] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                      : "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-700 transition hover:bg-[rgba(246,150,41,0.12)] hover:text-[#b56613] dark:text-slate-100 dark:hover:bg-[rgba(246,150,41,0.18)] dark:hover:text-[#ffd1a0]"}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>

                  {showAssetSubnav ? (
                    <div className="space-y-1 pl-6">
                      {assetSubnav.items.map((item) => {
                        const isSubActive = pathname === item.href;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={isSubActive
                              ? "block rounded-xl border border-[#f2c28c] bg-[rgba(246,150,41,0.12)] px-3 py-2 text-sm font-medium text-[#b56613] dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd7ab]"
                              : "block rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-[rgba(246,150,41,0.08)] hover:text-[#b56613] dark:text-slate-300 dark:hover:bg-[rgba(246,150,41,0.14)] dark:hover:text-[#ffd1a0]"}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3 pt-6">
            <form action="/api/auth/logout" method="post">
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#F69629] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#e5871e] hover:shadow-[0_12px_24px_rgba(246,150,41,0.28)] dark:text-[#2F3437] dark:hover:bg-[#ffab4b]"
                type="submit"
              >
                Sign out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
