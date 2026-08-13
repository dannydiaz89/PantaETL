import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

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
  Settings,
  ShieldCheck,
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

/** Restrained control-plane shell used by every authenticated product screen. */
export function AppShell({ children }: { readonly children: ReactNode }) {
  const location = useRouterState({ select: (state) => state.location.pathname });
  const { setTheme, theme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-brand" to="/">
          <span aria-hidden="true" className="app-brand__mark">{t("shell.brandMark")}</span>
          <span>{t("app.name")}</span>
        </Link>
        <nav aria-label={t("navigation.menu")} className="app-navigation">
          {navigationItems.map((item) => (
            <Link className={location === item.to ? "app-navigation__link app-navigation__link--active" : "app-navigation__link"} key={item.to} to={item.to}>
              <Icon icon={item.icon} size={16} />
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="app-sidebar__bottom">
          <Link className={location === "/settings" ? "app-navigation__link app-navigation__link--active" : "app-navigation__link"} to="/settings">
            <Icon icon={Settings} size={16} />
            {t("navigation.settings")}
          </Link>
          <Button aria-label={t("navigation.theme")} className="app-theme-button" onClick={() => setTheme(nextTheme)} variant="ghost">
            <Icon icon={nextTheme === "dark" ? Moon : Sun} size={16} />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <button aria-label={t("account.menu")} className="app-user" type="button">
                <span className="app-user__avatar" aria-hidden="true">{t("shell.userInitial")}</span>
                <span><strong>{t("shell.user")}</strong><small>{t("shell.product")}</small></span>
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
      </aside>
      <main className="app-content">{children}</main>
    </div>
  );
}
