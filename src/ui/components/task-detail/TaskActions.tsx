import React from 'react';
import type { Task } from '../../../model/types';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { SidebarSection } from '../../primitives';
import { useData } from '../../context';
import { isDone } from '../../utils';
import { AI_AGENTS, agentUrl, taskPrompt } from '../../../model/aiAgents';
import { AGENT_ICONS } from '../brandIcons';

/** One row of the actions list: icon, then label, full width. Not a `Button` —
 *  these read as a menu rather than a toolbar cluster, so they carry no border
 *  and no fill until hovered, and the destructive one says so in its own colour
 *  instead of a solid red block. */
function Action({
  icon,
  label,
  onClick,
  href,
  title,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  /** Renders the row as a link instead of a button. The agent rows hand a
   *  `vscode://` url to the OS, which is a navigation rather than something this
   *  app does — so it gets an anchor, and the browser's own "open VS Code?"
   *  prompt lands where the user clicked. */
  href?: string;
  title?: string;
  tone?: 'neutral' | 'danger';
}) {
  const tones = {
    neutral: 'text-neutral-750 hover:bg-neutral-200',
    danger: 'text-danger-675 hover:bg-danger-75',
  };
  const className =
    'w-full flex items-center gap-[10px] px-2 py-[7px] rounded-control text-control text-left bg-transparent border-none cursor-pointer no-underline ' +
    tones[tone];
  const content = (
    <>
      <span className="shrink-0 flex" aria-hidden="true">
        {icon}
      </span>
      {label}
    </>
  );
  return href ? (
    <a href={href} title={title} className={className}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} title={title} className={className}>
      {content}
    </button>
  );
}

/** The rest of what can be done to the open task, as the last block of the rail —
 *  the shape GitHub gives an issue's actions: a plain vertical list, destructive
 *  last and in red. Marking worked and marking done stay buttons in the panel's
 *  header, because those are the two you came to press; this list is what you go
 *  looking for. */
export function TaskActions({ task }: { task: Task }) {
  const { openEdit, deleteTask, aiAgents } = useData();
  const done = isDone(task);
  // Nothing at all until an agent is switched on in Settings, which is also why
  // this needs no empty state: the list is the app's own actions, and the agents
  // are rows the user asked for.
  const agents = AI_AGENTS.filter((a) => aiAgents.includes(a.id));
  const prompt = agents.length > 0 ? taskPrompt(task.title, task.description) : '';
  return (
    <SidebarSection title="Actions">
      {/* Pulled out to the rail's edge: the rows' own padding is what aligns
          their labels with the blocks above, so the hover fill can be wider than
          the text without the list looking indented. */}
      <div className="flex flex-col -mx-2">
        {/* Above the task's own actions: this is what you came here to start,
            where editing and deleting are what you go looking for. */}
        {agents.map((agent) => {
          const AgentIcon = AGENT_ICONS[agent.id];
          return (
            <Action
              key={agent.id}
              icon={<AgentIcon />}
              label={`Open in ${agent.label}`}
              href={agentUrl(agent, prompt)}
              title={`Open this task as a prompt in ${agent.label} (VS Code)`}
            />
          );
        })}
        <Action icon={<PencilIcon size={15} />} label="Edit details" onClick={() => openEdit(task)} />
        <Action
          icon={<Trash2Icon size={15} />}
          label={done ? 'Delete forever' : 'Delete'}
          tone="danger"
          onClick={() => deleteTask(task.id, { permanent: done })}
        />
      </div>
    </SidebarSection>
  );
}
