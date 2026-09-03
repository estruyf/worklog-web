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

/** Below this share of the track a segment has no room for a name without the
 *  name becoming an ellipsis, so it drops its label and picks it up in the
 *  footnote row instead. A half-hour on an eight-hour day is 6% — that is the
 *  case this exists for, and the honest failure mode of any in-bar label. */
const LABEL_MIN_WIDTH = 15;

/** The day as one object: a track scaled to the working day, each entry drawn at
 *  the size of its own hours with its own name inside it, and the leftover as a
 *  slot you click to fill. One bar, no separate legend — the client is readable
 *  where the hours are.
 *
 *  The segments are positioned rather than laid out in a flex row on purpose —
 *  the gutter between them comes out of each segment's own box, so a segment
 *  still spans exactly the hours it claims. */
export function DayBar({
  bar,
  selectedDate,
  clientName,
  colorOf,
  activeClientId,
  editLog,
  logTime,
  copyFrom,
  copyDay,
}: DayBarProps) {
  const { segments, unlogged, total, target, remaining, over, targetPercent } = bar;
  // The last thing on the track keeps the full width: the gutter is a gap between
  // neighbours, and one hanging off the end would stop the bar short of its own
  // scale.
  const lastIndex = unlogged ? -1 : segments.length - 1;
  const slivers = segments.filter((s) => s.width < LABEL_MIN_WIDTH);

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-[6px] mb-[10px] sm:mb-[14px]">
        <SectionLabel>Your day</SectionLabel>
        <span className={'text-meta ' + (over > 0 ? 'text-brand-600 font-semibold' : 'text-neutral-675')}>
          {target > 0 ? (
            <>
              {num(total)}h of {num(target)}h
              {over > 0
                ? ` · ${num(over)}h over`
                : total === 0
                  ? ' · nothing logged'
                  : remaining > 0
                    ? ` · ${num(remaining)}h left`
                    : ' · full day'}
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

      <div className="relative h-[34px]" role="group" aria-label="Time logged on this day">
        {segments.map(({ entry, left, width }, i) => {
          const color = entryColor(entry.clientId, colorOf);
          const selected = entry.clientId === activeClientId;
          return (
            <div key={entry.clientId} className="absolute inset-y-0" style={{ left: `${left}%`, width: `${width}%` }}>
              <SlotButton
                gutter={i !== lastIndex}
                onClick={() => editLog(entry.clientId)}
                title={`${clientName(entry.clientId)} — ${num(entry.hours)}h${entry.note ? ` · ${entry.note}` : ''}`}
                selected={selected}
                // The tint is the client's own colour at a strength text still
                // reads on; the left edge is the colour itself, which is what
                // ties a sliver to its name in the footnote row.
                style={{
                  background: mix(color, 12),
                  borderColor: selected ? 'var(--color-brand-500)' : mix(color, 30),
                  borderLeftColor: color,
                }}
              >
                {width >= LABEL_MIN_WIDTH && (
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="truncate font-semibold text-neutral-825">{clientName(entry.clientId)}</span>
                    <span className="text-meta text-neutral-675 shrink-0 tabular-nums">{num(entry.hours)}h</span>
                  </span>
                )}
              </SlotButton>
            </div>
          );
        })}

        {unlogged && (
          <div className="absolute inset-y-0" style={{ left: `${unlogged.left}%`, width: `${unlogged.width}%` }}>
            <SlotButton
              gutter={false}
              dashed
              onClick={() => logTime(remaining)}
              title={total === 0 ? 'Log time on this day' : `Log the remaining ${num(remaining)}h`}
            >
              {unlogged.width >= LABEL_MIN_WIDTH && (
                <span className="truncate italic text-neutral-650">
                  {total === 0 ? 'Nothing logged on this day yet.' : `${num(remaining)}h left`}
                </span>
              )}
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

      {/* The names the bar had no room for. Same click as the segment, so a
        * half-hour is still editable without hunting for a 20px target. */}
      {slivers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-[7px]">
          {slivers.map(({ entry }) => (
            <button
              key={entry.clientId}
              type="button"
              onClick={() => editLog(entry.clientId)}
              title={`${clientName(entry.clientId)} — ${num(entry.hours)}h${entry.note ? ` · ${entry.note}` : ''}`}
              className="flex items-center gap-[6px] text-meta cursor-pointer hover:underline"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: entryColor(entry.clientId, colorOf) }}
              />
              <span className="font-semibold text-neutral-825">{clientName(entry.clientId)}</span>
              <span className="text-neutral-675 tabular-nums">{num(entry.hours)}h</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function entryColor(clientId: string, colorOf: (clientId: string) => string): string {
  return isEventWorklogClientId(clientId) ? EVENT_COLOR : colorOf(clientId);
}

/** A client's colour thinned against white. `color-mix` rather than a hand-rolled
 *  hex parse: the colour comes from the user's config and can be any CSS colour
 *  they typed, not a palette entry we could look a tint up for. */
function mix(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

type SlotButtonProps = {
  gutter: boolean;
  dashed?: boolean;
  selected?: boolean;
  onClick: () => void;
  title: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/** One box on the track. Absolutely inset inside its slice so the gutter is taken
 *  from the slice rather than added between slices. */
function SlotButton({ gutter, dashed, selected, onClick, title, style, children }: SlotButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      style={style}
      className={
        'absolute inset-y-0 left-0 flex items-center overflow-hidden px-[10px] text-left text-control leading-none rounded-control border cursor-pointer ' +
        (gutter ? 'right-[4px] sm:right-[6px] ' : 'right-0 ') +
        (dashed
          ? 'border-dashed border-neutral-550 bg-white hover:border-brand-500 '
          : 'border-l-[3px] hover:border-brand-500 ')
      }
    >
      {children}
    </button>
  );
}
