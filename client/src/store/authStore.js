// store/authStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const DEFAULT_PREFS = { theme: "system", accent: "blue" };

export const useAuth = create(
  persist(
    (set, get) => ({
      admin: null,
      token: null,
      preferences: DEFAULT_PREFS,

      // ✅ NEW: hydration flag
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      login: (data) => {
        const token = data?.token ?? null;
        const admin = data?.admin ?? data?.payload ?? null;

        const prefs = admin?.preferences
          ? { ...DEFAULT_PREFS, ...admin.preferences }
          : DEFAULT_PREFS;

        set({ token, admin, preferences: prefs });
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
        set({
          admin: null,
          token: null,
          preferences: DEFAULT_PREFS,
        });
        // optional: also clear persisted storage
        localStorage.removeItem("auth");
      },
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => localStorage),

      // ✅ This runs when persist rehydrates from localStorage
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error("Auth rehydrate error:", error);
        state?.setHasHydrated(true);
      },
    },
  ),
);
