import React, { useCallback, useMemo, useState } from 'react';
import type { WorklogRow } from '../model';
import { Maximize2Icon, PencilIcon } from 'lucide-react';
import { BoardOverlay, TaskBoard, TaskListToolbar, TaskTable } from '../components';
import type { BoardDone } from '../components';
import { Badge, Button, Card, EmptyState, IconButton, LinkButton, SectionLabel, SegmentedControl, ViewHeader } from '../primitives';
import { useData, useUi } from '../context';
import { useTaskListFilter } from '../hooks';
import { boardColumns, clientIdOf, fmtLong, fmtShort, isDone, topLevelTasks, BOARD_DONE_LIMIT } from '../utils';
import { ClientInfoCard, ClientList, CompletedTaskList, MobileClientDropdown } from './clients-view';

/** How the open tasks are drawn: one ordered list, or a column per status. */
type TaskLayout = 'list' | 'board';

const LAYOUT_KEY = 'worklog:clientTaskLayout';

/** Remembered per device rather than in the repo, for the same reason the folds
 *  are (see `useCollapsedTasks`): it is how one person is looking at one list
 *  right now, not a preference worth a commit on every toggle. */
function useTaskLayout(): [TaskLayout, (next: TaskLayout) => void] {
  const [layout, setLayout] = useState<TaskLayout>(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === 'board' ? 'board' : 'list';
    } catch {
      // Storage can be blocked outright (private mode), where reading throws.
      return 'list';
    }
  });
  const change = useCallback((next: TaskLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // A preference that can't be stored still applies to this session.
    }
  }, []);
  return [layout, change];
}

/** The two ways an open-task list comes up empty — nothing to do, or a filter
 *  hiding everything — said the same way in both layouts. */
function NoOpenTasks({ total, onReset }: { total: number; onReset: () => void }) {
  return (
    <EmptyState className="py-2 px-2.5">
      {total === 0 ? (
        'No open tasks.'
      ) : (
        <>
          No open tasks match these filters.{' '}
          <LinkButton size="inherit" onClick={onReset} className="italic underline">
            Reset
          </LinkButton>
        </>
      )}
    </EmptyState>
  );
}

/** Derives the selected client's open rows, done list, counts and last-worked label. */
function useClientsData(layout: TaskLayout) {
  const { tasks, worklog, clients, allClients, archivedClients, statuses, today, colorOf, makeRow, openRowsFor, openDetail, reopen, setTaskStatus } = useData();
  const { selectedClient } = useUi();

  const openTasks = useMemo(() => tasks.filter((t) => !isDone(t)), [tasks]);
  // Selection resolves against every client: an archived one is still openable
  // from the archived list below, it just isn't offered by default.
  const selectedClientObj = useMemo(() => allClients.find((c) => c.id === selectedClient), [allClients, selectedClient]);
  const clientOpenCounts = useMemo(
    () => Object.fromEntries(allClients.map((c) => [c.id, openTasks.filter((t) => clientIdOf(t) === c.id).length])),
    [allClients, openTasks],
  );
  const scOpen = useMemo(() => tasks.filter((t) => clientIdOf(t) === selectedClient && !isDone(t)), [tasks, selectedClient]);
  // Keyed on the client: switching to another one starts from an unfiltered list
  // rather than making its tasks look absent.
  // The board *is* the status grouping, so it drops the status filter: narrowing
  // to one status there would leave a board of one column.
  const openFilter = useTaskListFilter(scOpen, {
    label: 'open tasks',
    resetKey: selectedClient,
    withStatus: layout === 'list',
  });
  const selectedOpenRows = useMemo<WorklogRow[]>(
    () => openRowsFor(openFilter.tasks, openFilter.expanded),
    [openRowsFor, openFilter.tasks, openFilter.expanded],
  );
  // Columns come from every open task of the client, not the filtered set, so a
  // column doesn't come and go while a query is being typed.
  const openColumns = useMemo(() => boardColumns(statuses, scOpen), [statuses, scOpen]);
  // Flat, one card per task: a board column is a set of cards, and a subtask
  // drawn indented under its parent would be a subtask sitting in whatever
  // column its parent happened to be in. Each carries its own status, so each
  // gets its own card.
  const openBoardRows = useMemo<WorklogRow[]>(
    () => (layout === 'list' ? [] : openFilter.tasks.map((t) => makeRow(t, false))),
    [layout, openFilter.tasks, makeRow],
  );
  const selectedDone = useMemo(
    () => tasks.filter((t) => clientIdOf(t) === selectedClient && isDone(t)).sort((a, b) => (b.completed! > a.completed! ? 1 : -1)),
    [tasks, selectedClient],
  );
  // What the board's closing column shows: the most recently closed, capped —
  // the rest is the archive's, and the column says how much of it there is.
  const boardDone = useMemo<BoardDone>(() => {
    if (layout === 'list') {
      return { cards: [], more: 0 };
    }
    const shown = selectedDone.slice(0, BOARD_DONE_LIMIT);
    return {
      cards: shown.map((t) => ({
        id: t.id,
        task: t,
        meta: t.completed ? fmtShort(t.completed) : undefined,
        onOpen: () => openDetail(t),
        onReopen: () => void reopen(t),
        onSelect: (statusId: string) => setTaskStatus(t.id, statusId),
      })),
      more: selectedDone.length - shown.length,
    };
  }, [layout, selectedDone, openDetail, reopen, setTaskStatus]);
  const selectedLastWorked = useMemo(() => {
    const lastWorked = worklog
      .filter((w) => w.clientId === selectedClient)
      .map((w) => w.date)
      .sort()
      .pop();
    return lastWorked ? (lastWorked === today ? 'last worked today' : 'last worked ' + fmtLong(lastWorked)) : 'no time logged yet';
  }, [worklog, today, selectedClient]);

  return {
    clients,
    archivedClients,
    selectedColor: colorOf(selectedClient),
    selectedName: selectedClientObj?.name ?? '',
    selectedClientObj,
    clientOpenCounts,
    selectedOpenRows,
    // Parent tasks only, like every other count in the lists: a subtask is part
    // of the task above it, not a second thing on this client's plate.
    selectedOpenCount: topLevelTasks(scOpen).length,
    openColumns,
    openBoardRows,
    boardDone,
    openFilter,
    selectedDone,
    selectedLastWorked,
  };
}

export function ClientsView() {
  const { openClientEditor, setClientArchived } = useData();
  const [taskLayout, setTaskLayout] = useTaskLayout();
  const [boardFullWindow, setBoardFullWindow] = useState(false);
  const {
    clients,
    archivedClients,
    selectedColor,
    selectedName,
    selectedClientObj,
    clientOpenCounts,
    selectedOpenRows,
    selectedOpenCount,
    selectedDone,
    selectedLastWorked,
    openColumns,
    openBoardRows,
    boardDone,
    openFilter,
  } = useClientsData(taskLayout);
  const addClient = () => openClientEditor();
  const clientDescription = selectedClientObj?.description?.trim() ?? '';
  const clientLinks = selectedClientObj?.links ?? [];
  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      <MobileClientDropdown
        clients={clients}
        archivedClients={archivedClients}
        selectedName={selectedName}
        clientOpenCounts={clientOpenCounts}
        onAdd={addClient}
      />
      <ClientList
        clients={clients}
        archivedClients={archivedClients}
        clientOpenCounts={clientOpenCounts}
        onAdd={addClient}
      />

      {/* The client's own column: which client you are on, and the two things you
          can do to it, stay in the band while its task lists scroll. Full width
          rather than the centred column the other views use — this pane is
          already narrowed by the two rails to its left. */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        <ViewHeader className="flex items-center flex-wrap gap-[14px]">
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: selectedColor }} />
          <h1 className="text-[24px] font-bold m-0">{selectedName}</h1>
          {selectedClientObj?.archived && (
            <Badge tone="outline" size="sm" title="Hidden from the pickers and lists; its history is untouched">
              Archived
            </Badge>
          )}
          <span className="text-body text-neutral-675">{selectedLastWorked}</span>
          {selectedClientObj && (
            <Button size="xs" onClick={() => openClientEditor(selectedClientObj)} title="Edit client" className="ml-1">
              <PencilIcon size={13} />
              Edit
            </Button>
          )}
          {selectedClientObj?.archived && (
            <Button size="xs" onClick={() => setClientArchived(selectedClientObj, false)} title="Bring this client back into the pickers and lists">
              Restore
            </Button>
          )}
        </ViewHeader>

        <div className="flex-1 overflow-auto px-6 pt-6 pb-10">
          <ClientInfoCard description={clientDescription} links={clientLinks} />

          <div className="flex items-center justify-between gap-3 mb-[14px]">
            <SectionLabel>Open tasks · {selectedOpenCount}</SectionLabel>
            <div className="flex items-center gap-2 shrink-0">
              <SegmentedControl
                size="sm"
                options={[
                  { value: 'list', label: 'List', title: 'One list, in the order you sorted it' },
                  { value: 'board', label: 'Board', title: 'A column per status — drag a task to move it' },
                ]}
                value={taskLayout}
                onChange={setTaskLayout}
                aria-label="How the open tasks are laid out"
              />
              {/* Only over a board: a list has nothing to gain from the extra
                  width, and the client rail beside it is how you reach another
                  client anyway. */}
              {taskLayout === 'board' && (
                <IconButton
                  size="sm"
                  variant="outline"
                  onClick={() => setBoardFullWindow(true)}
                  aria-label="Open the board in the full window"
                  title="Open the board in the full window"
                >
                  <Maximize2Icon size={14} />
                </IconButton>
              )}
            </div>
          </div>
          {taskLayout === 'board' ? (
            <>
              {openFilter.toolbar && (
                <Card padding="list" className="mb-[14px]">
                  <TaskListToolbar {...openFilter.toolbar} />
                </Card>
              )}
              {openBoardRows.length === 0 && boardDone.cards.length === 0 ? (
                <Card padding="list" className="mb-[38px]">
                  <NoOpenTasks total={selectedOpenCount} onReset={openFilter.reset} />
                </Card>
              ) : (
                <TaskBoard columns={openColumns} rows={openBoardRows} done={boardDone} className="mb-[38px]" />
              )}
            </>
          ) : (
            <Card padding="list" className="mb-[38px]">
              {openFilter.toolbar && <TaskListToolbar {...openFilter.toolbar} />}
              <TaskTable rows={selectedOpenRows} sort={openFilter.sort}>
                {selectedOpenRows.length === 0 && <NoOpenTasks total={selectedOpenCount} onReset={openFilter.reset} />}
              </TaskTable>
            </Card>
          )}

          <CompletedTaskList tasks={selectedDone} clientName={selectedName} />
        </div>
      </div>

      {boardFullWindow && (
        <BoardOverlay
          title={selectedName}
          columns={openColumns}
          rows={openBoardRows}
          done={boardDone}
          toolbar={openFilter.toolbar}
          empty={<NoOpenTasks total={selectedOpenCount} onReset={openFilter.reset} />}
          onClose={() => setBoardFullWindow(false)}
        />
      )}
    </div>
  );
}
