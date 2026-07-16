import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this app from a project subpath:
//   https://<username>.github.io/cornerman/
// so every asset URL, the PWA scope, and the service-worker registration must be
// prefixed with '/cornerman/'. The `base` below drives all of that.
//
// ROUTER CONTRACT (src/ is owned by another agent — not edited here):
//   `base` makes Vite expose `import.meta.env.BASE_URL === '/cornerman/'` at build time.
//   The React app's react-router must read its basename from that value, e.g.
//     <BrowserRouter basename={import.meta.env.BASE_URL}> ... </BrowserRouter>
//   (react-router tolerates the trailing slash). This is the only coupling between
//   this config and src/ — everything else flows from `base`.
const base = '/cornerman/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The lazy exercise-library chunk (~880 KB, data/exercise-library.json)
      // is precached by generateSW so the /exercises catalog works offline.
      // Workbox silently drops any file over its 2 MB default
      // (maximumFileSizeToCacheInBytes) — if that chunk ever outgrows it, set
      // the option explicitly in a `workbox: {}` block here.
      // We call useRegisterSW ourselves (src/lib/pwaUpdate.ts) so we can poll
      // for updates on an interval and on visibilitychange — a plain injected
      // register script only checks once, on initial load.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Cornerman',
        short_name: 'Cornerman',
        description: 'A coach in your corner. Plan the session, log the work, watch the numbers climb.',
        theme_color: '#0C0A08',
        background_color: '#0C0A08',
        display: 'standalone',
        // Scope + start_url must live under the Pages subpath so the installed PWA
        // launches into the app and the SW controls the right URL range.
        scope: base,
        start_url: base,
        // NOTE: no SVG->PNG converter (rsvg-convert / magick / inkscape) exists on
        // this machine, so the manifest ships SVG-only icons. If 192/512 PNGs are
        // ever rasterized from public/icon.svg, add them here for older launchers.
        // Icon paths are relative so they resolve under the '/cornerman/' base.
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // NOTE: the dev-only '/api' proxy was removed — the Hono/SQLite backend is gone;
  // the app now talks to Firebase directly from the client. Re-add a `server.proxy`
  // block here only if a local API is reintroduced.
})
