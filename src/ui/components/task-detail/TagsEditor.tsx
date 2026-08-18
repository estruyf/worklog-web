import React, { useMemo, useState } from 'react';
import type { Task } from '../../../model/types';
import { Chip, LinkButton, SidebarSection } from '../../primitives';
import { useData } from '../../context';
import { TagPicker } from '../TagPicker';
import { worklogStore } from '../../../data/worklogStore';

/** The task's tags as a block in the detail panel's rail: chips that jump to the
 *  tag-filtered search, and one click to change the set without opening the form.
 *
 *  Two modes rather than a picker that is always open, because a tag chip here
 *  already means "show me everything like this" — a picker in its place would
 *  take that click away, and the rail is read far more often than it is edited.
 *  Editing writes on every change, like every other block in this rail; there is
 *  no Save to press.
 *
 *  The block stands with no tags at all, for the reason `ParentEditor` does: a
 *  rail that hides the field until the task is already tagged is a rail you
 *  cannot tag from. */
export function TagsEditor({ task }: { task: Task }) {
  const { allTags, openTagSearch } = useData();
  const [editing, setEditing] = useState(false);
  const known = useMemo(() => allTags.map((t) => t.tag), [allTags]);
  const tags = task.tags ?? [];

  if (editing) {
    return (
      <SidebarSection title="Tags" hint="pick existing or create">
        <TagPicker
          value={tags}
          onChange={(next) => worklogStore.updateTask(task.id, { tags: next })}
          known={known}
          autoFocus
        />
        <div className="flex justify-end mt-[8px]">
          <LinkButton onClick={() => setEditing(false)}>Done</LinkButton>
        </div>
      </SidebarSection>
    );
  }

  return (
    <SidebarSection title="Tags">
      <div className="flex flex-wrap items-center gap-[6px]">
        {/* Tags jump to the tag-filtered search. They stayed inert while the task
            had a page of its own, which didn't mount the overlay; the task route
            lives in the dashboard now, so they lead somewhere again. */}
        {tags.map((tag) => (
          <Chip key={tag} variant="tag" onClick={() => openTagSearch(tag)} title={`Show everything tagged "${tag}"`}>
            {tag}
          </Chip>
        ))}
        <LinkButton onClick={() => setEditing(true)}>{tags.length > 0 ? 'Edit' : 'Add tags'}</LinkButton>
      </div>
    </SidebarSection>
  );
}
