import React from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';

/** Panel width. The three sizes are a prompt, a form and the command palette. */
export type ModalSize = 'sm' | 'md' | 'lg';
/** How far down the viewport the panel hangs. A short prompt sits lower than a
 *  tall panel, which needs the room. */
export type ModalOffset = 'xs' | 'sm' | 'md' | 'lg';
/** `base` is a dialog over the app; `top` is a dialog over another dialog. */
export type ModalLayer = 'base' | 'top';
export type ModalTitleSize = 'sm' | 'md';

const SIZES: Record<ModalSize, string> = {
  sm: 'w-[440px] max-w-[92vw]',
  md: 'w-[520px] max-w-[92vw]',
  lg: 'w-[760px] max-w-[92vw]',
};

const OFFSETS: Record<ModalOffset, string> = {
  xs: 'pt-[8vh]',
  sm: 'pt-[10vh]',
  md: 'pt-[12vh]',
  lg: 'pt-[16vh]',
};

const LAYERS: Record<ModalLayer, string> = {
  base: 'z-50',
  top: 'z-60',
};

const TITLES: Record<ModalTitleSize, string> = {
  sm: 'text-[17px] leading-[1.35]',
  md: 'text-[20px]',
};

/** Everything that can take focus, minus the things that only look like they can.
 *  Order matters: `querySelectorAll` returns document order, which is tab order
 *  here because nothing in a dialog sets a positive `tabindex`. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

export interface ModalProps {
  /** Escape and the backdrop call this. Leave it out for a dialog that has to be
   *  answered rather than dismissed — then neither does anything. */
  onClose?: () => void;
  /** Rendered as the dialog's heading and used as its accessible name. */
  title?: React.ReactNode;
  titleSize?: ModalTitleSize;
  /** Puts a × next to the title. Needs `onClose`. */
  showClose?: boolean;
  /** The accessible name for a dialog with no visible heading. */
  label?: string;
  /** Id of an element describing the dialog, for `aria-describedby`. */
  describedBy?: string;
  /** `alertdialog` for a question that interrupts — assistive tech announces it
   *  more insistently than a plain dialog. */
  role?: 'dialog' | 'alertdialog';
  size?: ModalSize;
  offset?: ModalOffset;
  layer?: ModalLayer;
  /** `none` for a panel that lays out its own sections — a scrolling body under a
   *  fixed header, say, where one padding box around the lot would be wrong. */
  padding?: 'md' | 'none';
  /** Stop *every* keydown in the capture phase, so nothing behind the dialog
   *  reacts to the keyboard while it is up. See `ConfirmDialog`. */
  captureKeys?: boolean;
  /** Layout for the panel — `max-h`, `overflow`, `flex flex-col`. Not width: that
   *  is `size`, since `cn` cannot override what a variant already set. */
  className?: string;
  children: React.ReactNode;
}

/** Backdrop + panel, with the behaviour a dialog owes the keyboard: it is labelled,
 *  it closes on Escape and on the backdrop, focus starts inside it and cannot Tab
 *  out, and the element that opened it gets focus back when it goes.
 *
 *  Mount it conditionally — there is no `open` prop, because a dialog that isn't
 *  showing shouldn't be holding state or listeners. */
export function Modal({
  onClose,
  title,
  titleSize = 'md',
  showClose = false,
  label,
  describedBy,
  role = 'dialog',
  size = 'md',
  offset = 'md',
  layer = 'base',
  padding = 'md',
  captureKeys = false,
  className,
  children,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Latest props for the key handler, so it can subscribe once instead of
  // re-binding whenever the call site passes a fresh closure.
  const handlers = React.useRef({ onClose, captureKeys });
  React.useEffect(() => {
    handlers.current = { onClose, captureKeys };
  });

  // Focus starts in the dialog and comes back out to where it was. A child with
  // `autoFocus` has already claimed it by the time this runs, so only take it
  // when nothing inside did.
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      (focusableIn(panel)[0] ?? panel).focus();
    }
    return () => {
      // Not if something else already claimed focus: closing a dialog often opens
      // what it was about, and that screen's own autoFocus has already run by the
      // time this does. Not if the opener went with the dialog either — a search
      // hit unmounts the row that was clicked, and focusing a detached node drops
      // focus to the body silently.
      const active = document.activeElement;
      const claimed = active && active !== document.body;
      if (!claimed && opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);

  // Escape and the Tab trap run on window in the *capture* phase: `captureKeys`
  // stops the event there, and a listener on the panel itself would never see it.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const active = document.activeElement;
      // A dialog only acts on the keyboard while it holds the focus. Without this,
      // a dialog opened over another one would have every keydown handled twice —
      // the one underneath registered its listener first, so it would run first,
      // and Escape would close the wrong dialog. `loose` is the case where nothing
      // holds focus at all (a click on the backdrop), which this dialog reclaims.
      const loose = !active || active === document.body;
      if (!panel.contains(active) && !loose) {
        return;
      }

      const { onClose: close, captureKeys: swallow } = handlers.current;
      if (swallow) {
        e.stopPropagation();
      }
      if (e.key === 'Escape' && close) {
        e.preventDefault();
        // The dialog with the focus owns Escape; nothing behind it should also act.
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (loose) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <div
      onClick={onClose}
      className={cn('fixed inset-0 bg-overlay flex items-start justify-center', OFFSETS[offset], LAYERS[layer])}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        aria-describedby={describedBy}
        // The panel is the fallback focus target when it has nothing focusable of
        // its own, so a screen reader lands in the dialog rather than behind it.
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-white rounded-card shadow-[0_20px_60px_rgba(0,0,0,0.3)] outline-none',
          SIZES[size],
          padding === 'md' && 'px-7.5 pt-6.5 pb-6',
          className,
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className={cn('font-bold m-0', TITLES[titleSize])}>
              {title}
            </h2>
            {showClose && onClose && (
              <IconButton
                size="sm"
                onClick={onClose}
                aria-label="Close"
                title="Close"
                className="-mr-1 text-[20px] text-neutral-650 leading-none"
              >
                ×
              </IconButton>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
