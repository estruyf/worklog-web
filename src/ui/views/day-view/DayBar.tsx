import React from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { isEventWorklogClientId } from '../../../model/worklog';
import { Button, SectionLabel } from '../../primitives';
import { EVENT_COLOR, num, shiftDate, weekdayShort, type DayBarModel } from '../../utils';

type DayBarProps = {
  bar: DayBarModel;
  selectedDate: string;
  clientName: (clientId: string) => string;
  colorOf: (clientId: string) => string;
  typeLabel: (hours: number) => string;
  /** The entry the editor is open on; '' when it is closed or on a new entry. */
  activeClientId: string;
  editLog: (clientId: string) => void;
  /** Opens the editor on a new entry, pre-filled with the hours handed to it.
   *  Only the unlogged slot uses it here — once the day is full that slot is
   *  gone, and the card's footer is what keeps over-logging reachable. */
  logTime: (prefillHours?: number) => void;
  /** The day `copyDay` would copy, absent when there is nothing to copy. */
  copyFrom?: string;
  copyDay: (fromDate: string) => void;
};

/** The day as one object: a track scaled to the working day, each entry drawn at
 *  the size of its own hours, and the leftover as a slot you click to fill.
 *
 *  The segments are positioned rather than laid out in a flex row on purpose —
 *  the gutter between them comes out of each segment's own box, so the tick scale
 *  underneath still lines up with the hours the segments claim. */
export function DayBar({
  bar,
  selectedDate,
  clientName,
  colorOf,
  typeLabel,
  activeClientId,
  editLog,
  logTime,
  copyFrom,
  copyDay,
}: DayBarProps) {
  const { segments, unlogged, total, target, remaining, over, ticks, targetPercent } = bar;
  // The last thing on the track keeps the full width: the gutter is a gap between
  // neighbours, and one hanging off the end would stop the bar short of its own
  // scale.
  const lastIndex = unlogged ? -1 : segments.length - 1;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-[6px] mb-[10px] sm:mb-[14px]">
        <SectionLabel>Your day</SectionLabel>
        <span className={'text-meta ' + (over > 0 ? 'text-brand-600 font-semibold' : 'text-neutral-675')}>
          {target > 0 ? (
            <>
              {num(total)}h of {num(target)}h
              {over > 0 ? ` · ${num(over)}h over` : remaining > 0 ? ` · ${num(remaining)}h left` : ' · full day'}
            </>
          ) : (
            `${num(total)}h logged`
          )}
        </span>
        {copyFrom && (
          <Button size="sm" onClick={() => copyDay(copyFrom)} title={`Copy every entry logged on ${copyFrom}`} className="ml-auto">
            <RotateCcwIcon size={14} className="text-neutral-675" />
            {copyFrom === shiftDate(selectedDate, -1) ? 'Same as yesterday' : `Same as ${weekdayShort(copyFrom)}`}
          </Button>
        )}
      </div>

      <div className="relative h-[56px] sm:h-[72px]" role="group" aria-label="Time logged on this day">
        {segments.map(({ entry, left, width }, i) => (
          <div key={entry.clientId} className="absolute inset-y-0" style={{ left: `${left}%`, width: `${width}%` }}>
            <SlotButton
              gutter={i !== lastIndex}
              selected={entry.clientId === activeClientId}
              onClick={() => editLog(entry.clientId)}
              title={`${clientName(entry.clientId)} · ${entry.hours}h${entry.note ? ` · ${entry.note}` : ''}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: isEventWorklogClientId(entry.clientId) ? EVENT_COLOR : colorOf(entry.clientId) }}
                />
                <span className="truncate font-semibold text-neutral-825">{clientName(entry.clientId)}</span>
              </span>
              <span className="block truncate text-meta text-neutral-675 mt-[2px]">
                {typeLabel(entry.hours)}
                {entry.note ? ` · ${entry.note}` : ''}
              </span>
            </SlotButton>
          </div>
        ))}

        {unlogged && (
          <div className="absolute inset-y-0" style={{ left: `${unlogged.left}%`, width: `${unlogged.width}%` }}>
            <SlotButton
              gutter={false}
              dashed
              onClick={() => logTime(remaining)}
              title={total === 0 ? 'Log time on this day' : `Log the remaining ${num(remaining)}h`}
            >
              <span className="truncate font-semibold text-neutral-675">Unlogged</span>
              <span className="block truncate text-meta text-neutral-650 mt-[2px]">
                {remaining > 0 ? `${num(remaining)}h left · ` : ''}click to fill
              </span>
            </SlotButton>
          </div>
        )}

        {/* Where the working day ends, on a bar that has grown past it. */}
        {over > 0 && (
          <div
            className="absolute inset-y-[-3px] border-l-2 border-dashed border-brand-500 pointer-events-none"
            style={{ left: `${targetPercent}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="relative h-3.5 sm:h-4 mt-[4px] sm:mt-[6px]" aria-hidden="true">
        {ticks.map((tick, i) => (
          <span
            key={tick.hours}
            className="absolute top-0 text-status text-neutral-625 tabular-nums"
            style={{
              left: `${tick.percent}%`,
              transform: i === 0 ? 'none' : tick.percent >= 100 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {num(tick.hours)}h
          </span>
        ))}
      </div>
    </>
  );
}

type SlotButtonProps = {
  gutter: boolean;
  dashed?: boolean;
  selected?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
};

/** One box on the track. Absolutely inset inside its slice so the gutter is taken
 *  from the slice rather than added between slices. */
function SlotButton({ gutter, dashed, selected, onClick, title, children }: SlotButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={
        'absolute inset-y-0 left-0 overflow-hidden px-[10px] py-[7px] sm:px-3 sm:py-2 text-left text-control leading-snug rounded-panel border cursor-pointer ' +
        (gutter ? 'right-[4px] sm:right-[6px] ' : 'right-0 ') +
        (selected
          ? 'border-brand-500 bg-brand-125 '
          : dashed
            ? 'border-dashed border-neutral-550 bg-white hover:border-brand-500 '
            : 'border-neutral-375 bg-neutral-150 hover:border-brand-500 ')
      }
    >
      {children}
    </button>
  );
}
