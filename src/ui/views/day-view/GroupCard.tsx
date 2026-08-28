import React from 'react';
import { TaskTable, type TaskTableLayout, type TaskTableSort } from '../../components';
import { Badge, Card, cn, type BadgeTone, type CardTone } from '../../primitives';
import type { ClientTaskGroup } from '../../model';

/** What the group *is*, not what it looks like: `plain` is open work, `worked` is
 *  work already touched on the day being viewed, `overdue` is work that is late.
 *  The card, its header strip and its count badge then follow from that one word
 *  — they used to arrive as three class strings from the call site. */
export type GroupCardTone = 'plain' | 'worked' | 'overdue';

const CARDS: Record<GroupCardTone, CardTone> = { plain: 'plain', worked: 'brand', overdue: 'danger' };
const BADGES: Record<GroupCardTone, BadgeTone> = { plain: 'neutral', worked: 'brand', overdue: 'danger' };
const HEADERS: Record<GroupCardTone, string> = {
  plain: 'bg-neutral-75 border-neutral-275',
  worked: 'bg-brand-125 border-brand-350',
  overdue: 'bg-danger-75 border-danger-200',
};

/** `sort` is the list's order, passed on so each card gets the sortable column
 *  header; the views that group without a filter behind them leave it out.
 *  `layout` is the column set the *view* built across every card, so one client's
 *  due dates sit under the next one's. */
export function GroupCard({
  group,
  tone = 'plain',
  sort,
  layout,
}: {
  group: ClientTaskGroup;
  tone?: GroupCardTone;
  sort?: TaskTableSort;
  layout?: TaskTableLayout;
}) {
  return (
    <Card tone={CARDS[tone]} className="mb-[14px] overflow-hidden">
      <div className={cn('flex items-center gap-[9px] px-[18px] py-[13px] border-b whitespace-nowrap', HEADERS[tone])}>
        <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: group.color }} />
        <span className="font-bold text-row">{group.name}</span>
        <Badge tone={BADGES[tone]}>{group.count}</Badge>
      </div>
      <div className="px-2 py-[6px]">
        <TaskTable rows={group.rows} sort={sort} layout={layout} />
      </div>
    </Card>
  );
}
