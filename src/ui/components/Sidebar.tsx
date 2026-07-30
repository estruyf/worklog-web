import React from 'react';
import { XIcon } from 'lucide-react';
import { MobileTopBar, SidebarContent, type SidebarRepoProps } from './sidebar-nav';

export type { SidebarRepoProps };

/**
 * Left navigation rail. On md+ it's a static column in the app's flex-row shell;
 * below md it collapses to a top bar with a hamburger that slides the same
 * content in as an overlay drawer.
 */
export function Sidebar(repoProps: SidebarRepoProps = {}) {
  const [open, setOpen] = React.useState(false);

  // Close the drawer on Escape.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <MobileTopBar onOpenDrawer={() => setOpen(true)} />

      {/* Desktop static rail — pinned to the viewport so it never scrolls with the
          page content; `self-start` keeps the flex row from stretching it, which
          would leave sticky nothing to stick against. */}
      <aside className="hidden md:flex sticky top-0 self-start h-screen overflow-y-auto w-[228px] shrink-0 border-r border-neutral-400 bg-white">
        <div className="w-full">
          <SidebarContent repoProps={repoProps} />
        </div>
      </aside>

      {/* Mobile drawer + backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
      )}
      <aside
        className={
          'md:hidden fixed inset-y-0 left-0 z-50 w-[248px] bg-white border-r border-neutral-400 shadow-xl transition-transform duration-200 ease-out ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-[13px] right-[12px] flex items-center justify-center w-[30px] h-[30px] rounded-control-md text-neutral-700 cursor-pointer hover:bg-neutral-200"
          aria-label="Close navigation"
        >
          <XIcon size={17} />
        </button>
        <SidebarContent onNavigate={() => setOpen(false)} repoProps={repoProps} />
      </aside>
    </>
  );
}
