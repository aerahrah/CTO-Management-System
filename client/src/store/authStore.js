// store/authStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const DEFAULT_PREFS = { theme: "system", accent: "blue" };

export const useAuth = create(
  persist(
    (set, get) => ({
      admin: null,
      preferences: DEFAULT_PREFS,

      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      login: (data) => {
        // The browser automatically handles the HttpOnly cookie now.
        // We only need to store the user profile/admin data.
        const admin = data?.admin ?? data?.payload ?? null;

        const prefs = admin?.preferences
          ? { ...DEFAULT_PREFS, ...admin.preferences }
          : DEFAULT_PREFS;

        set({ admin, preferences: prefs });
      },

      setPreferences: (prefs) => {
        const current = get().preferences || DEFAULT_PREFS;
        const merged = { ...current, ...(prefs || {}) };

        set((state) => ({
          preferences: merged,
          admin: state.admin
            ? { ...state.admin, preferences: merged }
            : state.admin,
        }));
      },

      logout: () => {
        // Clear the state
        set({
          admin: null,
          preferences: DEFAULT_PREFS,
        });

        localStorage.removeItem("auth");

        // ⚠️ IMPORTANT: Your UI component must now also make an API call
        // to your new backend /logout endpoint to clear the cookie!
      },
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => localStorage),

      // ✅ NEW: Partialize ensures ONLY preferences are saved to localStorage.
      // The admin object will clear on refresh, requiring a fresh fetch from the server.
      partialize: (state) => ({
        preferences: state.preferences,
      }),

      onRehydrateStorage: () => (state, error) => {
        if (error) console.error("Auth rehydrate error:", error);
        state?.setHasHydrated(true);
      },
    },
  ),
);
