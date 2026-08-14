import React from 'react';
import type { AppView } from '../../model';
import { PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon } from 'lucide-react';
import { useData, useUi } from '../../context';
import { navigateToView } from '../../router';
import { BrandMark } from './BrandMark';
import { NavList } from './NavList';
import { SidebarActions } from './SidebarActions';
import { RepoFooter, type SidebarRepoProps } from './RepoFooter';

/** The shared inner content — rendered once for the static desktop rail and once
 * for the mobile drawer. `onNavigate` lets the drawer close itself on selection.
 * `collapsed` is the desktop icons-only rail; the drawer never passes it, and
 * without `onToggleCollapsed` no toggle is offered (see `Sidebar`). */
export function SidebarContent({
  onNavigate,
  repoProps,
  collapsed = false,
  onToggleCollapsed,
}: {
  onNavigate?: () => void;
  repoProps?: SidebarRepoProps;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
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
      {/* Collapsed, the glyph and the toggle stack rather than sharing the 52px
          header row: side by side in 60px they would both be cramped, and the
          wordmark's row is the one piece of chrome that has to stay recognisable. */}
      <div className={collapsed ? 'flex flex-col items-center shrink-0' : 'flex items-center gap-1 px-[10px] h-[52px] shrink-0'}>
        <BrandMark collapsed={collapsed} className={collapsed ? 'justify-center h-[52px]' : 'flex-1 min-w-0'} onNavigate={onNavigate} />
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="flex items-center justify-center shrink-0 w-[30px] h-[30px] rounded-control-md border border-transparent text-neutral-650 cursor-pointer hover:bg-neutral-200 hover:text-neutral-750"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpenIcon size={16} /> : <PanelLeftCloseIcon size={16} />}
          </button>
        )}
      </div>

      {/* Everything below the header scrolls together. The rail is taller than a
          phone's drawer — nav, actions and repo footer come to ~17 rows — and
          without this the tail of it is simply clipped off the bottom. `min-h-full`
          on the inner column is what keeps the spacer meaningful: when the content
          does fit, it still pushes the actions and footer to the bottom edge. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex flex-col min-h-full">
          {!noClients && (
            <>
              <div className={collapsed ? 'px-[10px] pt-3 pb-3' : 'px-[10px] pb-3'}>
                <button
                  onClick={() => {
                    openTaskForm();
                    onNavigate?.();
                  }}
                  className={
                    'flex items-center justify-center gap-[7px] w-full rounded-control-md text-control font-semibold cursor-pointer border border-brand-500 bg-brand-450 text-brand-800 hover:bg-brand-475 ' +
                    (collapsed ? 'px-0 py-[9px]' : 'px-[14px] py-[9px]')
                  }
                  title="New task (⇧N)"
                >
                  <PlusIcon size={15} />
                  {!collapsed && (
                    <>
                      New task
                      <kbd className="inline-flex items-center justify-center h-[18px] px-[5px] rounded-chip border border-brand-500 bg-brand-225 text-brand-800 text-eyebrow font-medium leading-none">
                        ⇧N
                      </kbd>
                    </>
                  )}
                </button>
              </div>

              <NavList onGo={go} collapsed={collapsed} />
            </>
          )}

          <div className="flex-1" />

          <SidebarActions onGo={go} onNavigate={onNavigate} collapsed={collapsed} />

          <RepoFooter {...repoProps} collapsed={collapsed} />
        </div>
      </div>
    </div>
  );
}
