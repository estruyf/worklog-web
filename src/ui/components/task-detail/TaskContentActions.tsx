import React from 'react';
import { PaperclipIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import type { Task } from '../../../model/types';
import { useData, useUi } from '../../context';
import { canHaveSubtasks, isDone } from '../../utils';
import { useAttachmentUpload } from './useAttachmentUpload';

/** One entry in the row: a quiet icon-and-label, no border and no fill. These are
 *  offers rather than controls — what the task could have — so they read as text
 *  until you point at them. */
function ContentAction({
  icon,
  label,
  title,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center gap-[6px] bg-transparent border-none p-0 cursor-pointer text-control-lg text-neutral-675 hover:text-neutral-825 disabled:cursor-default disabled:text-neutral-625"
    >
      <span className="shrink-0 flex" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
}

/** The ways to start a block the task doesn't have yet, as one row sitting where
 *  those blocks would be: under the description, above the attachments, the
 *  prompts and the subtask list.
 *
 *  Each entry drops out once its block exists, because the block then carries its
 *  own way of adding to it — the description's Edit, the attachments' drop zone,
 *  the prompt queue's "+ Prompt", the subtask header's button. A task with all
 *  four renders nothing here, which is the point: the row is an empty state, not
 *  a toolbar. */
export function TaskContentActions({
  task,
  hasDescription,
  hasSubtasks,
}: {
  task: Task;
  hasDescription: boolean;
  hasSubtasks: boolean;
}) {
  const { editDescription, openSubtaskForm, features } = useData();
  const { promptComposing, setPromptComposing } = useUi();
  const { openFilePicker, uploading, fileInput } = useAttachmentUpload(task.id);
  // Switched off in Settings, the block is not offered at all. What a task
  // already holds stays in its Markdown — see `FeatureConfig`.
  const showAttach = features.attachments && (task.attachments ?? []).length === 0;
  // The composer it opens lives in `PromptsSection` below, which renders itself
  // as soon as the flag is set — so the offer goes away exactly when the queue
  // appears.
  const showPrompt = features.prompts && (task.prompts ?? []).length === 0 && !promptComposing;
  // The two rules the subtask list's own button already follows: the tree is one
  // level deep, and a closed task keeps its list as a record rather than growing.
  const showSubtask = !hasSubtasks && canHaveSubtasks(task) && !isDone(task);
  if (hasDescription && !showAttach && !showPrompt && !showSubtask) {
    return null;
  }
  return (
    // Tight under an open description, which ends flush with its own box; the
    // links above it already carry their gap when there is none.
    <div className={'flex flex-wrap items-center gap-x-5 gap-y-2 ' + (hasDescription ? 'mt-5' : 'mt-1')}>
      {fileInput}
      {!hasDescription && (
        <ContentAction
          icon={<PlusIcon size={15} />}
          label="Description"
          title="Write a description for this task"
          onClick={editDescription}
        />
      )}
      {showAttach && (
        <ContentAction
          icon={<PaperclipIcon size={14} />}
          label={uploading ? 'Attaching…' : 'Attach'}
          title="Attach a file to this task"
          onClick={openFilePicker}
          disabled={uploading}
        />
      )}
      {showPrompt && (
        <ContentAction
          icon={<SparklesIcon size={15} />}
          label="Prompt"
          title="Write a prompt to run against this task later"
          onClick={() => setPromptComposing(true)}
        />
      )}
      {showSubtask && (
        <ContentAction
          icon={<PlusIcon size={15} />}
          label="Subtask"
          title="Create a task under this one"
          onClick={() => openSubtaskForm(task)}
        />
      )}
    </div>
  );
}
