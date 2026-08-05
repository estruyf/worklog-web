import React from 'react';
import { RefreshCwIcon, XIcon } from 'lucide-react';
import { Button, IconButton } from '../primitives';

/** Offered when a new build has installed and is waiting to take over.
 *
 *  The registration script in src/layouts/Layout.astro owns the service worker and
 *  raises `worklog:update-ready`; this owns the asking, and answers with
 *  `worklog:apply-update`. Split that way because the registration has to run on
 *  every page in the layout, while only /app has React to render a prompt in.
 *
 *  Unlike the sync Toast this does not time out — it is a standing offer, and the
 *  moment to take it is the user's. It sits a row above the toast band rather than
 *  beside it: a persistent bar and a transient one sharing a line collide exactly
 *  when a sync lands, and "Syncing…" next to "Update" would read as one message
 *  about the timesheet rather than two about different things. */
export function UpdatePrompt() {
  const [ready, setReady] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  React.useEffect(() => {
    // The latch covers the announcement that landed before this hydrated; the
    // listener covers every one after. See the note in Layout.astro.
    if (window.__worklogUpdateReady) {
      setReady(true);
    }
    const onReady = () => setReady(true);
    window.addEventListener('worklog:update-ready', onReady);
    return () => window.removeEventListener('worklog:update-ready', onReady);
  }, []);

  if (!ready) {
    return null;
  }

  const apply = () => {
    setApplying(true);
    // The page reloads on `controllerchange`, so there is no success state to
    // render here — only the moment between asking and the swap.
    window.dispatchEvent(new CustomEvent('worklog:apply-update'));
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-70 flex items-center gap-3 max-w-[calc(100vw-2rem)] rounded-control-md border border-neutral-400 bg-white text-control text-neutral-750 pl-4 pr-2 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    >
      <RefreshCwIcon size={14} className="shrink-0 text-brand-600" aria-hidden="true" />
      <span>A new version of Worklog is available.</span>
      <Button variant="primary" size="xs" onClick={apply} disabled={applying} className="shrink-0">
        {applying ? 'Reloading…' : 'Reload'}
      </Button>
      <IconButton aria-label="Dismiss" size="sm" onClick={() => setReady(false)}>
        <XIcon size={14} />
      </IconButton>
    </div>
  );
}
