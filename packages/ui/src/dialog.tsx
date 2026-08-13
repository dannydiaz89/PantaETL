import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cx } from "./classnames.js";
import { Icon } from "./icon.js";

/** Re-exported controlled dialog root without exposing the Radix package. */
export const Dialog = DialogPrimitive.Root;
/** Re-exported dialog trigger without exposing the Radix package. */
export const DialogTrigger = DialogPrimitive.Trigger;
/** Re-exported dialog close control without exposing the Radix package. */
export const DialogClose = DialogPrimitive.Close;

/** Props for the focused, labelled dialog content region. */
export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  readonly children: ReactNode;
  readonly closeLabel: string;
}

/** Renders a modal content surface with focus trapping and a labelled close action. */
export function DialogContent({ children, className, closeLabel, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-dialog__overlay" />
      <DialogPrimitive.Content className={cx("ui-dialog__content", className)} {...props}>
        {children}
        <DialogPrimitive.Close aria-label={closeLabel} className="ui-dialog__close">
          <Icon icon={X} size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Re-exported accessible dialog title. */
export const DialogTitle = DialogPrimitive.Title;
/** Re-exported accessible dialog description. */
export const DialogDescription = DialogPrimitive.Description;
