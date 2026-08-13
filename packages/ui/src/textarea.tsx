import { cx } from "./classnames.js";
import type { TextareaHTMLAttributes } from "react";

/** Textarea props styled with the shared semantic form-control tokens. */
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Renders a standard textarea with the same accessible invalid state as other form controls. */
export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cx("ui-textarea", className)} {...props} />;
}
