import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "IT-Asset-Tracker",
  description: "A modern self-hosted asset management platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
