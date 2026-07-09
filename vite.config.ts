import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Dev-only: port of the standalone backend the /api proxy targets. The
  // backend runs on 5002 (see issa-beauty-backend/.env); override with PORT if needed.
  const PORT = env.PORT ? parseInt(env.PORT) : 5002;
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["apple-touch-icon.png", "issa_beauty.svg"],
        manifest: {
          id: "issa-beauty-store",
          name: "Issa Beauty",
          short_name: "Issa Beauty",
          description:
            "Carefully curated beauty and skincare from Issa Beauty, Tripoli, Lebanon.",
          start_url: "/",
          scope: "/",
          lang: "en",
          // Accent WebAPK splash: brand pink fills the launch screen with the
          // (matching-tile) logo centered. The runtime <meta name="theme-color">
          // takes over the status bar once the app loads.
          theme_color: "#e11d48",
          background_color: "#e11d48",
          display: "standalone",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/maskable-icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          // The API is cross-origin (api.issabeauty.org); only same-origin SPA
          // routes should fall back to the app shell.
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Product/banner imagery is served from ImageKit — cache it so
              // repeat visits and flaky connections render instantly.
              urlPattern: ({ url }) => url.origin === "https://ik.imagekit.io",
              handler: "CacheFirst",
              options: {
                cacheName: "imagekit-images",
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:" + PORT,
        },
      },
    },
  };
});
