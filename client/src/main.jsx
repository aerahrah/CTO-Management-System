import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

// ✅ PWA
import { registerSW } from "virtual:pwa-register";

// ✅ 1. Inject the defaultOptions to handle retries globally
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.response?.status;

        // If it's an Auth Error or Rate Limit Error, abort retries immediately
        if (status === 401 || status === 403 || status === 429) {
          return false;
        }

        // Otherwise, fallback to the standard 3 retries (for network blips, 500s, etc.)
        return failureCount < 3;
      },

      // ✅ 2. (Optional but recommended) Disable window focus refetching
      // If true, minimizing and maximizing the browser triggers an API call.
      refetchOnWindowFocus: false,
    },
  },
});

// ✅ Register Service Worker (PWA)
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const ok = window.confirm("New version available. Reload now?");
    if (ok) updateSW(true);
  },
  onOfflineReady() {
    console.log("App is ready to work offline.");
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
