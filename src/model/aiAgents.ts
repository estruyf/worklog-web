// Handing a task to an AI agent: which agents Settings offers, the prompt a task
// becomes, and the `vscode://` link that opens it.
//
// The outbound mirror of ui/deeplink.ts. That file is how a task arrives from
// outside; this is how one leaves. The rule is the same in both directions — a
// link fills something in and never submits it — so what an agent starts from is
// still whatever the person read on screen and pressed Enter on.
//
// Every link goes through the Command Executor extension, which is what turns a
// URL into a VS Code command: there is deliberately no built-in `vscode://` that
// runs one, and an extension is the only way to bridge that. It passes exactly
// one argument (`executeCommand(command, args)`), which is why the commands below
// are the ones taking the prompt as their first — or only — parameter.
//
// Pure: no I/O, no React. Settings renders `AI_AGENTS`, the task rail builds urls.

/** An agent Settings can offer. These ids are written to `.worklog/config.json`. */
export type AiAgent = 'copilot' | 'claude';

export interface AiAgentDef {
  id: AiAgent;
  label: string;
  description: string;
  /** The VS Code command the link runs. */
  command: string;
  /** That command's single argument, for a given prompt. */
  args: (prompt: string) => unknown;
}

/** The extension every link here depends on. Settings names it and links to it —
 *  without it installed a `vscode://` link resolves to nothing at all. */
export const COMMAND_EXECUTOR_ID = 'eliostruyf.execcommand';
export const COMMAND_EXECUTOR_URL = `https://marketplace.visualstudio.com/items?itemName=${COMMAND_EXECUTOR_ID}`;

/** The agents offered in Settings, in the order they are shown. */
export const AI_AGENTS: AiAgentDef[] = [
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    description: 'Opens Copilot Chat in VS Code with the task in the input box.',
    command: 'workbench.action.chat.open',
    // `isPartialQuery` is what leaves the prompt sitting in the input rather than
    // sending it. Without it the link decides what the agent works on; with it,
    // you do.
    args: (prompt) => ({ query: prompt, isPartialQuery: true }),
  },
  // Appended rather than slotted in, for the same reason as AUTO_SYNC_EVENTS:
  // `parseAiAgents` orders a saved array by this list, so inserting in the middle
  // rewrites every existing config on its next save for no reason.
  {
    id: 'claude',
    label: 'Claude Code',
    description: 'Opens a Claude Code session in the VS Code terminal, with the task as its prompt.',
    command: 'claude-vscode.terminal.open',
    // The prompt is this command's *first* parameter. Its editor sibling
    // (`claude-vscode.editor.open`) takes it second, behind a session id, and the
    // extension can only pass one argument — a prompt sent there would be read as
    // a session key, miss, and open an empty panel without a word.
    args: (prompt) => prompt,
  },
];

/** Cap on the prompt, and so on the url: a `vscode://` link is handed to the OS,
 *  which truncates a long one rather than refusing it. Well above any description
 *  a deeplink can seed (see ui/deeplink.ts) — only a hand-written one reaches it. */
const MAX_PROMPT = 6000;

/** What the agent is asked to work on: the task's title, then its description.
 *  Deliberately nothing else. It lands in an input to be read and edited before
 *  it is sent, so this is a starting point rather than a brief, and every line in
 *  it is one the task itself says. */
export function taskPrompt(title: string, description?: string): string {
  const body = (description ?? '').trim();
  const heading = title.trim();
  return (body ? `${heading}\n\n${body}` : heading).slice(0, MAX_PROMPT);
}

/** The `vscode://` link that opens `prompt` in `agent`.
 *
 *  `args` is JSON-encoded even when it is a plain string. The extension runs
 *  `JSON.parse` on it and keeps the raw text only when that throws — so a prompt
 *  that happens to parse (a bare number, `true`, anything starting with `{`)
 *  would arrive as a non-string and be dropped by the command's own type check.
 *
 *  And it is percent-encoded *twice*, which is not a typo. VS Code hands the
 *  handler a parsed `Uri`, whose `query` is already percent-decoded — so a single
 *  encoding is undone before the extension splits the query on `&`, and the first
 *  `&` in a task title ends the `args` value there. What follows is truncated
 *  JSON: the parse throws, the raw string arrives instead of the object, and a
 *  chat that should have been prefilled is sent instead. The extension can't
 *  defend against it either — by the time it has a `Uri`, the original encoding
 *  is gone. So the inner encoding is the one that survives to `URLSearchParams`,
 *  and the outer one is what VS Code consumes. */
export function agentUrl(agent: AiAgentDef, prompt: string): string {
  const args = encodeURIComponent(encodeURIComponent(JSON.stringify(agent.args(prompt))));
  return `vscode://${COMMAND_EXECUTOR_ID}?command=${agent.command}&args=${args}`;
}

/** Normalize a config `aiAgents` array: unknown ids dropped, duplicates collapsed,
 *  ordered as {@link AI_AGENTS} is so config.json doesn't churn on the order the
 *  switches happened to be flipped in. Absent reads as none — every agent is off
 *  until it is turned on. */
export function parseAiAgents(value: unknown): AiAgent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const wanted = new Set(value);
  return AI_AGENTS.filter((a) => wanted.has(a.id)).map((a) => a.id);
}
