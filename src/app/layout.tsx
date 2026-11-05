import type { Metadata } from "next";

import { appConfig } from "@/services/config";
import "./globals.css";

const APP_TITLE = "IT-Asset-Tracker";
const APP_DESCRIPTION = "A modern self-hosted asset management platform.";
const STATIC_LIGHT_ICON_32_PATH = "/branding/asset-tracker-logo-light-transparent-32.png";
const STATIC_DARK_ICON_32_PATH = "/branding/asset-tracker-logo-dark-transparent-32.png";
const STATIC_LIGHT_ICON_64_PATH = "/branding/asset-tracker-logo-light-transparent-64.png";
const STATIC_DARK_ICON_64_PATH = "/branding/asset-tracker-logo-dark-transparent-64.png";
const STATIC_LIGHT_ICON_PATH = "/branding/asset-tracker-logo-light-transparent.ico";
const STATIC_DARK_ICON_PATH = "/branding/asset-tracker-logo-dark-transparent.ico";
const STATIC_LIGHT_LOGO_PATH = "/branding/asset-tracker-logo-light-transparent.png";
const STATIC_DARK_LOGO_PATH = "/branding/asset-tracker-logo-dark-transparent.png";

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
      { url: STATIC_LIGHT_ICON_32_PATH, media: "(prefers-color-scheme: light)", sizes: "32x32", type: "image/png" },
      { url: STATIC_LIGHT_ICON_64_PATH, media: "(prefers-color-scheme: light)", sizes: "64x64", type: "image/png" },
      { url: STATIC_DARK_ICON_32_PATH, media: "(prefers-color-scheme: dark)", sizes: "32x32", type: "image/png" },
      { url: STATIC_DARK_ICON_64_PATH, media: "(prefers-color-scheme: dark)", sizes: "64x64", type: "image/png" },
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
    images: [STATIC_DARK_LOGO_PATH],
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
  // A tab rendered against an earlier inventory must not submit an old edit to
  // the newly selected database, even after another tab signs in there.
  const revision = process.env.IT_ASSETS_MANAGED === "1" ? Number(process.env.IT_ASSETS_REVISION) : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {revision !== null && <script dangerouslySetInnerHTML={{ __html: `
          (() => {
            const revision = ${JSON.stringify(String(revision))}, send = window.fetch.bind(window);
            window.fetch = (input, init = {}) => {
              const req = input instanceof Request ? input : null;
              const url = new URL(req ? req.url : input, location.href);
              if (url.origin === location.origin && !['GET','HEAD','OPTIONS'].includes((init.method || req?.method || 'GET').toUpperCase())) {
                const headers = new Headers(init.headers || req?.headers); headers.set('x-it-assets-revision',revision);
                return send(input,{...init,headers});
              }
              return send(input,init);
            };
            document.addEventListener('submit', event => {
              const f=event.target;
              if(f instanceof HTMLFormElement && f.method.toLowerCase()==='post'){
                const u=new URL(f.action || location.href,location.href);
                if(u.origin===location.origin){u.searchParams.set('_inventory',revision);f.action=u.href;}
              }
            },true);
          })();
        ` }} />}
        {children}
      </body>
    </html>
  );
}

