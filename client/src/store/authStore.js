// store/authStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const DEFAULT_PREFS = { theme: "system", accent: "blue" };

export const useAuth = create(
  persist(
    (set, get) => ({
      admin: null,
      preferences: DEFAULT_PREFS,

      // ✅ 1. Initialize the timer state
      sessionExpiresAt: null,

      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      login: (data) => {
        const admin = data?.admin ?? data?.payload ?? data ?? null;

        // ✅ 2. Extract the expiration time from the payload
        const sessionExpiresAt =
          data?.sessionExpiresAt ??
          data?.payload?.sessionExpiresAt ??
          admin?.sessionExpiresAt ??
          null;

        const prefs = admin?.preferences
          ? { ...DEFAULT_PREFS, ...admin.preferences }
          : DEFAULT_PREFS;

        // ✅ 3. Save it to state
        set({ admin, preferences: prefs, sessionExpiresAt });
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
          preferences: DEFAULT_PREFS,
          // ✅ 4. Clear the timer on logout
          sessionExpiresAt: null,
        });

        localStorage.removeItem("auth");
      },
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        preferences: state.preferences,
        // ✅ 5. Persist the timer! If you don't add it here, the timer
        // will break if the user hits the "refresh" button on their browser.
        sessionExpiresAt: state.sessionExpiresAt,
      }),

      onRehydrateStorage: () => (state, error) => {
        if (error) console.error("Auth rehydrate error:", error);
        state?.setHasHydrated(true);
      },
    },
  ),
);
