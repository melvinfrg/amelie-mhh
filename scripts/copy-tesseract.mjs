// Copies the OCR worker, engine and language data into public/, so label detection
// works without loading code from a third-party CDN.
import { cpSync, mkdirSync } from "node:fs";

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
