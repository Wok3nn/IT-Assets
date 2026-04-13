import type { Metadata } from "next";

import { appConfig } from "@/services/config";
import { getGeneralSettings } from "@/modules/settings/settings.service";
import "./globals.css";

const APP_DESCRIPTION = "A modern self-hosted asset management platform.";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getGeneralSettings();
  const appTitle = settings.appTitle;

  return {
    metadataBase: new URL(appConfig.appUrl),
    title: {
      default: appTitle,
      template: `%s | ${appTitle}`,
    },
    description: APP_DESCRIPTION,
    applicationName: appTitle,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/api/branding/icon/light", media: "(prefers-color-scheme: light)" },
        { url: "/api/branding/icon/dark", media: "(prefers-color-scheme: dark)" },
      ],
      shortcut: "/api/branding/icon/light",
      apple: [{ url: "/api/branding/icon/light" }],
    },
    openGraph: {
      title: appTitle,
      description: APP_DESCRIPTION,
      siteName: appTitle,
      images: [{ url: "/api/branding/logo/light" }],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: appTitle,
      description: APP_DESCRIPTION,
      images: ["/api/branding/logo/light"],
    },
  };
}

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

