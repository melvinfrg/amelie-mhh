// Copies the OCR worker, engine and language data and the SQLite engine (for Anki decks)
// into public/, so these features work without loading code from a third-party CDN.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";

const out = "public/tesseract";
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });
cpSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/worker.min.js`);
for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
  cpSync(`node_modules/tesseract.js-core/tesseract-core-${variant}.wasm.js`, `${out}/core/tesseract-core-${variant}.wasm.js`);
}
for (const lang of ["deu", "lat"]) {
  cpSync(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `${out}/lang/${lang}.traineddata.gz`);
}

mkdirSync("public/sqljs", { recursive: true });
cpSync("node_modules/sql.js/dist/sql-wasm-browser.wasm", "public/sqljs/sql-wasm-browser.wasm");

// Die Batzi's are plain HTML/JS under public/batzis and can't read env vars, so they get the
// same Supabase project written into their config. Without it they run in demo mode.
writeFileSync(
  "public/batzis/js/config.js",
  `// Wird beim Build aus den Umgebungsvariablen erzeugt (scripts/copy-assets.mjs).
export const CONFIG = {
  SUPABASE_URL: ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")},
  SUPABASE_ANON_KEY: ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")},
};
`,
);
