import React from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from 'lucide-react';
import { cn } from './cn';

/** One choice in the menu. `color` paints a dot before the label; `hint` is the
 *  consequence of picking it, on a second line. */
export interface MenuOption {
  id: string;
  label: string;
  color?: string;
  hint?: string;
}

export interface MenuProps {
  options: MenuOption[];
  /** The option in effect, ticked in the list. */
  value?: string;
  onSelect: (id: string) => void;
  /** Accessible name for both the trigger and the list it opens. */
  label: string;
  title?: string;
  /** The trigger's content. The menu paints no chrome around it — `className`
   *  and `style` are the trigger's, so a call site keeps the look it had. */
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Which edge of the trigger the panel lines up with. */
  align?: 'start' | 'end';
}

/** Gap between the trigger and the panel, and the margin the panel keeps from
 *  the viewport edge when it has to be nudged back inside. */
const GAP = 4;
const EDGE = 8;

/** A single-choice menu hung off a trigger of the call site's own making.
 *
 *  The panel is portalled to `<body>` and positioned `fixed` rather than
 *  absolutely inside the trigger: every list that uses this sits in a scrolling
 *  container, and an in-flow panel would be clipped by it — the menu on the last
 *  visible row is exactly the one you can't read. The flip side is that the panel
 *  doesn't travel with its trigger, so a scroll closes it.
 *
 *  Style-only, like the rest of `primitives/`: it knows nothing about what the
 *  options mean. */
export function Menu({ options, value, onSelect, label, title, children, className, style, align = 'start' }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.id === value);
  const [active, setActive] = React.useState(0);

  const close = React.useCallback((refocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (refocus) {
      triggerRef.current?.focus();
    }
  }, []);

  // Measured after mount rather than estimated: the panel's height depends on
  // how many options there are and whether they carry hints, and that decides
  // whether it can hang below the trigger at all.
  React.useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const trigger = triggerRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!trigger || !panel) {
      return;
    }
    const below = trigger.bottom + GAP;
    const top = below + panel.height > window.innerHeight - EDGE ? Math.max(EDGE, trigger.top - GAP - panel.height) : below;
    const wanted = align === 'end' ? trigger.right - panel.width : trigger.left;
    const left = Math.max(EDGE, Math.min(wanted, window.innerWidth - EDGE - panel.width));
    setPos({ top, left });
  }, [open, align, options.length]);

  // Focus the option the keyboard is on, so the menu answers to arrows without
  // needing aria-activedescendant bookkeeping. Waits for `pos`, and that is not
  // incidental: the panel is `visibility: hidden` until it has been measured,
  // and a hidden element cannot take focus at all.
  React.useLayoutEffect(() => {
    if (open && pos) {
      itemRefs.current[active]?.focus();
    }
  }, [open, pos, active]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        close(false);
      }
    };
    // The panel is positioned once, in viewport coordinates: anything that moves
    // the trigger underneath it would leave it pointing at nothing.
    const onReflow = () => close(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, close]);

  const openMenu = () => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  // The open menu owns the keys it uses and stops them here. The app's shortcut
  // handler and the task detail panel's Escape both listen on `window` in the
  // bubble phase, so without this, Escape would close the panel *behind* the
  // menu — the same reason `Modal` stops it.
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      close(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      setActive(e.key === 'Home' ? 0 : options.length - 1);
    }
  };

  const pick = (id: string) => {
    close(true);
    onSelect(id);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            openMenu();
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={title}
        className={cn('bg-transparent border-none p-0 cursor-pointer text-left', className)}
        style={style}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={label}
            onKeyDown={onPanelKeyDown}
            // Above both modal layers: a menu opened from inside a dialog is the
            // topmost thing on screen. Hidden until measured, so it never paints
            // once at the origin and then jumps to the trigger.
            className="fixed z-70 min-w-[190px] max-w-[280px] py-1 bg-white rounded-panel border border-neutral-375 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          >
            {options.map((option, i) => {
              const checked = option.id === value;
              return (
                <button
                  key={option.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  tabIndex={i === active ? 0 : -1}
                  onClick={() => pick(option.id)}
                  className="w-full flex items-start gap-[9px] px-[11px] py-[7px] bg-transparent border-none cursor-pointer text-left hover:bg-neutral-200 focus:bg-neutral-200 focus:outline-none"
                >
                  {option.color && (
                    <span
                      className="w-[8px] h-[8px] mt-[5px] shrink-0 rounded-full"
                      style={{ background: option.color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-control text-neutral-825">{option.label}</span>
                    {option.hint && <span className="block text-meta text-neutral-650 mt-[1px]">{option.hint}</span>}
                  </span>
                  <span className="w-[13px] shrink-0 mt-[3px] text-brand-575" aria-hidden="true">
                    {checked && <CheckIcon size={13} strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
