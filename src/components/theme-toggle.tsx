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
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 text-sm font-medium text-slate-700 shadow-panel backdrop-blur transition hover:border-[#f0c48d] hover:bg-white hover:text-[#b56613] dark:border-[#5a4a36] dark:bg-[#34393c] dark:text-[#fff3e4] dark:shadow-[0_16px_30px_rgba(0,0,0,0.24)] dark:hover:border-[#F69629] dark:hover:bg-[rgba(246,150,41,0.16)] dark:hover:text-[#ffd7ab]",
        collapsed ? "h-11 w-11 rounded-[18px] px-0" : "w-full px-4 py-3",
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
