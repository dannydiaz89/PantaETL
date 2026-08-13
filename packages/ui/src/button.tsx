import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./classnames.js";

/** Visual treatment for an action button. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Props shared by native and composed design-system buttons. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly asChild?: boolean;
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
}

/** Provides a consistent, keyboard-accessible action control. */
export function Button({ asChild = false, className, type, variant = "primary", ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cx("ui-button", `ui-button--${variant}`, className)}
      {...(!asChild ? { type: type ?? "button" } : {})}
      {...props}
    />
  );
}
