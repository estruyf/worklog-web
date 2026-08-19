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
// runs one, and an extension is the only way to bridge that. Arguments are passed
// positionally as `args0`, `args1`, … and spread into `executeCommand`, with a
// left-out index arriving as `undefined` — which is what lets a command be reached
// past a parameter we have nothing to say about.
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
  /** That command's arguments, in order, for a given prompt. An `undefined` entry
   *  is a parameter left at its default — it is skipped in the url, and the
   *  extension puts the `undefined` back. */
  args: (prompt: string) => unknown[];
}

/** The extension every link here depends on. Settings names it and links to it —
 *  without it installed a `vscode://` link resolves to nothing at all. */
export const COMMAND_EXECUTOR_ID = 'eliostruyf.execcommand';
export const COMMAND_EXECUTOR_URL = `https://marketplace.visualstudio.com/items?itemName=${COMMAND_EXECUTOR_ID}`;
/** The version that added positional `args0`/`args1` params. An older one reads
 *  only a single `args`, so it would run these commands with the prompt missing —
 *  worth naming wherever the extension is asked for. */
export const COMMAND_EXECUTOR_MIN_VERSION = '0.0.2';

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
    args: (prompt) => [{ query: prompt, isPartialQuery: true }],
  },
  // Appended rather than slotted in, for the same reason as AUTO_SYNC_EVENTS:
  // `parseAiAgents` orders a saved array by this list, so inserting in the middle
  // rewrites every existing config on its next save for no reason.
  {
    id: 'claude',
    label: 'Claude Code',
    description: 'Opens a Claude Code tab in VS Code with the task in its prompt box.',
    command: 'claude-vscode.editor.open',
    // `(sessionId, prompt, viewColumn)`. The first parameter is left out on
    // purpose: it resumes an existing session, and passing anything there would
    // have the prompt read as a session key. The third picks a column, which is a
    // choice the editor makes better than we can.
    //
    // The prompt lands in the tab's input rather than being sent — the webview
    // reads it once and calls `setInputText`. That is the same bargain as
    // Copilot's `isPartialQuery`, and the reason this beats the terminal command,
    // which would run what it was handed.
    args: (prompt) => [undefined, prompt],
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
  return agentPrompt(body ? `${heading}\n\n${body}` : heading);
}

/** A prompt from the task's queue, handed over as it stands. Nothing is added to
 *  it — not the task's title, not its description: the body of a queued prompt is
 *  already the text you meant to send, which is why copying it counts as running
 *  it. So the clipboard and the agent link carry the same characters, and this is
 *  the one place the cap is applied to them. */
export function agentPrompt(text: string): string {
  return text.trim().slice(0, MAX_PROMPT);
}

/** The `vscode://` link that opens `prompt` in `agent`.
 *
 *  Each argument is JSON-encoded even when it is a plain string. The extension
 *  runs `JSON.parse` on it and keeps the raw text only when that throws — so a
 *  prompt that happens to parse (a bare number, `true`, anything starting with
 *  `{`) would arrive as a non-string and be dropped by the command's own type
 *  check. An `undefined` argument is left out of the url entirely, which is how
 *  the extension is told to pass `undefined` in that position.
 *
 *  And each is percent-encoded *twice*, which is not a typo. VS Code hands the
 *  handler a parsed `Uri`, whose `query` is already percent-decoded — so a single
 *  encoding is undone before the extension splits the query on `&`, and the first
 *  `&` in a task title ends that value there. What follows is truncated JSON: the
 *  parse throws, the raw string arrives instead of the object, and a chat that
 *  should have been prefilled is sent instead. The extension can't defend against
 *  it either — by the time it has a `Uri`, the original encoding is gone. So the
 *  inner encoding is the one that survives to `URLSearchParams`, and the outer one
 *  is what VS Code consumes. */
export function agentUrl(agent: AiAgentDef, prompt: string): string {
  const args = agent
    .args(prompt)
    .map((arg, i) => (arg === undefined ? '' : `&args${i}=${encodeURIComponent(encodeURIComponent(JSON.stringify(arg)))}`))
    .join('');
  return `vscode://${COMMAND_EXECUTOR_ID}?command=${agent.command}${args}`;
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
