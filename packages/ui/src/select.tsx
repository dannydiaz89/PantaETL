import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { Icon } from "./icon.js";

/** A selectable option exposed by the design-system select. */
export interface SelectOption {
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
}

/** Props for the accessible select wrapper. */
export interface SelectProps extends Omit<ComponentProps<typeof SelectPrimitive.Root>, "children"> {
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
  readonly id?: string;
  readonly options: readonly SelectOption[];
  readonly placeholder: string;
}

/** Renders a labelled field-compatible select without exposing Radix to consumers. */
export function Select({
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  id,
  options,
  placeholder,
  ...props
}: SelectProps) {
  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className="ui-select"
        id={id}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <Icon icon={ChevronDown} size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="ui-select__content" position="popper">
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                className="ui-select__item"
                key={option.value}
                value={option.value}
                {...(option.disabled === undefined ? {} : { disabled: option.disabled })}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ui-select__item-indicator">
                  <Icon icon={Check} size={14} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
