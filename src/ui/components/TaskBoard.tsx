// The status board: one column per status, one card per task, dragged between
// them. Which columns exist is `boardColumns`; this only groups the rows it is
// handed and turns a drop into the move the card already carries.
//
// A card is its own `@container`, and a narrow one — so the row inside it
// renders `WorklogTaskRow`'s stacked layout, which is already the card a board
// needs: the tick, the title, the overflow menu, and a meta line under them. The
// alternative was a second way of drawing a task, which is a second place for
// the two to drift apart. The closing column's cards are `CompletedTaskRow` for
// the same reason — a closed task has no tick to press and no worked-on state,
// it has a way back.
//
// Rows are rendered directly rather than through `TaskTable` (whose note says
// views shouldn't): a board has no shared column strip to line the cards up
// against, and each card needs a drag source wrapped around it.
//
// The status picker on every open card is the point, not a leftover duplicate of
// the column heading. A drag is mouse-only, and moving a task has to work with a
// thumb and with a keyboard too — the same reason the checklist rows carry
// "Move to ..." in their menu, and why a closed card keeps its reopen button.

import React, { useId, useMemo, useState } from 'react';
import type { Task } from '../../model/types';
import type { WorklogRow } from '../model';
import type { BoardColumn } from '../utils';
import { Card, SectionLabel, cn } from '../primitives';
import { CompletedTaskRow } from './CompletedTaskRow';
import { useTaskTableLayout, type TaskTableLayout } from './TaskTable';
import { WorklogTaskRow } from './WorklogTaskRow';

/** Whose task a card is. Only for a board that mixes clients — a client's own
 *  board would be the same name on every card. */
export interface BoardCardClient {
  name: string;
  color: string;
}

/** A closed task on the terminal column. Not a `WorklogRow`: what a closed task
 *  offers is a way out of the archive, not a tick and a worked-on toggle. */
export interface DoneBoardCard {
  /** The task's id — what the drag carries, same as an open row's. */
  id: string;
  task: Task;
  client?: BoardCardClient;
  /** The one fact the column isn't already saying — the completion date on a
   *  client's board, nothing on a day's, where every card closed that day. */
  meta?: React.ReactNode;
  onOpen: () => void;
  /** The card's own button: back to the status a reopened task starts in, with
   *  the toast and Undo the lists give it. */
  onReopen: () => void;
  /** Dragged out to a working column: back into *that* one, not the default. */
  onSelect: (statusId: string) => void;
}

/** What the terminal column holds. `more` is what the cap left in the archive —
 *  said out loud, because a column that silently stops at twenty is a column
 *  that lies about how much is behind you. */
export interface BoardDone {
  cards: DoneBoardCard[];
  more: number;
}

const EMPTY_DONE: BoardDone = { cards: [], more: 0 };

/** The client strip a card wears on a board that mixes them. Above the row
 *  rather than inside it: the client is a property of the board's *mix*, not of
 *  a task, and the lists that draw a task already say whose it is by the card it
 *  sits in. */
function CardClient({ client }: { client: BoardCardClient }) {
  return (
    <div className="flex items-center gap-[6px] px-2.5 pt-[7px] -mb-[4px]">
      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: client.color }} aria-hidden="true" />
      <span className="min-w-0 truncate text-eyebrow font-medium text-neutral-650">{client.name}</span>
    </div>
  );
}

/** The box every card sits in, and the drag source. The wrapper drags rather
 *  than the row, so the row stays the one the lists render — buttons inside a
 *  draggable element still take their clicks. */
function DragCard({
  title,
  dragging,
  onDragStart,
  onDragEnd,
  children,
}: {
  /** What goes on the drag's data transfer — Firefox starts no drag without it. */
  title: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', title);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      radius="panel"
      className={cn('@container cursor-grab active:cursor-grabbing', dragging && 'opacity-40')}
    >
      {children}
    </Card>
  );
}

/** One column: its status, what sits in it, and everything dropped on it. The
 *  whole body is the target, empty space included — aiming at the gap under the
 *  last card is how a column with two tasks in it gets a third. */
function BoardColumnView({
  column,
  rows,
  done,
  more,
  clientOf,
  layout,
  idPrefix,
  fill,
  dragId,
  over,
  onDragStart,
  onDragEnd,
  onOver,
  onDrop,
}: {
  column: BoardColumn;
  rows: WorklogRow[];
  /** The closed cards and the archive's overflow, on the terminal column only. */
  done: DoneBoardCard[];
  more: number;
  clientOf?: (row: WorklogRow) => BoardCardClient | undefined;
  layout: TaskTableLayout;
  idPrefix: string;
  fill: boolean;
  dragId: string | null;
  over: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onOver: () => void;
  onDrop: () => void;
}) {
  const count = rows.length + done.length;
  return (
    <section
      aria-label={`${column.name} — ${count} task${count === 1 ? '' : 's'}`}
      className={cn('w-[292px] shrink-0 flex flex-col', fill && 'h-full min-h-0')}
    >
      <div className="flex items-center gap-[7px] px-[3px] pb-[9px]">
        <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: column.color }} aria-hidden="true" />
        <SectionLabel size="sm" className="min-w-0">
          <span className="truncate">{column.name}</span>
        </SectionLabel>
        <span className="text-eyebrow text-neutral-625 tabular-nums">{count}</span>
      </div>
      <div
        onDragOver={(e) => {
          if (!dragId) {
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onOver();
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop();
        }}
        className={cn(
          'flex-1 min-h-[96px] flex flex-col gap-[7px] p-[7px] rounded-card border border-dashed',
          // Filling the screen, each column scrolls on its own — which is the
          // point of the full-window board: the headings stay put and a long
          // column doesn't push the short ones off the bottom of the page.
          fill && 'min-h-0 overflow-y-auto overscroll-contain',
          over ? 'border-brand-500 bg-brand-50' : 'border-neutral-375 bg-neutral-50',
        )}
      >
        {rows.map((row) => {
          const client = clientOf?.(row);
          return (
            <DragCard
              key={row.id}
              title={row.title}
              dragging={dragId === row.id}
              onDragStart={() => onDragStart(row.id)}
              onDragEnd={onDragEnd}
            >
              {client && <CardClient client={client} />}
              <WorklogTaskRow row={row} layout={layout} idPrefix={idPrefix} />
            </DragCard>
          );
        })}
        {done.map((card) => (
          <DragCard
            key={card.id}
            title={card.task.title}
            dragging={dragId === card.id}
            onDragStart={() => onDragStart(card.id)}
            onDragEnd={onDragEnd}
          >
            {card.client && <CardClient client={card.client} />}
            {/* No status word on the card: it is the column, and every card here
                would carry the same one. */}
            <CompletedTaskRow task={card.task} onOpen={card.onOpen} onReopen={card.onReopen} meta={card.meta} showLink />
          </DragCard>
        ))}
        {more > 0 && (
          <p className="m-0 px-2.5 py-1 text-eyebrow text-neutral-625">
            +{more} more in the archive
          </p>
        )}
      </div>
    </section>
  );
}

export interface TaskBoardProps {
  columns: BoardColumn[];
  /** The open tasks to lay out. Every row carries a status — the board is only
   *  offered on lists where it says something (see `useTaskListFilter`'s
   *  `withStatus`), so nothing here can fall between the columns. */
  rows: WorklogRow[];
  /** What the closing column shows. Left out, it is a drop target and nothing
   *  else. */
  done?: BoardDone;
  /** Says whose each card is, for a board that spans clients — the day's does.
   *  Left out, no card carries a client. */
  clientOf?: (row: WorklogRow) => BoardCardClient | undefined;
  /** Take the height on offer and let each column scroll inside it, rather than
   *  growing with the longest one and scrolling the page. For the full-window
   *  board; an inline board sits in a page that scrolls as a whole. */
  fill?: boolean;
  className?: string;
}

export function TaskBoard({ columns, rows, done = EMPTY_DONE, clientOf, fill = false, className }: TaskBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Namespaces the cards' element ids, the way `TaskRows` does for a list.
  const idPrefix = useId();
  // One layout for the whole board rather than per column, so the cards in one
  // column indent their meta line the same as the cards in the next.
  const layout = useTaskTableLayout(rows);

  const grouped = useMemo(() => {
    const byId = new Map<string, WorklogRow[]>(columns.map((c) => [c.id, []]));
    for (const row of rows) {
      byId.get(row.status?.id ?? '')?.push(row);
    }
    return byId;
  }, [columns, rows]);

  const drop = (column: BoardColumn) => {
    const row = rows.find((r) => r.id === dragId);
    const card = done.cards.find((c) => c.id === dragId);
    setDragId(null);
    setOverId(null);
    if (row?.status) {
      if (column.terminal) {
        // The tick's path, not a bare write of the closing status: closing
        // archives the task and cascades to its open subtasks, and this is the
        // one that says so in a toast with an Undo on it.
        row.onDone();
      } else if (row.status.id !== column.id) {
        row.status.onSelect(column.id);
      }
    } else if (card && !column.terminal) {
      card.onSelect(column.id);
    }
  };

  return (
    <div className={cn('flex items-stretch gap-3 overflow-x-auto pb-2', fill && 'min-h-0', className)}>
      {columns.map((column) => (
        <BoardColumnView
          key={column.id}
          column={column}
          rows={grouped.get(column.id) ?? []}
          done={column.terminal ? done.cards : []}
          more={column.terminal ? done.more : 0}
          clientOf={clientOf}
          layout={layout}
          idPrefix={idPrefix}
          fill={fill}
          dragId={dragId}
          over={overId === column.id}
          onDragStart={setDragId}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          onOver={() => setOverId(column.id)}
          onDrop={() => drop(column)}
        />
      ))}
    </div>
  );
}
