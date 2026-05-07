import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserConfigFormInput } from "@/lib/schemas";

type Classification = "ALL" | "EXECUTABLE" | "MARGINAL" | "INVALID";

type Notification = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

type DashboardStore = {
  activeClassification: Classification;
  setClassification: (c: Classification) => void;

  localConfig: Partial<UserConfigFormInput>;
  setLocalConfig: (patch: Partial<UserConfigFormInput>) => void;
  isDirty: boolean;
  markClean: () => void;

  notifications: Notification[];
  addNotification: (n: Omit<Notification, "id">) => void;
  dismissNotification: (id: string) => void;

  /** Zona horaria para mostrar timestamps. "local" = detectar del navegador. */
  displayTimezone: string;
  setDisplayTimezone: (tz: string) => void;

  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;

  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      activeClassification: "ALL",
      setClassification: (c) => set({ activeClassification: c }),

      localConfig: {},
      setLocalConfig: (patch) =>
        set((s) => ({
          localConfig: { ...s.localConfig, ...patch },
          isDirty: true,
        })),
      isDirty: false,
      markClean: () => set({ isDirty: false }),

      notifications: [],
      addNotification: (n) =>
        set((s) => ({
          notifications: [
            ...s.notifications,
            { ...n, id: Math.random().toString(36).slice(2) },
          ],
        })),
      dismissNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),

      displayTimezone: "local",
      setDisplayTimezone: (tz) => set({ displayTimezone: tz }),

      isSidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),

      isMobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
    }),
    {
      name: "aim-dashboard",
      partialize: (s) => ({
        activeClassification: s.activeClassification,
        displayTimezone: s.displayTimezone,
      }),
    },
  ),
);
