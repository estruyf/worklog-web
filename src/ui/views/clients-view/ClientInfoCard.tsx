import React from 'react';
import type { TaskLink } from '../../../model/types';
import { Card } from '../../primitives';
import { LinkList } from '../../components';
import { renderMarkdown } from '../../utils';

/** Who the client is and where their things live — the context you want in front
 *  of you before touching their tasks. Renders nothing when there is neither, so
 *  the caller doesn't have to ask twice. */
export function ClientInfoCard({ description, links }: { description: string; links: TaskLink[] }) {
  if (!description && links.length === 0) {
    return null;
  }
  return (
    <Card padding="md" className="mb-7">
      {description && (
        <div
          className="wl-md text-body leading-[1.6] text-neutral-825"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(description) }}
        />
      )}
      <LinkList
        links={links}
        className={description ? 'mt-[14px] pt-[14px] border-t border-neutral-325' : ''}
      />

    </Card>
  );
}
