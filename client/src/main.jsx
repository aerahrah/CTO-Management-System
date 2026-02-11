import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

// ✅ PWA
import { registerSW } from "virtual:pwa-register";

const queryClient = new QueryClient();

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
