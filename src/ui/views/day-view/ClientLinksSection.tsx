import React from 'react';
import { ExternalLinkIcon } from 'lucide-react';
import { Card, SectionLabel } from '../../primitives';
import type { ClientLinkGroup } from '../../utils';

/** The reference links of the clients whose work is on the day being viewed —
 *  their board, their repo, the shared drive. It sits above the to-dos in the
 *  side column because it is what you reach for *before* logging time, and
 *  because it is short and stable where the to-do list under it paginates.
 *
 *  Renders nothing when the day's clients carry no links, so a repo that never
 *  fills them in doesn't grow an empty box on every day. */
export function ClientLinksSection({ groups }: { groups: ClientLinkGroup[] }) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <>
      <SectionLabel className="mb-3">Links</SectionLabel>
      <Card padding="md" className="mb-[34px] flex flex-col gap-[14px]">
        {groups.map((g) => (
          <div key={g.id} className="min-w-0">
            <div className="flex items-center gap-[9px] mb-[6px]">
              <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: g.color }} />
              <span className="font-bold text-row truncate">{g.name}</span>
            </div>
            <div className="flex flex-col gap-1 pl-[18px]">
              {g.links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={l.url}
                  className="flex items-center gap-[7px] text-control-lg text-info hover:underline max-w-full"
                >
                  <ExternalLinkIcon size={14} className="shrink-0" />
                  <span className="truncate">{l.label || l.url}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
