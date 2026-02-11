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
          name: "Employee Management System",
          short_name: "EMS",
          description: "Employee Management System",
          theme_color: "#0ea5e9",
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

          // ✅ IMPORTANT: your backend routes are NOT under /api
          // prevent SW from treating these as SPA navigations / caching them
          navigateFallbackDenylist: [/^\/settings\//, /^\/cto\//, /^\/auth\//],

          runtimeCaching: [
            {
              // ✅ Don’t cache backend endpoints (match your real routes)
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/settings/") ||
                url.pathname.startsWith("/cto/") ||
                url.pathname.startsWith("/auth/"),
              handler: "NetworkOnly",
            },
          ],
        },

        // ✅ disable SW in dev (removes dev-dist warnings)
        devOptions: { enabled: false },
      }),
    ],

    build: {
      outDir: "../backend/public",
      emptyOutDir: true,
    },

    server: {
      proxy: {
        // ✅ You’re not using /api in your frontend calls, so proxy these too
        "/settings": "http://localhost:3000",
        "/cto": "http://localhost:3000",
        "/auth": "http://localhost:3000",
      },
    },
  };
});
