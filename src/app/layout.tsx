import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "IT-Asset-Tracker",
  description: "A modern self-hosted asset management platform.",
  icons: {
    icon: [
      { url: "/api/branding/icon/light", media: "(prefers-color-scheme: light)" },
      { url: "/api/branding/icon/dark", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/api/branding/icon/light",
  },
};

const themeScript = `
(() => {
  try {
    const savedTheme = window.localStorage.getItem("theme");
    const theme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}

