import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  // load envs if needed later
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
        // Important for SPA routing (React Router)
        workbox: {
          navigateFallback: "/index.html",
          runtimeCaching: [
            {
              // Don't cache API
              urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
              handler: "NetworkOnly",
            },
          ],
        },
        // only enable SW in dev if you really want it
        devOptions: { enabled: mode === "development" },
      }),
    ],

    // Build Vite output into backend so backend can serve it
    build: {
      outDir: "../backend/public",
      emptyOutDir: true,
    },

    // Dev only: proxy /api -> backend so you avoid CORS locally
    server: {
      proxy: {
        "/api": "http://localhost:3000",
      },
    },
  };
});
