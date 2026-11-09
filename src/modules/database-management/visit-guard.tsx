"use client";
import { useEffect } from "react";
const entry = "/settings/database-management";
// Defense in depth for bfcache/tab departure. Every action also checks SQLite.
export function ManagementVisitGuard({ fingerprint }: { fingerprint: string }) {
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
        if (response.status !== 204) window.location.replace(entry);
      } catch {
        window.location.replace(entry);
      }
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.replace(entry);
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
  }, [fingerprint]);
  return null;
}
