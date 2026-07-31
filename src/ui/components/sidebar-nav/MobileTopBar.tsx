import React from 'react';
import { CheckIcon, MenuIcon, PlusIcon, SearchIcon } from 'lucide-react';
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
  const { openTaskForm, noClients } = useData();
  const { setSearchOpen } = useUi();
  const route = useRoute();
  const onForm = route.name === 'taskForm';
  const isEdit = onForm && !!route.taskId;
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
        !noClients && (
          <Button variant="primary" size="md" onClick={openTaskForm} className="h-9">
            <PlusIcon size={15} />
            New
          </Button>
        )
      )}
    </div>
  );
}
