import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "logo_dict.png"],
        manifest: {
          name: "CTO Management System",
          short_name: "CTO Portal",
          description: "CTO Management System",
          theme_color: "#0f0f0f",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "logo_dict.png", sizes: "192x192", type: "image/png" },
            { src: "logo_dict.png", sizes: "512x512", type: "image/png" },
          ],
        },

        workbox: {
          navigateFallback: "/index.html",

          // prevent SW from treating these as SPA navigations
          navigateFallbackDenylist: [
            /^\/settings\//,
            /^\/cto\//,
            /^\/auth\//,
            /^\/uploads\//,
          ],

          runtimeCaching: [
            {
              // Don’t cache backend endpoints
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/settings/") ||
                url.pathname.startsWith("/cto/") ||
                url.pathname.startsWith("/auth/") ||
                url.pathname.startsWith("/uploads/"),
              handler: "NetworkOnly",
            },
          ],

          // ✅ allow precaching bundles > 2MiB (fixes your build failure)
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },

        // disable SW in dev
        devOptions: { enabled: false },
      }),
    ],

    build: {
      outDir: "../backend/public",
      emptyOutDir: true,
    },

    server: {
      proxy: {
        "/settings": "https://cto.dictr2.online",
        "/cto": "https://cto.dictr2.online",
        "/auth": "https://cto.dictr2.online",
      },
    },
  };
});
