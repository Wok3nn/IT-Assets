import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  { ignores: [".audit-runtime/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "data/**", "public/**", "next-env.d.ts", "scripts/seed.js"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];

export default config;
