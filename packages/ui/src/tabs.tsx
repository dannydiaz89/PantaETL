import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";

import { cx } from "./classnames.js";

/** Re-exported keyboard-navigable tabs root. */
export const Tabs = TabsPrimitive.Root;

/** Renders the tab list with semantic styles. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cx("ui-tabs", className)} {...props} />;
}

/** Renders one keyboard-navigable tab trigger. */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cx("ui-tabs__trigger", className)} {...props} />;
}

/** Re-exported tabs panel with Radix keyboard semantics. */
export const TabsContent = TabsPrimitive.Content;
