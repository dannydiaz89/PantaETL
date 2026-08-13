import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

/** Props for the accessible Lucide icon boundary exposed by the design system. */
export interface IconProps extends Omit<ComponentProps<LucideIcon>, "aria-label" | "aria-hidden"> {
  /** The Lucide icon to render. */
  readonly icon: LucideIcon;
  /** An accessible name when the icon communicates information by itself. */
  readonly label?: string;
}

/** Renders a Lucide icon with safe decorative and labelled accessibility defaults. */
export function Icon({ icon: IconComponent, label, ...props }: IconProps) {
  return (
    <IconComponent
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      focusable="false"
      role={label === undefined ? undefined : "img"}
      {...props}
    />
  );
}
