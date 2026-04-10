"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ChevronLeft, ChevronRight, FolderTree, LayoutDashboard, LogOut, MapPin, Settings2, Shield, Tags, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppLogo } from "@/components/branding/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "app-shell-sidebar-collapsed";
let cachedSidebarCollapsed: boolean | null = null;

const navItems = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "assets", href: "/assets", label: "Assets", icon: Boxes },
  { id: "categories", href: "/categories", label: "Categories", icon: FolderTree },
  { id: "departments", href: "/scopes", label: "Departments", icon: Shield },
  { id: "labels", href: "/labels", label: "Labels", icon: Tags },
  { id: "users", href: "/users", label: "Users", icon: Users },
  { id: "locations", href: "/locations", label: "Locations", icon: MapPin },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings2 },
] as const;

type AppShellClientProps = {
  appTitle: string;
  branding: {
    lightLogoUrl: string;
    darkLogoUrl: string;
  };
  children: React.ReactNode;
  visibleNavItemIds: string[];
};

export function AppShellClient({ appTitle, branding, children, visibleNavItemIds }: AppShellClientProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => cachedSidebarCollapsed ?? false);
  const [isReady, setIsReady] = useState(() => cachedSidebarCollapsed !== null);

  const renderedNavItems = useMemo(
    () => navItems.filter((item) => visibleNavItemIds.includes(item.id)),
    [visibleNavItemIds],
  );

  const activeHref = useMemo(() => {
    const matches = renderedNavItems.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    if (matches.length === 0) {
      return null;
    }

    return matches.sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null;
  }, [pathname, renderedNavItems]);

  useEffect(() => {
    const savedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    cachedSidebarCollapsed = savedValue;
    setIsCollapsed(savedValue);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    cachedSidebarCollapsed = isCollapsed;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed, isReady]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_24%),linear-gradient(180deg,#fcfcfd_0%,#f6f7f9_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_24%),linear-gradient(180deg,#2f3437_0%,#2c3134_52%,#292e31_100%)]">
      <div className="flex h-full w-full lg:gap-3">
        <div className="hidden shrink-0 lg:block">
          <aside
            className={cn(
              "flex h-full shrink-0 flex-col overflow-hidden rounded-r-[32px] border-y border-r border-[#ece7df] bg-white/94 shadow-[18px_0_42px_rgba(15,23,42,0.08)] backdrop-blur transition-[width] duration-150 ease-out dark:border-[#464c4f] dark:bg-[#383d40]/94 dark:shadow-[18px_0_42px_rgba(0,0,0,0.18)]",
              isCollapsed ? "w-[104px]" : "w-72",
              !isReady ? "opacity-0" : "opacity-100",
            )}
          >
            <div className={cn("border-b border-[#efe8df] dark:border-[#464c4f]", isCollapsed ? "px-3 pb-4 pt-5" : "px-5 pb-5 pt-6")}>
              {isCollapsed ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-[#f2c28c]/70 bg-[rgba(246,150,41,0.08)] dark:border-[#7f5a2d]/80 dark:bg-[rgba(246,150,41,0.12)]">
                    <AppLogo className="h-11 w-11 drop-shadow-[0_12px_18px_rgba(246,150,41,0.18)] dark:drop-shadow-[0_14px_22px_rgba(0,0,0,0.24)]" darkSrc={branding.darkLogoUrl} lightSrc={branding.lightLogoUrl} />
                  </div>
                  <button
                    aria-label="Expand sidebar"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-600 shadow-panel transition-colors hover:border-[#F69629]/45 hover:text-[#b56613] dark:border-[#4f565a] dark:bg-[#34393c] dark:text-slate-200 dark:hover:border-[#F69629]/55 dark:hover:text-[#ffd7ab]"
                    onClick={() => setIsCollapsed(false)}
                    title="Expand sidebar"
                    type="button"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-[#f2c28c]/70 bg-[rgba(246,150,41,0.08)] dark:border-[#7f5a2d]/80 dark:bg-[rgba(246,150,41,0.12)]">
                      <AppLogo className="h-12 w-12 drop-shadow-[0_12px_18px_rgba(246,150,41,0.18)] dark:drop-shadow-[0_14px_22px_rgba(0,0,0,0.24)]" darkSrc={branding.darkLogoUrl} lightSrc={branding.lightLogoUrl} />
                    </div>
                  </div>
                  <button
                    aria-label="Collapse sidebar"
                    className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-600 shadow-panel transition-colors hover:border-[#F69629]/45 hover:text-[#b56613] dark:border-[#4f565a] dark:bg-[#34393c] dark:text-slate-200 dark:hover:border-[#F69629]/55 dark:hover:text-[#ffd7ab]"
                    onClick={() => setIsCollapsed(true)}
                    title="Collapse sidebar"
                    type="button"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <nav className={cn("min-h-0 flex-1 overflow-y-auto", isCollapsed ? "px-3 py-4" : "px-4 py-5 pr-4")}>
              <div className={cn(isCollapsed ? "space-y-2" : "space-y-2")}>
                {renderedNavItems.map(({ href, label, icon: Icon }) => {
                  const isActive = activeHref === href;

                  return (
                    <div key={href}>
                      <Link
                        href={href}
                        className={isActive
                          ? cn(
                              "text-sm font-medium text-[#b56613] transition-colors dark:text-[#ffd7ab]",
                              isCollapsed
                                ? "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#f2c28c] bg-[rgba(246,150,41,0.16)] shadow-[0_10px_22px_rgba(246,150,41,0.12)] dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.22)] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                                : "flex items-center gap-3 rounded-2xl border border-[#f2c28c] bg-[rgba(246,150,41,0.16)] px-4 py-3 shadow-[0_10px_22px_rgba(246,150,41,0.12)] dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.22)] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]",
                            )
                          : cn(
                              "text-sm text-slate-700 transition-colors hover:bg-[rgba(246,150,41,0.12)] hover:text-[#b56613] dark:text-slate-100 dark:hover:bg-[rgba(246,150,41,0.18)] dark:hover:text-[#ffd1a0]",
                              isCollapsed
                                ? "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                                : "flex items-center gap-3 rounded-2xl px-4 py-3",
                            )}
                        title={isCollapsed ? label : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {isCollapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </nav>

            <div className={cn("shrink-0 border-t border-[#efe8df] dark:border-[#464c4f]", isCollapsed ? "px-3 py-4" : "px-4 py-5")}>
              {isCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <form action="/api/auth/logout" method="post">
                    <button
                      aria-label="Sign out"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F69629] text-white transition-colors hover:bg-[#e5871e] hover:shadow-[0_12px_24px_rgba(246,150,41,0.28)] dark:text-[#2F3437] dark:hover:bg-[#ffab4b]"
                      title="Sign out"
                      type="submit"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </form>
                  <ThemeToggle collapsed />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#efe8df] bg-slate-50/80 px-3.5 py-3 dark:border-[#464c4f] dark:bg-[#34393c]/80">
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Application</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-[#fff3e4]" title={appTitle}>{appTitle}</p>
                  </div>
                  <form action="/api/auth/logout" method="post">
                    <button
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-[#F69629] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#e5871e] hover:shadow-[0_12px_24px_rgba(246,150,41,0.28)] dark:text-[#2F3437] dark:hover:bg-[#ffab4b]"
                      type="submit"
                    >
                      Sign out
                    </button>
                  </form>
                  <ThemeToggle />
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <main className="min-w-0 px-4 py-6 lg:px-5 lg:pl-4 2xl:px-7 2xl:pl-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
