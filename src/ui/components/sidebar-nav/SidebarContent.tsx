import React from 'react';
import type { AppView } from '../../model';
import { PlusIcon } from 'lucide-react';
import { useData, useUi } from '../../context';
import { navigateToView } from '../../router';
import { BrandMark } from './BrandMark';
import { NavList } from './NavList';
import { SidebarActions } from './SidebarActions';
import { RepoFooter, type SidebarRepoProps } from './RepoFooter';

/** The shared inner content — rendered once for the static desktop rail and once
 * for the mobile drawer. `onNavigate` lets the drawer close itself on selection. */
export function SidebarContent({ onNavigate, repoProps }: { onNavigate?: () => void; repoProps?: SidebarRepoProps }) {
  const { setSelectedDate } = useUi();
  const { noClients, today, openTaskForm } = useData();

  // Navigating away closes an open task detail overlay on its own — it rides the
  // same history entry the navigation replaces. Picking Day snaps back to today:
  // a date left over from browsing the calendar isn't what the tab means when you
  // deliberately click it.
  const go = (v: AppView) => {
    if (v === 'day' && today) {
      setSelectedDate(today);
    }
    navigateToView(v);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full">
      <BrandMark className="px-[10px] h-[52px] shrink-0" onNavigate={onNavigate} />

      {!noClients && (
        <>
          <div className="px-[10px] pb-3">
            <button
              onClick={() => {
                openTaskForm();
                onNavigate?.();
              }}
              className="flex items-center justify-center gap-[7px] w-full px-[14px] py-[9px] rounded-control-md text-control font-semibold cursor-pointer border border-brand-500 bg-brand-450 text-brand-800 hover:bg-brand-475"
              title="New task (⇧N)"
            >
              <PlusIcon size={15} />
              New task
              <kbd className="inline-flex items-center justify-center h-[18px] px-[5px] rounded-chip border border-brand-500 bg-brand-225 text-brand-800 text-eyebrow font-medium leading-none">
                ⇧N
              </kbd>
            </button>
          </div>

          <NavList onGo={go} />
        </>
      )}

      <div className="flex-1" />

      <SidebarActions onGo={go} onNavigate={onNavigate} />

      <RepoFooter {...repoProps} />
    </div>
  );
}
