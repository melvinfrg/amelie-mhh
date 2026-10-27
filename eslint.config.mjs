import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copied OCR bundles, see scripts/copy-tesseract.mjs.
    "public/tesseract/**",
    // Die Batzi's: plain browser JS, copied as is from their own repository.
    "public/batzis/**",
    // Supabase Edge Functions run on Deno.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
