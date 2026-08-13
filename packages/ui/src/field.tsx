import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cx } from "./classnames.js";

/** Render data that connects a form control with its label and messages. */
export interface FieldControlProps {
  readonly describedBy: string | undefined;
  readonly id: string;
  readonly invalid: boolean;
}

/** Accessible field wrapper properties. */
export interface FieldProps {
  readonly children: (props: FieldControlProps) => ReactNode;
  readonly description?: string;
  readonly error?: string;
  readonly label: string;
  readonly required?: boolean;
}

/** Associates one labelled input with optional help or error text. */
export function Field({ children, description, error, label, required = false }: FieldProps) {
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const describedBy = error === undefined ? (description === undefined ? undefined : descriptionId) : errorId;

  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children({ describedBy, id: inputId, invalid: error !== undefined })}
      {description === undefined ? null : (
        <p className="ui-field__description" id={descriptionId}>
          {description}
        </p>
      )}
      {error === undefined ? null : (
        <p className="ui-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Input props styled by the semantic design-system tokens. */
export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Renders a standard native input with accessible invalid-state styling. */
export function Input({ className, ...props }: InputProps) {
  return <input className={cx("ui-input", className)} {...props} />;
}
