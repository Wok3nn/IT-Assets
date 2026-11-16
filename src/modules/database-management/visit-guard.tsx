"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
const entry = "/settings/database-management";
// Defense in depth for bfcache/tab departure. Every action also checks SQLite.
export function ManagementVisitGuard({ fingerprint }: { fingerprint: string }) {
  const pathname = usePathname();
  const login = pathname.startsWith("/setup") ? "/setup" : entry;
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest("a");
      if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0 || anchor.target === "_blank") return;
      const target = new URL(anchor.href, location.href);
      if (target.origin === location.origin && (target.pathname.startsWith(entry + "/") || target.pathname === "/setup/workspace")) return;
      // A document navigation reaches the authoritative revocation boundary even
      // when Next already has a destination cached from the workspace session.
      if (target.origin === location.origin) { event.preventDefault(); window.location.assign(target.href); }
    };
    document.addEventListener("click", navigate, true);
    const validate = async () => {
      try {
        const response = await fetch(entry + "/session", { cache: "no-store" });
        if (response.status === 401) {
          const step = new URLSearchParams(location.search).get("step") || "3";
          window.location.replace(login + (login === "/setup" ? "?message=Session%20expired.%20Sign%20in%20to%20resume.&returnStep=" + (/^[1-5]$/.test(step) ? step : "3") : ""));
        }
      } catch {
        // A managed activation briefly closes the listener. Do not destroy the
        // current visit merely because a health request overlaps that restart.
      }
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) void validate();
    };
    const focus = () => {
      void validate();
    };
    window.addEventListener("pageshow", show);
    window.addEventListener("focus", focus);
    const timer = window.setInterval(focus, 30000);
    void validate();
    return () => {
      document.removeEventListener("click", navigate, true);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("focus", focus);
      window.clearInterval(timer);
    };
  }, [fingerprint, login]);
  return null;
}
