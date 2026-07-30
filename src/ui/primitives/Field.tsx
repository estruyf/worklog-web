import React from 'react';
import { cn } from './cn';

/** What a `Field` hands down to the control inside it. The control never has to
 *  be told its own id, and the call site never has to invent one — which is what
 *  had kept most labels in the app from being associated with anything at all. */
interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

/** Resolves the id / `aria-describedby` / invalid state a control should use:
 *  what it was passed explicitly wins, otherwise it inherits from the enclosing
 *  `Field`, otherwise nothing. Used by `Input`, `TextArea`, `Select` and
 *  `DateInput`; not part of the public surface. */
export function useControlAria(own: {
  id?: string;
  describedBy?: string;
  invalid?: boolean;
}): { id?: string; describedBy?: string; invalid: boolean } {
  const field = React.useContext(FieldContext);
  return {
    id: own.id ?? field?.id,
    describedBy: own.describedBy ?? field?.describedBy,
    invalid: own.invalid ?? field?.invalid ?? false,
  };
}

export type FieldLabelSize = 'xs' | 'sm' | 'md';

const LABELS: Record<FieldLabelSize, string> = {
  xs: 'text-eyebrow text-neutral-675',
  sm: 'text-control font-semibold',
  md: 'text-body font-semibold',
};

const LABEL_GAP: Record<FieldLabelSize, string> = {
  xs: 'mb-[6px]',
  sm: 'mb-[6px]',
  md: 'mb-2',
};

export interface FieldProps {
  label?: React.ReactNode;
  /** The parenthesised aside after the label — pass `optional`, not `(optional)`. */
  hint?: React.ReactNode;
  /** Sits opposite the label on the same line: the "Clear" link a filled date
   *  field grows, a character count, a help toggle. */
  action?: React.ReactNode;
  /** Explanatory line under the control. Wired up as `aria-describedby`. */
  help?: React.ReactNode;
  /** Validation message under the control. Also marks the control invalid, so
   *  the red border and the message can never disagree. */
  error?: React.ReactNode;
  labelSize?: FieldLabelSize;
  /** For a control that owns its id already (one addressed by a shortcut, say).
   *  Otherwise the field generates one and the label points at it. */
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label + hint + control + help/error, with the accessible wiring between them.
 *
 *  Every part is optional, so this is also the right wrapper for a control whose
 *  only extra is a "Clear" action, or one that only sometimes has an error. */
export function Field({
  label,
  hint,
  action,
  help,
  error,
  labelSize = 'md',
  htmlFor,
  className,
  children,
}: FieldProps) {
  const generated = React.useId();
  const id = htmlFor ?? generated;
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  // Error first: it is the thing to hear about before the general explanation.
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error }}>
      <div className={className}>
        {(label || action) && (
          <div className={cn('flex items-center justify-between gap-2', LABEL_GAP[labelSize])}>
            {label ? (
              <label htmlFor={id} className={cn('block', LABELS[labelSize])}>
                {label}
                {hint && <span className="text-neutral-625 font-normal"> ({hint})</span>}
              </label>
            ) : (
              <span />
            )}
            {action}
          </div>
        )}
        {children}
        {help && (
          <div id={helpId} className="text-meta text-neutral-625 mt-[6px] leading-[1.5]">
            {help}
          </div>
        )}
        {error && (
          <div id={errorId} className="text-chip text-danger-675 mt-[6px]">
            {error}
          </div>
        )}
      </div>
    </FieldContext.Provider>
  );
}
