import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.IT_ASSETS_MANAGED_BUILD === "1" || process.env.IT_ASSETS_MANAGED === "1" ? undefined : "standalone",
  distDir: process.env.IT_ASSETS_MANAGED_DEV === "1" ? ".next-managed-dev" :
    process.env.IT_ASSETS_MANAGED_BUILD === "1" || process.env.IT_ASSETS_MANAGED === "1" ? ".next-managed" : ".next",
  serverExternalPackages: ["@it-assets/sqlserver-client"],
};

export default nextConfig;
