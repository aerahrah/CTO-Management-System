// src/api/userPreferencesApi.js
import API from "./api";

/**
 * Mounted backend route:
 * app.use("/api/settings/preferences", userPreferenceRoutes);
 *
 * So all endpoints below are under:
 * /settings/preferences/...
 */

// ✅ GET my preferences (theme + accent)
export const fetchMyPreferences = async () => {
  const { data } = await API.get("/settings/preferences/me");
  return data; // { preferences: { theme, accent } }
};

// ✅ UPDATE my preferences (partial)
export const updateMyPreferences = async (preferences) => {
  // preferences: { theme?: "system"|"light"|"dark", accent?: "blue"|"pink"|... }
  const { data } = await API.patch("/settings/preferences/me", preferences);
  return data; // { message, preferences }
};

// ✅ RESET my preferences to defaults
export const resetMyPreferences = async () => {
  const { data } = await API.post("/settings/preferences/me/reset");
  return data; // { message, preferences }
};

// ✅ GET allowed options (enums + defaults)
export const fetchPreferenceOptions = async () => {
  const { data } = await API.get("/settings/preferences/options");
  return data; // { themes: [...], accents: [...], defaults: {...} }
};
