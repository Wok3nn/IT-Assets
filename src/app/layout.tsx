import type { Metadata } from "next";

import { appConfig } from "@/services/config";
import "./globals.css";

const APP_TITLE = "IT-Asset-Tracker";
const APP_DESCRIPTION = "A modern self-hosted asset management platform.";
const STATIC_LIGHT_ICON_PATH = "/branding/asset-tracker-logo-light-transparent.ico";
const STATIC_DARK_ICON_PATH = "/branding/asset-tracker-logo-dark-transparent.ico";
const STATIC_LIGHT_LOGO_PATH = "/branding/asset-tracker-logo-light-transparent.png";

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.appUrl),
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_TITLE}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_TITLE,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: STATIC_LIGHT_ICON_PATH, media: "(prefers-color-scheme: light)" },
      { url: STATIC_DARK_ICON_PATH, media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: STATIC_LIGHT_ICON_PATH,
    apple: [{ url: STATIC_LIGHT_LOGO_PATH }],
  },
  openGraph: {
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    siteName: APP_TITLE,
    images: [{ url: STATIC_LIGHT_LOGO_PATH }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [STATIC_LIGHT_LOGO_PATH],
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

