import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import {
  BarChart3,
  Boxes,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Icon,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sidebar,
  Sun,
  Users,
  type IconProps,
} from "@pantaetl/ui";

import { t } from "../locales/index.js";
import { useTheme } from "../theme-provider.js";

interface NavigationItem {
  readonly icon: IconProps["icon"];
  readonly key: "navigation.overview" | "navigation.pipelines" | "navigation.runs" | "navigation.plugins" | "navigation.system" | "navigation.users" | "navigation.settings";
  readonly to: string;
}

/** Product destinations presented in the primary keyboard-accessible navigation. */
export const navigationItems: readonly NavigationItem[] = [
  { icon: BarChart3, key: "navigation.overview", to: "/" },
  { icon: Network, key: "navigation.pipelines", to: "/pipelines" },
  { icon: Boxes, key: "navigation.runs", to: "/runs" },
  { icon: Boxes, key: "navigation.plugins", to: "/plugins" },
  { icon: ShieldCheck, key: "navigation.system", to: "/system" },
  { icon: Users, key: "navigation.users", to: "/users" },
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "pantaetl.sidebar-collapsed";

/** Restrained control-plane shell used by every authenticated product screen. */
export function AppShell({ children }: { readonly children: ReactNode }) {
  const location = useRouterState({ select: (state) => state.location.pathname });
  const { setTheme, theme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";
  const [hydrated, setHydrated] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
  }, []);

  /** Toggles and persists the desktop navigation width preference. */
  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="app-shell" data-hydrated={hydrated ? "true" : "false"}>
      <Sidebar
        aria-label={t("navigation.menu")}
        className="app-sidebar"
        collapsed={sidebarCollapsed}
        footer={
          <div className="app-sidebar__bottom">
            <Link aria-label={t("navigation.settings")} className={location === "/settings" ? "app-navigation__link app-navigation__link--active" : "app-navigation__link"} to="/settings">
              <Icon icon={Settings} size={16} />
              <span data-sidebar-label>{t("navigation.settings")}</span>
            </Link>
            <Button aria-label={t("navigation.theme")} className="app-theme-button" onClick={() => setTheme(nextTheme)} variant="ghost">
              <Icon icon={nextTheme === "dark" ? Moon : Sun} size={16} />
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <button aria-label={t("account.menu")} className="app-user" type="button">
                  <span className="app-user__avatar" aria-hidden="true">{t("shell.userInitial")}</span>
                  <span data-sidebar-label><strong>{t("shell.user")}</strong><small>{t("shell.product")}</small></span>
                </button>
              </DialogTrigger>
              <DialogContent aria-describedby="account-menu-description" closeLabel={t("account.menu")}>
                <DialogTitle>{t("account.title")}</DialogTitle>
                <DialogDescription id="account-menu-description">{t("account.description")}</DialogDescription>
                <div className="app-account-menu">
                  <Link to="/users">{t("account.users")}</Link>
                  <Link to="/settings">{t("account.settings")}</Link>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
        header={
          <div className="app-sidebar__header">
            <Link aria-label={t("app.name")} className="app-brand" to="/">
              <span aria-hidden="true" className="app-brand__mark">{t("shell.brandMark")}</span>
              <span data-sidebar-label>{t("app.name")}</span>
            </Link>
            <Button
              aria-label={sidebarCollapsed ? t("navigation.expand") : t("navigation.collapse")}
              className="app-sidebar__collapse"
              onClick={toggleSidebar}
              variant="ghost"
            >
              <Icon icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose} size={16} />
            </Button>
          </div>
        }
        navigation={
          <nav aria-label={t("navigation.menu")} className="app-navigation">
            {navigationItems.map((item) => (
              <Link aria-label={t(item.key)} className={location === item.to ? "app-navigation__link app-navigation__link--active" : "app-navigation__link"} key={item.to} to={item.to}>
                <Icon icon={item.icon} size={16} />
                <span data-sidebar-label>{t(item.key)}</span>
              </Link>
            ))}
          </nav>
        }
      />
      <main className="app-content">{children}</main>
    </div>
  );
}
