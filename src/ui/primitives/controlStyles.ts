/** Shared style tables for the form controls (`Input`, `TextArea`, `Select`,
 *  `DateInput`). They live apart from the components so the bordered control and
 *  the bordered *shell* an adorned input needs can be built from the same
 *  numbers instead of two sets that drift. */

/** Four steps, matching `Button`: `xs` for a control tucked into a toolbar row,
 *  `sm` for a settings row, `md` for a field in a rail or a dense form, `lg` for
 *  the lead field of a form or dialog. */
export type ControlSize = 'xs' | 'sm' | 'md' | 'lg';

/** `default` is the resting field. `accent` is the one field a form opens on —
 *  it wears the focus treatment permanently, which is how "start typing here"
 *  is said without a caret being visible. */
export type ControlVariant = 'default' | 'accent';

/** Padding and radius. Kept apart from the font size so a shell can take the
 *  geometry while the bare input inside it takes only the text. */
export const CONTROL_GEOMETRY: Record<ControlSize, string> = {
  xs: 'px-2 py-[5px] rounded-[7px]',
  sm: 'px-3 py-[8px] rounded-[8px]',
  md: 'px-[12px] py-[9px] rounded-[9px]',
  lg: 'px-[14px] py-[11px] rounded-[9px]',
};

/** Every size opens at 16px and only steps down from `md` up.
 *
 *  Safari zooms the whole viewport when a focused control's font is under 16px,
 *  and it does not zoom back out afterwards — so the phone-sized floor is not a
 *  per-field decision. Setting it here is the point of the size table: a control
 *  cannot be given a smaller mobile font without editing this line. */
export const CONTROL_TEXT: Record<ControlSize, string> = {
  xs: 'text-[16px] md:text-[13px]',
  sm: 'text-[16px] md:text-[13.5px]',
  md: 'text-[16px] md:text-[14px]',
  lg: 'text-[16px] md:text-[14px]',
};

/** Width is deliberately absent: it is layout, so it belongs to the call site's
 *  `className` (`w-full`, `flex-1`, `w-[96px]`) — which is the one thing `cn`
 *  can safely add. */
export const CONTROL_BASE =
  'border outline-none disabled:cursor-not-allowed disabled:bg-neutral-150 disabled:text-neutral-625';

export const CONTROL_VARIANTS: Record<ControlVariant, string> = {
  default: 'border-neutral-525 bg-white focus:border-brand-500 focus:shadow-[0_0_0_3px_var(--color-brand-225)]',
  accent: 'border-brand-500 bg-white shadow-[0_0_0_3px_var(--color-brand-225)]',
};

/** Replaces the variant's border and ring rather than layering on top of it, so
 *  an invalid field reads the same whether it is focused or not. */
export const CONTROL_INVALID =
  'border-danger-225 bg-white text-danger-675 focus:border-danger-675 focus:shadow-[0_0_0_3px_var(--color-danger-100)]';

/** The same three states for a shell that wraps a bare input plus adornments.
 *  Identical but for `focus-within:`, since the focus lands on the child. */
export const SHELL_VARIANTS: Record<ControlVariant, string> = {
  default:
    'border-neutral-525 bg-white focus-within:border-brand-500 focus-within:shadow-[0_0_0_3px_var(--color-brand-225)]',
  accent: 'border-brand-500 bg-white shadow-[0_0_0_3px_var(--color-brand-225)]',
};

export const SHELL_INVALID =
  'border-danger-225 bg-white focus-within:border-danger-675 focus-within:shadow-[0_0_0_3px_var(--color-danger-100)]';
