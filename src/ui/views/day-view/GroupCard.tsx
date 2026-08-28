import React from 'react';
import { DisclosureIcon, TaskRows, type TaskTableLayout } from '../../components';
import { Badge, Card, cn, type BadgeTone, type CardTone } from '../../primitives';
import { useData } from '../../context';
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

/** One client's slice of a list, as a card that can be shut.
 *
 *  The client's name lives here and nowhere else: repeating it down a column the
 *  reader scans eighteen times to read four values is width the titles need. The
 *  column header belongs to `TaskTableGroups` above, for the same reason — one
 *  header for the whole list, not the same four words on every card.
 *
 *  `layout` is the column set the *view* built across every card, so one client's
 *  due dates sit under the next one's. Collapsed state is per client and per
 *  repo, shared by every grouped list, so a client you have shut stays shut. */
export function GroupCard({
  group,
  tone = 'plain',
  layout,
}: {
  group: ClientTaskGroup;
  tone?: GroupCardTone;
  layout: TaskTableLayout;
}) {
  const { collapsedClients, toggleCollapsedClient } = useData();
  const rowsId = React.useId();
  const collapsed = collapsedClients.has(group.id);

  return (
    <Card tone={CARDS[tone]} className="mb-[14px] overflow-hidden">
      {/* The strip keeps the tone; the button inside it spans the card so the
          whole header is the hit target. The two are apart because a button
          carrying `border-none` cannot then be given a bottom border back —
          border *style* does not resolve by attribute order. */}
      <div className={cn('flex', HEADERS[tone], !collapsed && 'border-b')}>
        <button
          onClick={() => toggleCollapsedClient(group.id)}
          aria-expanded={!collapsed}
          aria-controls={rowsId}
          title={collapsed ? `Show ${group.name}'s tasks` : `Hide ${group.name}'s tasks`}
          // The chevron takes the button's own colour and everything after it
          // states its own, so the one muted glyph doesn't drag the name with it.
          className="flex-1 min-w-0 flex items-center gap-[9px] px-[18px] py-[13px] whitespace-nowrap bg-transparent border-none cursor-pointer text-left text-neutral-600 hover:text-neutral-750"
        >
          <DisclosureIcon open={!collapsed} size={11} />
          <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: group.color }} />
          <span className="min-w-0 truncate font-bold text-row text-neutral-825">{group.name}</span>
          <Badge tone={BADGES[tone]} size="sm">
            {group.count}
          </Badge>
          <span className="ml-auto shrink-0 text-meta text-neutral-650 tabular-nums">
            {group.count} task{group.count === 1 ? '' : 's'}
          </span>
        </button>
      </div>
      <div id={rowsId} hidden={collapsed} className="px-2 py-[6px]">
        <TaskRows rows={group.rows} layout={layout} />
      </div>
    </Card>
  );
}
