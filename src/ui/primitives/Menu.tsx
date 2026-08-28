import React from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from 'lucide-react';
import { cn } from './cn';
import { Input } from './Input';

/** One choice in the menu. `color` paints a dot before the label and `icon`
 *  replaces that dot with the call site's own mark; `hint` is the consequence of
 *  picking it, on a second line. `meta` is the number that qualifies it — how
 *  many rows the option would leave — set right against the tick column. */
export interface MenuOption {
  id: string;
  label: string;
  color?: string;
  icon?: React.ReactNode;
  hint?: string;
  meta?: string;
}

export interface MenuProps {
  options: MenuOption[];
  /** The option in effect, ticked in the list. */
  value?: string;
  /** The options in effect for a `multiple` menu. Replaces `value`; picking one
   *  is a toggle, so `onSelect` gets the id that was hit, not the new set. */
  values?: string[];
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
  /** What picking does. A `choice` menu (the default) stands for a value: the
   *  current one is ticked and the options are `menuitemradio`s. An `action` menu
   *  is a list of commands — no tick column, plain `menuitem`s — for the row
   *  overflow ("⋯") case where nothing is "selected". */
  kind?: 'choice' | 'action';
  /** Several options can be on at once. The panel stays open on a pick — a set
   *  is built by hitting two or three things in a row — and the options become
   *  `menuitemcheckbox`es. Only meaningful for a `choice` menu. */
  multiple?: boolean;
  /** Puts a filter box above the list, for option sets long enough that reading
   *  them is worse than typing. Changes the keyboard model — see below. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown in place of the list when the filter matches nothing. */
  emptyText?: string;
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
 *  doesn't travel with its trigger on its own, so a scroll or a resize re-anchors
 *  it to wherever the trigger now is.
 *
 *  Two keyboard models, because a menu and a filtered list are different widgets:
 *  a plain menu moves DOM focus onto the option the arrows are on, while a
 *  `searchable` one keeps focus in the input — you have to be able to keep typing
 *  — and points at the active option with `aria-activedescendant` instead.
 *
 *  Style-only, like the rest of `primitives/`: it knows nothing about what the
 *  options mean. */
export function Menu({
  options,
  value,
  values,
  onSelect,
  label,
  title,
  children,
  className,
  style,
  align = 'start',
  kind = 'choice',
  multiple = false,
  searchable = false,
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
}: MenuProps) {
  const isAction = kind === 'action';
  const isChecked = React.useCallback(
    (id: string) => (multiple ? (values ?? []).includes(id) : id === value),
    [multiple, values, value],
  );
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const [query, setQuery] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const listId = React.useId();
  const [active, setActive] = React.useState(0);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, query]);
  const selectedIndex = visible.findIndex((o) => isChecked(o.id));

  const close = React.useCallback((refocus: boolean) => {
    setOpen(false);
    setPos(null);
    setQuery('');
    if (refocus) {
      triggerRef.current?.focus();
    }
  }, []);

  // Measured rather than estimated: the panel's height depends on how many
  // options there are and whether they carry hints, and that decides whether it
  // can hang below the trigger at all.
  const place = React.useCallback(() => {
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
  }, [align]);

  React.useLayoutEffect(() => {
    if (open) {
      place();
    }
  }, [open, place, visible.length]);

  // Focus the option the keyboard is on, so the menu answers to arrows without
  // needing aria-activedescendant bookkeeping. Waits for `pos`, and that is not
  // incidental: the panel is `visibility: hidden` until it has been measured,
  // and a hidden element cannot take focus at all.
  //
  // A searchable menu inverts this: focus stays in the input for the whole of
  // its life, so the active option is only scrolled into view.
  React.useLayoutEffect(() => {
    if (!open || !pos) {
      return;
    }
    if (searchable) {
      inputRef.current?.focus();
      itemRefs.current[active]?.scrollIntoView({ block: 'nearest' });
    } else {
      itemRefs.current[active]?.focus();
    }
  }, [open, pos, active, searchable]);

  // Filtering renumbers the list under the cursor, so the highlight goes back to
  // the top rather than to whatever now happens to sit at that index.
  React.useEffect(() => {
    setActive(0);
  }, [query]);

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
    // The panel is positioned in viewport coordinates, so anything that moves the
    // trigger re-anchors it. Closing on those events was the older answer, and it
    // made the searchable variant unopenable on a phone: focusing the filter box
    // raises the virtual keyboard, which scrolls the document on iOS and resizes
    // the window on Android — so the menu shut itself the instant it opened. It
    // still closes once the trigger has left the viewport, where re-anchoring
    // would leave it pointing at nothing.
    const reanchor = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger || trigger.bottom < 0 || trigger.top > window.innerHeight) {
        close(false);
        return;
      }
      place();
    };
    // Its own list scrolls, and that moves neither trigger nor panel — the capture
    // listener sees those events too, and there is nothing to re-anchor to.
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        reanchor();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', reanchor);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reanchor);
    };
  }, [open, close, place]);

  const openMenu = () => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  // A multi-select menu is a set being built, so it survives the pick: closing
  // after each one would mean reopening it for every tag.
  const pick = (id: string) => {
    if (!multiple) {
      close(true);
    }
    onSelect(id);
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
      if (visible.length === 0) {
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + visible.length) % visible.length);
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      setActive(e.key === 'Home' ? 0 : visible.length - 1);
      return;
    }
    // Only the searchable menu needs this: elsewhere the active option holds
    // focus and is a button, so Enter already activates it.
    if (searchable && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const option = visible[active];
      if (option) {
        pick(option.id);
      }
    }
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
        aria-haspopup={searchable ? 'dialog' : 'menu'}
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
            // A menu holding a textbox is not a menu: the searchable variant is a
            // combobox and its list carries the roles instead.
            role={searchable ? undefined : 'menu'}
            aria-label={searchable ? undefined : label}
            onKeyDown={onPanelKeyDown}
            // Above both modal layers: a menu opened from inside a dialog is the
            // topmost thing on screen. Hidden until measured, so it never paints
            // once at the origin and then jumps to the trigger.
            className="fixed z-70 min-w-[190px] max-w-[280px] py-1 bg-white rounded-panel border border-neutral-375 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          >
            {searchable && (
              <div className="px-[7px] pt-[3px] pb-[6px]">
                <Input
                  ref={inputRef}
                  size="xs"
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={visible[active] ? `${listId}-${active}` : undefined}
                  aria-label={label}
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full"
                />
              </div>
            )}
            {/* The list scrolls rather than the panel, so a filter box stays put
                above it. */}
            <div id={searchable ? listId : undefined} role={searchable ? 'listbox' : undefined} className="max-h-[264px] overflow-y-auto">
              {visible.map((option, i) => {
                const checked = isChecked(option.id);
                return (
                  <button
                    key={option.id}
                    id={searchable ? `${listId}-${i}` : undefined}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    role={searchable ? 'option' : isAction ? 'menuitem' : multiple ? 'menuitemcheckbox' : 'menuitemradio'}
                    {...(searchable ? { 'aria-selected': checked } : isAction ? {} : { 'aria-checked': checked })}
                    // Nothing in a searchable list is tabbable: focus belongs to
                    // the input, and Tab is what closes the menu.
                    tabIndex={searchable ? -1 : i === active ? 0 : -1}
                    onClick={() => pick(option.id)}
                    // The keyboard highlight is painted rather than focused in the
                    // searchable variant, so it replaces the base background
                    // instead of layering over it — two background utilities on
                    // one element resolve by source order, not by attribute order.
                    className={
                      'w-full flex items-start gap-[9px] px-[11px] py-[7px] border-none cursor-pointer text-left hover:bg-neutral-200 focus:bg-neutral-200 focus:outline-none ' +
                      (searchable && i === active ? 'bg-neutral-200' : 'bg-transparent')
                    }
                  >
                    {option.icon ? (
                      <span className="shrink-0 mt-[3px] flex" aria-hidden="true">
                        {option.icon}
                      </span>
                    ) : (
                      option.color && (
                        <span
                          className="w-[8px] h-[8px] mt-[5px] shrink-0 rounded-full"
                          style={{ background: option.color }}
                          aria-hidden="true"
                        />
                      )
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-control text-neutral-825">{option.label}</span>
                      {option.hint && <span className="block text-meta text-neutral-650 mt-[1px]">{option.hint}</span>}
                    </span>
                    {option.meta && (
                      <span className="shrink-0 mt-[2px] text-meta text-neutral-650 tabular-nums">{option.meta}</span>
                    )}
                    {!isAction && (
                      <span className="w-[13px] shrink-0 mt-[3px] text-brand-575" aria-hidden="true">
                        {checked && <CheckIcon size={13} strokeWidth={2.5} />}
                      </span>
                    )}
                  </button>
                );
              })}
              {visible.length === 0 && <p className="px-[11px] py-[7px] m-0 text-control text-neutral-650">{emptyText}</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
