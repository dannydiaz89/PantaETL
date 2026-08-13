import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cx } from "./classnames.js";
import { Icon } from "./icon.js";

/** Props for a labelled, keyboard-accessible checkbox. */
export interface CheckboxProps extends ComponentProps<typeof CheckboxPrimitive.Root> {
  readonly description?: string;
  readonly label: ReactNode;
}

/** Renders a Radix checkbox with an associated visible label and description. */
export function Checkbox({ className, description, label, ...props }: CheckboxProps) {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <div className="ui-checkbox-field">
      <CheckboxPrimitive.Root
        aria-describedby={description === undefined ? undefined : descriptionId}
        className={cx("ui-checkbox", className)}
        id={id}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="ui-checkbox__indicator">
          <Icon icon={Check} size={14} strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div>
        <label className="ui-checkbox-field__label" htmlFor={id}>
          {label}
        </label>
        {description === undefined ? null : (
          <p className="ui-checkbox-field__description" id={descriptionId}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
