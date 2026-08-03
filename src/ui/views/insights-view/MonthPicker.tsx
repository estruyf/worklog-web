import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarArrowUpIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button, cn, IconButton } from '../../primitives';
import { MONTHS, monthLabel, num, shiftMonth } from '../../utils';

export interface MonthPickerProps {
  /** The selected month, YYYY-MM. */
  value: string;
  onChange: (ym: string) => void;
  /** Hours logged per YYYY-MM. Drives both the grid's captions and which months
   *  are reachable — a month is worth opening because something is in it. */
  hoursByMonth: Record<string, number>;
  /** Today's month, YYYY-MM: always reachable even with nothing logged in it. */
  currentMonth: string;
  className?: string;
}

const CELL = 'flex flex-col items-center justify-center gap-[1px] py-[7px] rounded-control-md border text-control font-semibold';
const CELL_IDLE = 'border-transparent text-neutral-750 hover:bg-neutral-200 cursor-pointer';
const CELL_SELECTED = 'border-brand-500 bg-brand-225 text-brand-800 cursor-pointer';
const CELL_OUT = 'border-transparent text-neutral-550 cursor-not-allowed';

/** Month selector for the Insights view: arrows to step, a panel to jump.
 *
 *  A bare `<select>` of every logged month was one flat list that grew a row a
 *  month and said nothing about what was in any of them. The panel is a year of
 *  months at a time with each one's hours under it, so picking is a decision
 *  made from the data rather than from a date. Stepping is bounded to the range
 *  that has worklog in it (plus this month), so the arrows can't walk off into
 *  empty years. */
export function MonthPicker({ value: rawValue, onChange, hoursByMonth, currentMonth, className }: MonthPickerProps) {
  // The UI state starts at '' and is filled in once the store's snapshot lands;
  // a render in that gap would otherwise label the month "undefined NaN".
  const value = rawValue || currentMonth;
  const [open, setOpen] = useState(false);
  // The year the panel is showing, which is not the selected month's year once
  // you page across a boundary and pick nothing.
  const [panelYear, setPanelYear] = useState(() => Number(value.slice(0, 4)));
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [minMonth, maxMonth] = useMemo(() => {
    const months = [...Object.keys(hoursByMonth), currentMonth, value].filter(Boolean).sort();
    return [months[0] ?? value, months[months.length - 1] ?? value];
  }, [hoursByMonth, currentMonth, value]);

  // Reopening lands on the selected month's year rather than wherever the last
  // visit paged to.
  useEffect(() => {
    if (open) {
      setPanelYear(Number(value.slice(0, 4)));
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (ym: string) => {
    onChange(ym);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const minYear = Number(minMonth.slice(0, 4));
  const maxYear = Number(maxMonth.slice(0, 4));
  const previous = shiftMonth(value, -1);
  const next = shiftMonth(value, 1);

  return (
    <div ref={ref} className={cn('relative flex items-center gap-2', className)}>
      <Button
        size="xs"
        onClick={() => onChange(currentMonth)}
        disabled={value === currentMonth}
        title="Jump to this month"
        className="shrink-0"
      >
        <CalendarArrowUpIcon size={14} className="text-neutral-675" /> This month
      </Button>
      <IconButton
        size="sm"
        onClick={() => onChange(previous)}
        disabled={previous < minMonth}
        title="Previous month"
        aria-label="Previous month"
      >
        <ChevronLeftIcon size={16} />
      </IconButton>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Month: ${monthLabel(value)}`}
        className="flex items-center gap-[6px] px-3 py-[7px] min-w-[132px] justify-center border border-neutral-400 rounded-control bg-white text-control font-semibold text-neutral-825 hover:bg-neutral-200 cursor-pointer"
      >
        {monthLabel(value)}
        <ChevronDownIcon size={14} className={cn('text-neutral-700 transition-transform', open && 'rotate-180')} />
      </button>
      <IconButton
        size="sm"
        onClick={() => onChange(next)}
        disabled={next > maxMonth}
        title="Next month"
        aria-label="Next month"
      >
        <ChevronRightIcon size={16} />
      </IconButton>

      {open && (
        <div
          role="dialog"
          aria-label="Select month"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-[264px] border border-neutral-400 rounded-[10px] bg-white shadow-lg p-[10px]"
        >
          <div className="flex items-center justify-between mb-2">
            <IconButton
              size="xs"
              onClick={() => setPanelYear((y) => y - 1)}
              disabled={panelYear <= minYear}
              title="Previous year"
              aria-label="Previous year"
            >
              <ChevronLeftIcon size={14} />
            </IconButton>
            <span className="text-control font-bold tabular-nums">{panelYear}</span>
            <IconButton
              size="xs"
              onClick={() => setPanelYear((y) => y + 1)}
              disabled={panelYear >= maxYear}
              title="Next year"
              aria-label="Next year"
            >
              <ChevronRightIcon size={14} />
            </IconButton>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((label, i) => {
              const ym = `${panelYear}-${String(i + 1).padStart(2, '0')}`;
              const hours = hoursByMonth[ym] ?? 0;
              const selected = ym === value;
              const out = ym < minMonth || ym > maxMonth;
              return (
                <button
                  key={ym}
                  type="button"
                  onClick={() => pick(ym)}
                  disabled={out}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`${label} ${panelYear}${hours ? `, ${num(hours)} hours` : ''}`}
                  className={cn(CELL, out ? CELL_OUT : selected ? CELL_SELECTED : CELL_IDLE)}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      'text-[10px] font-normal tabular-nums',
                      out ? 'text-neutral-550' : selected ? 'text-brand-800' : 'text-neutral-625',
                    )}
                  >
                    {hours ? `${num(hours)}h` : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
