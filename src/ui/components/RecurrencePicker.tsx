import React, { useMemo, useState } from 'react';
import {
  describeRecurrence,
  firstOccurrence,
  formatRecurrence,
  parseRecurrence,
  type Recurrence,
  type RecurrenceAnchor,
} from '../../model/recurrence';
import { DateInput, Field, Input, LinkButton, Select } from '../primitives';
import { parseISODate, today, weekdayOf } from '../../util/date';

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Monday-first, the way a work week reads; the values are still 0 = Sunday. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const BUSINESS_DAYS = [1, 2, 3, 4, 5];

export interface RecurrencePickerProps {
  /** Canonical repeat expression; '' means the task does not repeat. */
  value: string;
  onChange: (expr: string) => void;
  anchor: RecurrenceAnchor;
  onAnchorChange: (anchor: RecurrenceAnchor) => void;
  /** Optional last date of the series (YYYY-MM-DD); '' for open-ended. */
  until: string;
  onUntilChange: (until: string) => void;
  /** The task's due date. For a repeating task that is where the series starts:
   *  it seeds a preset's day, stands in for the day a rule doesn't name one, and
   *  fixes the phase of a multi-interval rule (which months a quarterly one
   *  lands in). '' lets the rule pick its own first slot. */
  due: string;
  onDueChange: (due: string) => void;
}

type PresetKind = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

const PRESETS: { kind: PresetKind; label: string }[] = [
  { kind: 'daily', label: 'Daily' },
  { kind: 'weekdays', label: 'Weekdays' },
  { kind: 'weekly', label: 'Weekly' },
  { kind: 'biweekly', label: 'Every 2 weeks' },
  { kind: 'monthly', label: 'Monthly' },
  { kind: 'yearly', label: 'Yearly' },
];

function isBusinessWeek(weekdays: number[] | undefined): boolean {
  return !!weekdays && weekdays.length === 5 && BUSINESS_DAYS.every((d) => weekdays.includes(d));
}

/**
 * Which preset chip a rule belongs to, matched on its *shape* (unit + interval)
 * rather than its exact text. Picking a different weekday or day-of-month has to
 * leave the chip selected — matching on text would drop every edited rule into
 * "Custom" the moment it stopped being the seeded default.
 */
export function kindOf(rec: Recurrence): PresetKind | undefined {
  if (rec.unit === 'day' && rec.interval === 1) {
    return 'daily';
  }
  if (rec.unit === 'week' && rec.interval === 1) {
    return isBusinessWeek(rec.weekdays) ? 'weekdays' : 'weekly';
  }
  if (rec.unit === 'week' && rec.interval === 2) {
    return 'biweekly';
  }
  if (rec.unit === 'month' && rec.interval === 1) {
    return 'monthly';
  }
  if (rec.unit === 'year' && rec.interval === 1) {
    return 'yearly';
  }
  return undefined;
}

/**
 * The expression a preset chip starts from. Presets name their day explicitly
 * ("weekly on thu", not "weekly") and take it from the due date: a rule with no
 * day named falls back to whatever date it is next stepped from, which lets a
 * month-end clamp pull the series permanently earlier.
 */
export function seedFor(kind: PresetKind, due: string): string {
  const parts = parseISODate(due) ?? parseISODate(today())!;
  const iso = `${String(parts.y).padStart(4, '0')}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
  const weekday = WEEKDAY_NAMES[weekdayOf(iso)];
  switch (kind) {
    case 'daily':
      return 'daily';
    case 'weekdays':
      return 'weekdays';
    case 'weekly':
      return `weekly on ${weekday}`;
    case 'biweekly':
      return `every 2 weeks on ${weekday}`;
    case 'monthly':
      return `monthly on ${parts.d}`;
    case 'yearly':
      return `yearly on ${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
  }
}

const chipClass = (active: boolean): string =>
  'px-[13px] py-[7px] rounded-full text-[13px] font-semibold cursor-pointer border text-neutral-825 ' +
  (active ? 'border-brand-500 bg-brand-450' : 'border-neutral-525 bg-neutral-350');

// Sized to the row rather than fixed: seven of these have to fit across the task
// form's side rail, and a fixed width wrapped one day onto its own line there.
const dayChipClass = (active: boolean): string =>
  'flex-1 min-w-[32px] max-w-[46px] py-[6px] rounded-[8px] text-[12px] font-semibold cursor-pointer border text-center ' +
  (active
    ? 'border-brand-500 bg-brand-450 text-brand-800'
    : 'border-neutral-525 bg-white text-neutral-725 hover:bg-neutral-200');

/** Weekday toggles for weekly / every-N-weeks rules. At least one day always
 *  stays selected — a weekly rule with no days has nothing to land on. */
function WeekdayPicker({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div>
      <label className="block font-semibold text-[13px] mb-[6px]">On these days</label>
      <div className="flex flex-wrap gap-[6px]">
        {WEEKDAY_ORDER.map((d) => {
          const active = selected.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(d)}
              className={dayChipClass(active)}
            >
              {WEEKDAY_LABELS[d]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Day-of-month for monthly rules. "Last day" tracks the real month end, so it
 *  is 28/29/30/31 as the month requires rather than a fixed number. */
function MonthDayPicker({
  value,
  onChange,
}: {
  value: number | 'last';
  onChange: (day: number | 'last') => void;
}) {
  return (
    <Field
      label="On day"
      labelSize="sm"
      help={typeof value === 'number' && value > 28 ? 'Shorter months fall back to their last day.' : undefined}
    >
      <Select
        value={String(value)}
        onChange={(e) => onChange(e.target.value === 'last' ? 'last' : Number(e.target.value))}
      >
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
        <option value="last">Last day</option>
      </Select>
    </Field>
  );
}

/** A clearable date field. Both series bounds read the same way. */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    // Wraps rather than shrinks: a native date input squeezed below ~150px clips
    // its own text, so in a narrow column the two bounds stack instead.
    <Field
      label={label}
      labelSize="sm"
      className="flex-1 min-w-[150px]"
      action={
        value && (
          <LinkButton size="xs" onClick={() => onChange('')}>
            Clear
          </LinkButton>
        )
      }
    >
      <DateInput value={value} onChange={(e) => onChange(e.target.value)} className="w-full" />
    </Field>
  );
}

/** Repeat controls for the task form: preset chips, the day detail for whichever
 *  preset is active, a custom expression, and the two qualifiers that change what
 *  the rule means (cadence anchor, end date). */
export function RecurrencePicker({
  value,
  onChange,
  anchor,
  onAnchorChange,
  until,
  onUntilChange,
  due,
  onDueChange,
}: RecurrencePickerProps) {
  const parsed = useMemo(() => (value.trim() ? parseRecurrence(value) : undefined), [value]);
  const repeats = value.trim().length > 0;
  const activeKind = parsed ? kindOf(parsed) : undefined;
  // Whether the custom box is open is its own state, not something derived from
  // the value: switching to Custom from a preset seeds the box with that
  // preset's text, so the value alone can't tell the two modes apart. It also
  // keeps the box open if what you type happens to match a preset exactly.
  const [customMode, setCustomMode] = useState(false);
  const custom = customMode || (repeats && !activeKind);

  const pick = (expr: string) => {
    onChange(expr);
    setCustomMode(false);
  };
  /** Rewrite the rule through the parser so the stored text stays canonical. */
  const amend = (patch: Partial<Recurrence>) => {
    if (parsed) {
      onChange(formatRecurrence({ ...parsed, ...patch }));
    }
  };

  // Where the series begins: the start date if one is set, otherwise the slot the
  // rule picks for itself from today.
  const firstDate = useMemo(() => {
    if (due.trim()) {
      return due.trim();
    }
    return parsed ? firstOccurrence({ ...parsed, until: until || undefined }, today()) : undefined;
  }, [parsed, due, until]);

  const dueParts = parseISODate(due) ?? parseISODate(today())!;
  // A rule that names no day behaves as if it named the due date's — show that,
  // so the control reflects what will actually happen.
  const selectedWeekdays = parsed?.weekdays?.length
    ? parsed.weekdays
    : [weekdayOf(parseISODate(due) ? due : today())];
  const selectedMonthDay = parsed?.monthDay ?? dueParts.d;

  const toggleWeekday = (day: number) => {
    const next = selectedWeekdays.includes(day)
      ? selectedWeekdays.filter((d) => d !== day)
      : [...selectedWeekdays, day];
    // Never leave a weekly rule with nothing to land on.
    if (!next.length) {
      return;
    }
    amend({ weekdays: next.sort((a, b) => a - b) });
  };

  return (
    <div>
      <label className="block font-semibold text-[14px] mb-[10px]">
        Repeat <span className="text-neutral-625 font-normal">(optional)</span>
      </label>
      <div className="flex flex-wrap gap-2 mb-[10px]">
        <button type="button" onClick={() => pick('')} className={chipClass(!repeats && !customMode)}>
          Never
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => pick(seedFor(p.kind, due))}
            className={chipClass(!customMode && activeKind === p.kind)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCustomMode(true);
            // Seed the box from the current rule so switching to Custom starts
            // from what's selected rather than a blank field.
            if (!value.trim()) {
              onChange('every 3 days');
            }
          }}
          className={chipClass(custom)}
        >
          Custom
        </button>
      </div>

      {custom && (
        <Field
          className="mb-[10px]"
          help={
            <>
              e.g. <code>daily</code>, <code>weekdays</code>, <code>every 3 days</code>,{' '}
              <code>weekly on mon,thu</code>, <code>monthly on last</code>, <code>yearly on 03-14</code>
            </>
          }
        >
          <Input
            size="lg"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Custom repeat rule"
            placeholder="every 3 days"
            className="w-full"
          />
        </Field>
      )}

      {repeats && !parsed && (
        <div className="text-[12.5px] text-danger-675 mb-[10px]">
          Not a repeat rule I understand — the task will be saved without one.
        </div>
      )}

      {parsed?.unit === 'week' && (
        <div className="mb-[14px]">
          <WeekdayPicker selected={selectedWeekdays} onToggle={toggleWeekday} />
        </div>
      )}
      {parsed?.unit === 'month' && (
        <div className="mb-[14px]">
          <MonthDayPicker value={selectedMonthDay} onChange={(day) => amend({ monthDay: day })} />
        </div>
      )}

      {/* Both bounds of the series. The start date is what fixes a multi-interval
          rule's phase — "every 3 months on the 1st" is the same rule whether it
          runs Jan/Apr/Jul or Feb/May/Aug, and only this says which. */}
      {repeats && (
        <div className="flex flex-wrap gap-[14px] mb-[14px]">
          <DateField label="Starts on" value={due} onChange={onDueChange} />
          <DateField label="Until" value={until} onChange={onUntilChange} />
        </div>
      )}

      {parsed && (
        <>
          <div>
            <label className="block font-semibold text-[13px] mb-[6px]">Next one is measured from</label>
            <div className="flex border border-neutral-400 rounded-[7px] overflow-hidden text-[12.5px] w-fit">
              <button
                type="button"
                onClick={() => onAnchorChange('schedule')}
                title="Missing one occurrence doesn't move the others"
                className={
                  'px-[12px] py-[6px] cursor-pointer ' +
                  (anchor === 'schedule' ? 'bg-brand-225 text-brand-800 font-semibold' : 'bg-white text-neutral-700')
                }
              >
                The schedule
              </button>
              <button
                type="button"
                onClick={() => onAnchorChange('completion')}
                title="The interval restarts on the day you actually complete it"
                className={
                  'px-[12px] py-[6px] cursor-pointer border-l border-neutral-400 ' +
                  (anchor === 'completion' ? 'bg-brand-225 text-brand-800 font-semibold' : 'bg-white text-neutral-700')
                }
              >
                When I complete it
              </button>
            </div>
          </div>
          <div className="text-[12.5px] text-neutral-625 mt-[10px]">
            {describeRecurrence({ ...parsed, anchor, until: until || undefined })}
            {formatRecurrence(parsed) !== value.trim() && (
              <span className="text-neutral-550"> · saved as “{formatRecurrence(parsed)}”</span>
            )}
            {/* Left empty, the start date is derived rather than filled in behind
                their back — so say out loud where the series will begin. */}
            {firstDate && <> · first one lands on {firstDate}</>}
          </div>
        </>
      )}
    </div>
  );
}
