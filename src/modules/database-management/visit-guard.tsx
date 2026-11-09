"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
const entry = "/settings/database-management";
// Defense in depth for bfcache/tab departure. Every action also checks SQLite.
export function ManagementVisitGuard({ fingerprint }: { fingerprint: string }) {
  const pathname = usePathname();
  const login = pathname.startsWith("/setup") ? "/setup" : entry;
  useEffect(() => {
    const leave = () => {
      document.documentElement.style.visibility = "hidden";
      navigator.sendBeacon(
        entry + "/leave?visit=" + encodeURIComponent(fingerprint),
      );
    };
    const validate = async () => {
      try {
        const response = await fetch(entry + "/session", { cache: "no-store" });
        if (response.status === 401) window.location.replace(login);
      } catch {
        // A managed activation briefly closes the listener. Do not destroy the
        // current visit merely because a health request overlaps that restart.
      }
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.replace(login);
    };
    const focus = () => {
      void validate();
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", show);
    window.addEventListener("focus", focus);
    const timer = window.setInterval(focus, 30000);
    void validate();
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("focus", focus);
      window.clearInterval(timer);
    };
  }, [fingerprint, login]);
  return null;
}
