import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Vite defaults to Lightning CSS for minification when it's present in
    // node_modules, which rewrites `@media (max-width: 768px)` into the
    // modern range syntax `@media (width <= 768px)`. That syntax is valid
    // but unsupported on older phone browsers (pre-Chrome 104 / pre-Safari
    // 16.4) — common on budget/older Android devices in our target market —
    // and an unsupported media feature makes the whole block silently not
    // match, so every responsive layout in the app falls back to desktop.
    // This Vite version bundles Rolldown, not esbuild, so 'esbuild' isn't a
    // valid cssMinify target here — disabling minification entirely is the
    // simplest way to keep the traditional, universally-supported syntax.
    // The unminified CSS is ~35KB; gzip over the wire makes the size delta
    // negligible against correctness on real devices.
    cssMinify: false
  }
})
