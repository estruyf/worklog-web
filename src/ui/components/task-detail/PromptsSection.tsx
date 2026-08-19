import React, { useState } from 'react';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import type { Task, TaskPrompt } from '../../../model/types';
import { AI_AGENTS, agentPrompt, agentUrl, type AiAgentDef } from '../../../model/aiAgents';
import { isValidISODate } from '../../../util/date';
import { Button, Card, Input, LinkButton, SectionLabel, TextArea } from '../../primitives';
import { useData, useUi } from '../../context';
import { MOD_KEY, weekdayShort } from '../../utils';
import { AGENT_ICONS } from '../brandIcons';
import { CopyButton } from '../CopyButton';

/** A prompt is copied out and pasted somewhere else, so it is shown as the text
 *  it is — never rendered as Markdown, and in the face the thing on the other end
 *  will show it in. */
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

/** Best-effort, like `CopyButton`: a denied permission or an insecure context
 *  leaves the text where it is, and there is nothing to report. */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* nothing to do */
  }
}

/** "Fri 31" — the same short stamp the notes log uses, for the same reason: the
 *  weekday is what you remember a run by. The stored stamp stays as the title. */
function ranLabel(stamp: string): string {
  const date = stamp.slice(0, 10);
  return isValidISODate(date) ? `${weekdayShort(date)} ${Number(date.slice(8))}` : stamp;
}

function lineCount(text: string): number {
  return text.trim() ? text.trim().split('\n').length : 0;
}

/** Writing one prompt: the title row over the body. Shared by the composer at the
 *  bottom of the queue and by an edit opened on a prompt already in it — the two
 *  differ only in what Save does. */
function PromptComposer({
  title,
  text,
  onTitleChange,
  onTextChange,
  onSave,
  onCancel,
  saveLabel,
}: {
  title: string;
  text: string;
  onTitleChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  // ⌘↵ saves from either box, so a prompt written top to bottom never needs the
  // pointer. Escape closes the composer rather than the whole panel — that
  // listener sits on window (see ../../WorklogApp).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };
  return (
    <Card radius="panel" padding="md" className="flex flex-col gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Prompt title"
        placeholder="Title — what this prompt is for"
        className="w-full font-semibold"
      />
      <TextArea
        autoGrow
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Prompt"
        placeholder="The prompt itself. Paste or type it now, run it later."
        style={MONO}
        className="w-full min-h-[120px] max-h-[50vh] leading-[1.55]"
      />
      <div className="flex justify-end items-center gap-3">
        <span className="mr-auto text-count text-neutral-625">{MOD_KEY}↵ to save</span>
        <LinkButton size="xs" tone="muted" onClick={onCancel}>
          Cancel
        </LinkButton>
        <Button variant="primary" size="xs" onClick={onSave} disabled={!title.trim()} className="font-semibold">
          {saveLabel}
        </Button>
      </div>
    </Card>
  );
}

/** One prompt in the queue: a card whose row is the whole of it until you open
 *  it. Collapsed it is a checkbox, a title and how long the body is — which is
 *  what the queue is scanned by. Open, it is the prompt itself plus the ways out
 *  of it: copy it or hand it to an agent (either of which ticks it off, since
 *  running it *is* running it) or correct it.
 *
 *  `agents` is whatever is switched on in Settings — usually nothing, which is
 *  the shipped state and why the footer is written to read fine without them. */
function QueuedPrompt({
  prompt,
  agents,
  expanded,
  onToggle,
  onRun,
  onHandOff,
  onTick,
  onEdit,
  onDelete,
}: {
  prompt: TaskPrompt;
  agents: AiAgentDef[];
  expanded: boolean;
  onToggle: () => void;
  onRun: () => void;
  onHandOff: () => void;
  onTick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lines = lineCount(prompt.text);
  return (
    <Card radius="panel" padding="none">
      <div className="flex items-center gap-[11px] px-3 py-2.5">
        <button
          type="button"
          onClick={onTick}
          title="Mark as run"
          aria-label={`Mark “${prompt.title}” as run`}
          className="w-[16px] h-[16px] shrink-0 border-[1.5px] border-neutral-575 rounded-[5px] bg-white cursor-pointer p-0 text-neutral-500 hover:border-success-500 hover:text-success-500 flex items-center justify-center"
        >
          <CheckIcon size={10} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          title={expanded ? 'Hide the prompt' : 'Show the prompt'}
          className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer text-body font-semibold text-neutral-825 truncate"
        >
          {prompt.title}
        </button>
        {lines > 0 && (
          <span className="shrink-0 text-count text-neutral-650">
            {lines} {lines === 1 ? 'line' : 'lines'}
          </span>
        )}
        {/* Copying is the point of the row, so it is offered the moment the body
            is on screen — the footer's version below also ticks it off. */}
        {expanded && lines > 0 && <CopyButton value={prompt.text} label={`Copy “${prompt.title}”`} className="shrink-0" />}
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `Hide ${prompt.title}` : `Show ${prompt.title}`}
          className="shrink-0 flex items-center bg-transparent border-none p-0 cursor-pointer text-neutral-625 hover:text-neutral-825"
        >
          {expanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <div className="border-t border-neutral-375 pt-3">
            {lines > 0 && (
              <pre style={MONO} className="m-0 mb-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-words text-control text-neutral-750">
                {prompt.text}
              </pre>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="success" size="xs" onClick={onRun} className="font-semibold">
                {lines > 0 ? 'Copy & mark ran' : 'Mark ran'}
              </Button>
              {/* An anchor, not a button: the `vscode://` url is handed to the OS
                  (see model/aiAgents.ts). The click ticks the prompt off on the
                  way out, for the same reason copying it does — this is the run. */}
              {lines > 0 &&
                agents.map((agent) => {
                  const AgentIcon = AGENT_ICONS[agent.id];
                  return (
                    <Button
                      key={agent.id}
                      variant="secondary"
                      size="xs"
                      href={agentUrl(agent, agentPrompt(prompt.text))}
                      onClick={onHandOff}
                      title={`Open this prompt in ${agent.label} (VS Code) and mark it ran`}
                    >
                      <AgentIcon size={13} />
                      Run in {agent.label}
                    </Button>
                  );
                })}
              <Button variant="secondary" size="xs" onClick={onEdit}>
                Edit
              </Button>
              <LinkButton size="inherit" tone="muted" onClick={onDelete} className="ml-auto text-count">
                Delete
              </LinkButton>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** The task's prompt queue: what you already know you will want to ask, written
 *  when you think of it and ticked off once you have.
 *
 *  Two rules keep it from growing into a wall: a prompt is one row until it is
 *  opened, and a prompt that has run leaves the queue for the folded list at the
 *  bottom. So the section shrinks as the work happens.
 *
 *  Only rendered once the task has one — the *first* prompt is an offer in
 *  `TaskContentActions`, next to the description and the attachments, which is
 *  also what sets `promptComposing` to bring the composer up here. */
export function PromptsSection({ task }: { task: Task }) {
  const { addPrompt, updatePrompt, setPromptRan, deletePrompt, features, aiAgents } = useData();
  const { confirm, promptComposing, setPromptComposing } = useUi();
  // Indices are positions in the stored list, which is what every mutation is
  // addressed by — the queue/ran split below is a view of it, never a reordering.
  const prompts = (task.prompts ?? []).map((prompt, index) => ({ prompt, index }));
  const queued = prompts.filter((p) => !p.prompt.ran);
  const ran = prompts.filter((p) => p.prompt.ran);
  // The agents Settings offers, in its order. Empty until one is switched on.
  const agents = AI_AGENTS.filter((a) => aiAgents.includes(a.id));

  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ index: number; title: string; text: string } | null>(null);
  const [draft, setDraft] = useState({ title: '', text: '' });
  const [showRan, setShowRan] = useState(false);

  const closeComposer = () => {
    setDraft({ title: '', text: '' });
    setPromptComposing(false);
  };
  const onAdd = () => {
    if (!draft.title.trim()) {
      return;
    }
    addPrompt(task.id, draft.title, draft.text);
    closeComposer();
  };
  const onSaveEdit = () => {
    if (!editing || !editing.title.trim()) {
      return;
    }
    updatePrompt(task.id, editing.index, editing.title, editing.text);
    setEditing(null);
  };
  // Copying it is running it: the clipboard and the tick are one act, which is
  // what keeps the queue honest without a second click nobody would make.
  const onRun = async (index: number, text: string) => {
    if (text.trim()) {
      await copyText(text);
    }
    setExpanded(null);
    setPromptRan(task.id, index, true);
  };
  const onDelete = async (index: number, title: string) => {
    const ok = await confirm.ask({
      title: `Delete “${title}”?`,
      message: 'The prompt is removed from the task file and cannot be recovered.',
      confirmLabel: 'Delete prompt',
      tone: 'danger',
    });
    if (ok) {
      // Every prompt after it shifts down one, so an open body or an open edit
      // would be pointed at the wrong prompt.
      setExpanded(null);
      setEditing(null);
      deletePrompt(task.id, index);
    }
  };

  // Switched off in Settings the whole block goes, queue and record alike — the
  // `### Prompts` section stays in the Markdown and comes back with the switch.
  if (!features.prompts || (prompts.length === 0 && !promptComposing)) {
    return null;
  }

  return (
    <div className="mt-9 mb-7">
      <div className="flex items-center justify-between gap-3 mb-[10px]">
        <div className="flex items-baseline gap-2 min-w-0">
          <SectionLabel>Prompts</SectionLabel>
          {/* Nothing to count while the very first one is being written. */}
          {prompts.length > 0 && (
            <span className="truncate text-count text-neutral-650">
              {queued.length} queued · {ran.length} ran
            </span>
          )}
        </div>
        {!promptComposing && (
          <Button size="xs" onClick={() => setPromptComposing(true)} title="Write a prompt to run later" className="shrink-0">
            <PlusIcon size={13} strokeWidth={2.2} />
            Prompt
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {queued.map(({ prompt, index }) =>
          editing?.index === index ? (
            <PromptComposer
              key={index}
              title={editing.title}
              text={editing.text}
              onTitleChange={(title) => setEditing({ ...editing, title })}
              onTextChange={(text) => setEditing({ ...editing, text })}
              onSave={onSaveEdit}
              onCancel={() => setEditing(null)}
              saveLabel="Save prompt"
            />
          ) : (
            <QueuedPrompt
              key={index}
              prompt={prompt}
              agents={agents}
              expanded={expanded === index}
              onToggle={() => setExpanded(expanded === index ? null : index)}
              onRun={() => void onRun(index, prompt.text)}
              onHandOff={() => {
                setExpanded(null);
                setPromptRan(task.id, index, true);
              }}
              onTick={() => {
                setExpanded(expanded === index ? null : expanded);
                setPromptRan(task.id, index, true);
              }}
              onEdit={() => {
                setEditing({ index, title: prompt.title, text: prompt.text });
                setExpanded(null);
              }}
              onDelete={() => void onDelete(index, prompt.title)}
            />
          ),
        )}
      </div>

      {promptComposing ? (
        <div className={queued.length ? 'mt-1.5' : undefined}>
          <PromptComposer
            title={draft.title}
            text={draft.text}
            onTitleChange={(title) => setDraft({ ...draft, title })}
            onTextChange={(text) => setDraft({ ...draft, text })}
            onSave={onAdd}
            onCancel={closeComposer}
            saveLabel="Add prompt"
          />
        </div>
      ) : (
        <Button variant="dashed" size="md" onClick={() => setPromptComposing(true)} className="w-full justify-start mt-1.5">
          <PlusIcon size={14} />
          New prompt
          <span className="font-normal text-neutral-650">title, then body</span>
        </Button>
      )}

      {/* What has run folds away: the queue is the thing you came for, and the
          record is one click behind it. */}
      {ran.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowRan(!showRan)}
            aria-expanded={showRan}
            className="flex items-center gap-[6px] bg-transparent border-none p-0 cursor-pointer font-bold uppercase tracking-eyebrow text-eyebrow text-neutral-675 hover:text-neutral-825"
          >
            Ran ({ran.length})
            {showRan ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
          </button>
          {showRan && (
            <div className="flex flex-col mt-1">
              {ran.map(({ prompt, index }) => (
                <React.Fragment key={index}>
                <div className="group flex items-center gap-[11px] py-[7px]">
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded(expanded === index ? null : expanded);
                      setPromptRan(task.id, index, false);
                    }}
                    title="Put back in the queue"
                    aria-label={`Put “${prompt.title}” back in the queue`}
                    className="w-[16px] h-[16px] shrink-0 rounded-[5px] bg-success-500 text-white border-none cursor-pointer p-0 flex items-center justify-center"
                  >
                    <CheckIcon size={10} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === index ? null : index)}
                    aria-expanded={expanded === index}
                    title={expanded === index ? 'Hide the prompt' : 'Show the prompt'}
                    className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer text-control-lg text-neutral-700 line-through decoration-neutral-550 truncate"
                  >
                    {prompt.title}
                  </button>
                  {prompt.text.trim() && <CopyButton value={prompt.text} label={`Copy “${prompt.title}”`} className="shrink-0" />}
                  {prompt.ranAt && (
                    <span title={prompt.ranAt} className="shrink-0 text-count text-neutral-650">
                      {ranLabel(prompt.ranAt)}
                    </span>
                  )}
                  <LinkButton
                    size="inherit"
                    tone="muted"
                    onClick={() => void onDelete(index, prompt.title)}
                    title={`Delete ${prompt.title}`}
                    className="shrink-0 text-count lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100"
                  >
                    Delete
                  </LinkButton>
                </div>
                {/* Opened, a ran prompt shows the same body the queue does —
                    it is still the thing you might want to run again. */}
                {expanded === index && prompt.text.trim() && (
                  <pre
                    style={MONO}
                    className="m-0 mb-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-panel border border-neutral-375 bg-neutral-50 p-3 text-control text-neutral-750"
                  >
                    {prompt.text}
                  </pre>
                )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
