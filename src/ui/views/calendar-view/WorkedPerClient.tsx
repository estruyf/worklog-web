import React, { useState } from 'react';
import { Badge, Card, EmptyState, LinkButton, SectionLabel } from '../../primitives';
import { DisclosureIcon } from '../../components';
import { useData } from '../../context';
import { fmtShort, num, type ClientWorkGroup } from '../../utils';

export interface WorkedPerClientProps {
  groups: ClientWorkGroup[];
  isWeek: boolean;
  onOpenDay: (date: string) => void;
  onOpenTask: (id: string) => void;
}

/** The visible period's work, one collapsed row per client: over a month the task
 * lists add up to far more than a screen, so a row stays a single line — dot, name,
 * hours, task count — until it's opened. Its tasks then unfold underneath, each
 * with the days it was touched. */
export function WorkedPerClient({ groups, isWeek, onOpenDay, onOpenTask }: WorkedPerClientProps) {
  const { hoursPerDay } = useData();
  const [openIds, setOpenIds] = useState<string[]>([]);
  const totalHours = groups.reduce((sum, g) => sum + g.hours, 0);
  const daysOf = (hours: number) => (hoursPerDay ? num(Math.round((hours / hoursPerDay) * 100) / 100) : '0');
  const allOpen = groups.length > 0 && groups.every((g) => openIds.includes(g.id));
  const toggle = (id: string) => setOpenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="mt-10">
      <div className="flex items-center gap-[10px] mb-[14px]">
        <SectionLabel>{isWeek ? 'Worked this week' : 'Worked this month'}</SectionLabel>
        {totalHours > 0 && (
          <Badge tone="brand" size="sm">
            {num(totalHours)}h · {daysOf(totalHours)}d
          </Badge>
        )}
        {groups.length > 1 && (
          <LinkButton size="xs" onClick={() => setOpenIds(allOpen ? [] : groups.map((g) => g.id))} className="ml-auto">
            {allOpen ? 'Collapse all' : 'Expand all'}
          </LinkButton>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState>No time logged or tasks worked in this {isWeek ? 'week' : 'month'}.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          {groups.map((g, i) => {
            const open = openIds.includes(g.id);
            return (
              <div key={g.id} className={i > 0 ? 'border-t border-neutral-375' : ''}>
                <button
                  onClick={() => toggle(g.id)}
                  className={
                    'w-full flex items-center gap-[10px] px-[14px] py-[11px] border-none text-left cursor-pointer hover:bg-neutral-150 ' +
                    (open ? 'bg-neutral-100' : 'bg-transparent')
                  }
                >
                  <span className="text-neutral-625">
                    <DisclosureIcon open={open} />
                  </span>
                  <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: g.color }} />
                  <span className="font-semibold text-body truncate">{g.name}</span>
                  <span className="ml-auto flex items-center gap-[10px] shrink-0">
                    {g.hours > 0 && (
                      <span className="text-chip text-neutral-700 tabular-nums">
                        {num(g.hours)}h · {daysOf(g.hours)}d
                      </span>
                    )}
                    {g.items.length > 0 && <Badge>{g.items.length}</Badge>}
                  </span>
                </button>

                {open && (
                  <div className="px-2 pb-[8px] pl-[32px] bg-neutral-100">
                    {g.hours > 0 && (
                      <div className="px-2.5 pb-1 text-meta text-neutral-675 tabular-nums">
                        {num(g.hours)}h logged over {g.loggedDays} {g.loggedDays === 1 ? 'day' : 'days'}
                      </div>
                    )}
                    {g.items.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-x-[10px] gap-y-1 py-[6px] px-2.5 rounded-lg hover:bg-neutral-225">
                        <button
                          onClick={() => onOpenTask(item.id)}
                          title="Open task"
                          className={
                            'text-body text-left bg-transparent border-none p-0 cursor-pointer hover:underline ' +
                            (item.done ? 'text-neutral-700 line-through decoration-neutral-550' : 'text-neutral-825')
                          }
                        >
                          {item.title}
                        </button>
                        <span className="ml-auto flex flex-wrap gap-x-[8px] gap-y-1">
                          {item.dates.map((d) => (
                            <LinkButton key={d} size="xs" onClick={() => onOpenDay(d)} title="Open this day" className="tabular-nums">
                              {fmtShort(d)}
                            </LinkButton>
                          ))}
                        </span>
                      </div>
                    ))}
                    {g.items.length === 0 && (
                      <EmptyState size="sm" className="px-2.5 py-1">
                        No tasks marked as worked.
                      </EmptyState>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
