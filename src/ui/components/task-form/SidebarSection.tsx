import React from 'react';

/** One labelled block in the form's right-hand rail. The rule above each block
 *  is what keeps a stack of unrelated fields readable at this width — there's no
 *  room for the whitespace a single column would use. `divider` is off for the
 *  block that opens the rail, which has nothing above it to be separated from. */
export function SidebarSection({
  title,
  hint,
  divider = true,
  children,
}: {
  title?: string;
  hint?: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={'pb-[18px] ' + (divider ? 'border-t border-neutral-375 pt-[18px]' : '')}>
      {title && (
        <label className="block font-semibold text-body mb-[10px]">
          {title} {hint && <span className="text-neutral-625 font-normal">({hint})</span>}
        </label>
      )}
      {children}
    </section>
  );
}
