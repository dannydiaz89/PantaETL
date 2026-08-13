import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "./classnames.js";

/** Props for a viewport-bound application sidebar with caller-owned content. */
export interface SidebarProps extends Omit<ComponentPropsWithoutRef<"aside">, "children"> {
  readonly collapsed: boolean;
  readonly footer: ReactNode;
  readonly header: ReactNode;
  readonly navigation: ReactNode;
}

/**
 * Provides a viewport-height navigation rail with independently scrollable
 * navigation content and a compact collapsed presentation.
 */
export function Sidebar({
  className,
  collapsed,
  footer,
  header,
  navigation,
  ...props
}: SidebarProps) {
  return (
    <aside className={cx("ui-sidebar", className)} data-collapsed={collapsed ? "true" : "false"} {...props}>
      <div className="ui-sidebar__header">{header}</div>
      <div className="ui-sidebar__navigation">{navigation}</div>
      <div className="ui-sidebar__footer">{footer}</div>
    </aside>
  );
}
