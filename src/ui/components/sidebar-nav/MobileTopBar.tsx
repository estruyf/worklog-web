import React from 'react';
import { CheckIcon, CloudOffIcon, MenuIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { Button, IconButton } from '../../primitives';
import { useData, useTaskFormBar, useUi } from '../../context';
import { useRoute } from '../../router';
import { BrandMark } from './BrandMark';

/** The phone's always-visible chrome: the drawer handle, the way home, search,
 *  and the one primary action. Search is here as well as in the drawer because
 *  it is the one action you reach for mid-task, and opening the drawer to get
 *  at it costs a tap and hides the view you were searching from.
 *
 *  The task form's own actions sit at the bottom of a long scroll, so while the
 *  form is up this offers Save in place of New — starting another task from
 *  inside the form makes no sense. The form publishes what this needs while it is
 *  mounted (see `useTaskFormBar`); its fields stay its own, so typing a title no
 *  longer re-renders the nav. */
export function MobileTopBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { openTaskFormInContext, openTodoForm, noClients, offline } = useData();
  const { setSearchOpen } = useUi();
  const route = useRoute();
  const onForm = route.name === 'taskForm';
  const isEdit = onForm && !!route.taskId;
  // The To-dos view's own "New to-do" is hidden on a phone, so this button stands
  // in for it — and a to-do needs no client, which is why it shows even when the
  // repo has none configured yet.
  const onTodos = route.name === 'view' && route.view === 'todos';
  // With a task open this is the phone's ⌘N: it starts a subtask of what you are
  // looking at. A to-do's subtask is another to-do, which is the whole reason it
  // goes through the contextual opener rather than starting a blank client task.
  const onTask = route.name === 'task';
  const taskForm = useTaskFormBar();
  const canSave = taskForm?.canSave ?? false;

  const openSearch = () => {
    setSearchOpen(true);
    requestAnimationFrame(() => document.getElementById('worklog-search-input')?.focus());
  };

  return (
    <div className="flex md:hidden items-center gap-2 h-[52px] px-3 border-b border-neutral-400 shrink-0 sticky top-0 z-40 bg-white">
      <IconButton variant="outline" onClick={onOpenDrawer} className="w-9 h-9" aria-label="Open navigation">
        <MenuIcon size={18} />
      </IconButton>
      <BrandMark />
      {/* The rail — where the offline state otherwise lives, on the Git sync
          button — is behind the drawer on a phone, and this is the case where
          you are most likely to be offline. */}
      {offline && (
        <span
          className="flex items-center gap-1 rounded-control-md border border-brand-500 bg-brand-225 px-1.5 py-0.5 text-brand-800 text-control"
          title="Offline — your changes are saved on this device and will sync when you reconnect"
        >
          <CloudOffIcon size={14} />
          Offline
        </span>
      )}
      <div className="flex-1" />
      <IconButton variant="outline" onClick={openSearch} className="w-9 h-9" aria-label="Search">
        <SearchIcon size={18} />
      </IconButton>
      {onForm ? (
        <Button variant="primary" size="md" onClick={() => taskForm?.submit()} disabled={!canSave} className="h-9">
          <CheckIcon size={15} />
          {isEdit ? 'Save' : 'Add'}
        </Button>
      ) : (
        (onTodos || onTask || !noClients) && (
          <Button
            variant="primary"
            size="md"
            onClick={onTodos ? openTodoForm : openTaskFormInContext}
            title={onTask ? 'Add a task under the one you are looking at' : undefined}
            className="h-9"
          >
            <PlusIcon size={15} />
            New
          </Button>
        )
      )}
    </div>
  );
}
