"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark";

type ThemeToggleProps = {
  collapsed?: boolean;
};

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("theme", theme);
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const nextTheme: ThemeMode = savedTheme === "dark" ? "dark" : "light";
    applyTheme(nextTheme);
    setTheme(nextTheme);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  const label = mounted && theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300/85 bg-white/88 text-sm font-medium text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.08)] backdrop-blur transition hover:border-[#f0c48d] hover:bg-white hover:text-[#b56613] dark:border-[#596166] dark:bg-[#2f3437]/92 dark:text-slate-100 dark:shadow-[0_12px_24px_rgba(0,0,0,0.2)] dark:hover:border-[#F69629] dark:hover:bg-[#353b3f] dark:hover:text-[#ffe1be]",
        collapsed ? "h-10 w-10 rounded-[16px] px-0 text-slate-600 dark:text-slate-200" : "w-full px-4 py-3",
      )}
      onClick={toggleTheme}
      title={collapsed ? label : undefined}
      type="button"
    >
      {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </button>
  );
}
