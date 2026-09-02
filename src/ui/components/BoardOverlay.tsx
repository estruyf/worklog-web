// The board with the rest of the app out of the way: a full-window overlay over
// whichever view opened it. A board is the one thing here that pays for the
// whole screen — every extra 300px is another status you can see at once, and a
// sidebar plus a client rail is two columns' worth of it.
//
// It carries the list's own toolbar rather than a set of filters of its own, so
// what you had narrowed on the page is what you are looking at here, and closing
// it puts you back on a list narrowed the same way.
//
// A `Modal` and not a route: Escape, the focus trap and the way back to the
// button that opened it are exactly what a dialog already owes the keyboard, and
// this needs all three. The × is its own because a full-bleed panel leaves no
// backdrop to click on.

import React from 'react';
import { XIcon } from 'lucide-react';
import type { WorklogRow } from '../model';
import type { BoardColumn } from '../utils';
import { IconButton, Modal, cn } from '../primitives';
import { TaskListToolbar, type TaskListToolbarProps } from './task-list-toolbar';
import { TaskBoard, type BoardCardClient, type BoardDone } from './TaskBoard';

export interface BoardOverlayProps {
  /** What the board is of — the client, or the day. */
  title: string;
  columns: BoardColumn[];
  rows: WorklogRow[];
  done?: BoardDone;
  clientOf?: (row: WorklogRow) => BoardCardClient | undefined;
  /** The filters the page was already narrowed by, or null for a list too short
   *  to have had a toolbar. */
  toolbar: TaskListToolbarProps | null;
  /** Shown in place of the board when there is no open task to lay out — the
   *  call site knows whether that is an empty list or a filter that hid it. */
  empty: React.ReactNode;
  onClose: () => void;
}

export function BoardOverlay({ title, columns, rows, done, clientOf, toolbar, empty, onClose }: BoardOverlayProps) {
  return (
    <Modal placement="full" padding="none" onClose={onClose} label={`${title} — status board`}>
      <header className={cn('shrink-0 border-b border-neutral-375 px-5 pt-4', toolbar ? 'pb-[5px]' : 'pb-4')}>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[17px] leading-[1.35] font-bold m-0 min-w-0 truncate">{title}</h2>
          {/* Not said on a phone, where it isn't true: a drag needs a mouse, and
              the status picker on each card is the way there under a thumb. */}
          <span className="hidden md:inline shrink-0 text-control text-neutral-675">Drag a card into another column to move it</span>
          <IconButton
            size="sm"
            variant="outline"
            onClick={onClose}
            aria-label="Close the board"
            title="Close the board (Esc)"
            className="ml-auto"
          >
            <XIcon size={15} />
          </IconButton>
        </div>
        {toolbar && <TaskListToolbar {...toolbar} surface="page" />}
      </header>

      <div className="flex-1 min-h-0 flex px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        {rows.length === 0 && (done?.cards.length ?? 0) === 0 ? (
          <div className="flex-1">{empty}</div>
        ) : (
          <TaskBoard fill columns={columns} rows={rows} done={done} clientOf={clientOf} className="flex-1" />
        )}
      </div>
    </Modal>
  );
}
