import React, { useState } from 'react';
import { Chip, LinkButton, SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';

/** How many tag chips show before the row collapses behind "+n more". */
const TAG_CHIP_LIMIT = 12;

/** A filter in its own right: with tags picked and the query empty, the results
 *  below are everything carrying them. Renders nothing when no task is tagged. */
export function TagFilterBar() {
  const { allTags, toggleTagFilter, clearTagFilter } = useData();
  const { tagFilter } = useUi();
  const [allTagsShown, setAllTagsShown] = useState(false);

  if (allTags.length === 0) {
    return null;
  }

  // Selected tags stay visible even when the row is collapsed, so a filter can
  // always be switched off where it was switched on.
  const visibleTags = allTagsShown
    ? allTags
    : allTags.filter((t, i) => i < TAG_CHIP_LIMIT || tagFilter.includes(t.tag));
  const hiddenTagCount = allTags.length - visibleTags.length;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-[14px]">
      <SectionLabel className="mr-[2px]">Tags</SectionLabel>
      {visibleTags.map(({ tag, count: n }) => {
        const active = tagFilter.includes(tag);
        return (
          <Chip
            key={tag}
            selected={active}
            onClick={() => toggleTagFilter(tag)}
            title={active ? `Stop filtering by "${tag}"` : `Filter by "${tag}"`}
          >
            {tag}
            <span className={'text-eyebrow tabular-nums ' + (active ? 'text-brand-650' : 'text-neutral-625')}>{n}</span>
          </Chip>
        );
      })}
      {hiddenTagCount > 0 && (
        <LinkButton onClick={() => setAllTagsShown(true)} className="px-1">
          +{hiddenTagCount} more
        </LinkButton>
      )}
      {tagFilter.length > 0 && (
        <LinkButton onClick={clearTagFilter} className="px-1">
          Clear tags
        </LinkButton>
      )}
    </div>
  );
}
