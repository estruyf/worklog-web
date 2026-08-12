// Handing a task to an AI agent. Two things have to hold: the enabled list is
// normalized the way every other config list is (so config.json doesn't churn and
// an unknown id can't break a save), and the `vscode://` url survives the round
// trip the Command Executor extension puts it through — it `JSON.parse`s the
// `args` param and hands the result to `executeCommand`, so what that parse
// yields *is* what the agent receives.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { updateSettings } from '../src/services/settings';
import { AI_AGENTS, COMMAND_EXECUTOR_ID, agentUrl, parseAiAgents, taskPrompt } from '../src/model/aiAgents';
import type { AiAgent, DaylogConfig } from '../src/model/types';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 1,
  todosPerPage: 5,
  clients: [{ id: 'acme', name: 'Acme Corp' }],
  statuses: [
    { id: 'open', label: 'Open' },
    { id: 'done', label: 'Closed', terminal: true },
  ],
  autoSync: { enabled: false, delayMinutes: 5 },
};

let store: Store;

async function mount(configOverride?: unknown) {
  const fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(configOverride ?? CONFIG, null, 2));
  fm.text.set('clients/acme.md', '# Acme Corp\n');
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
}

function config(): Promise<DaylogConfig> {
  return store.ws.loadConfig();
}

const agent = (id: AiAgent) => AI_AGENTS.find((a) => a.id === id)!;

/** The whole chain a link goes through, so what this returns is what the command
 *  actually receives:
 *
 *  1. VS Code parses the url and percent-decodes the query — modelled here with
 *     `decodeURIComponent`, rather than by depending on `vscode-uri`, for the same
 *     reason `test/offline.test.ts` hand-rolls IndexedDB. This step is the one
 *     that made a task title containing `&` truncate its own `args`.
 *  2. The extension reads `args` off the decoded query …
 *  3. … `JSON.parse`s it, keeping the raw string when that throws, and passes the
 *     result to `executeCommand`. */
function received(url: string): { command: string; args: unknown } {
  const query = new URLSearchParams(decodeURIComponent(url.slice(url.indexOf('?') + 1)));
  const raw = query.get('args') ?? '';
  let args: unknown = raw;
  try {
    args = JSON.parse(raw);
  } catch {
    // The extension keeps the raw string when the parse throws.
  }
  return { command: query.get('command') ?? '', args };
}

describe('parseAiAgents', () => {
  it('reads a saved list, in the order Settings shows', () => {
    expect(parseAiAgents(['claude', 'copilot'])).toEqual(['copilot', 'claude']);
  });

  it('is empty for anything that is not a list of known ids', () => {
    expect(parseAiAgents(undefined)).toEqual([]);
    expect(parseAiAgents([])).toEqual([]);
    expect(parseAiAgents('copilot')).toEqual([]);
    // An id this version doesn't offer belongs to a newer one — dropped, not fatal.
    expect(parseAiAgents(['copilot', 'cursor'])).toEqual(['copilot']);
  });

  it('collapses duplicates', () => {
    expect(parseAiAgents(['claude', 'claude'])).toEqual(['claude']);
  });
});

describe('taskPrompt', () => {
  it('is the title, then the description', () => {
    expect(taskPrompt('Fix the login redirect', 'It 302s to /app before the session cookie is set.')).toBe(
      'Fix the login redirect\n\nIt 302s to /app before the session cookie is set.',
    );
  });

  it('is the title alone when there is no description', () => {
    expect(taskPrompt('Fix the login redirect')).toBe('Fix the login redirect');
    expect(taskPrompt('Fix the login redirect', '   ')).toBe('Fix the login redirect');
  });

  it('caps a long description rather than handing the OS an unbounded url', () => {
    expect(taskPrompt('Title', 'x'.repeat(10_000)).length).toBe(6000);
  });
});

describe('agentUrl', () => {
  it('sends Copilot a prefilled, unsent chat query', () => {
    const url = agentUrl(agent('copilot'), 'Fix the login redirect');
    expect(url.startsWith(`vscode://${COMMAND_EXECUTOR_ID}?`)).toBe(true);
    expect(received(url)).toEqual({
      command: 'workbench.action.chat.open',
      // `isPartialQuery` is the difference between filling the input and sending
      // it. Losing it would have a link start an agent nobody pressed Enter on.
      args: { query: 'Fix the login redirect', isPartialQuery: true },
    });
  });

  it('sends Claude the prompt as the command’s first argument', () => {
    expect(received(agentUrl(agent('claude'), 'Fix the login redirect'))).toEqual({
      command: 'claude-vscode.terminal.open',
      args: 'Fix the login redirect',
    });
  });

  it('keeps a prompt that happens to look like JSON a string', () => {
    // The reason `args` is JSON-encoded even when it is a plain string: the
    // extension's `JSON.parse` would otherwise turn these into a number, a
    // boolean and an object, and `claude-vscode.terminal.open` drops anything
    // that isn't a string without saying so.
    for (const prompt of ['42', 'true', 'null', '{"query":"x"}', '[1,2]']) {
      expect(received(agentUrl(agent('claude'), prompt)).args).toBe(prompt);
    }
  });

  it('survives a prompt carrying the url’s own punctuation', () => {
    // The `&` is the one that bit: a single encoding is undone by VS Code's own
    // parse, so the query splits inside the prompt, `args` arrives truncated to
    // invalid JSON, and the raw string is sent to the agent instead of filling
    // its input. Both agents, because both put the prompt through the same url.
    const prompt = 'Investigate MS AI Search & Copilot integration #12 (a=b, 100% of the time)';
    expect(received(agentUrl(agent('claude'), prompt)).args).toBe(prompt);
    expect(received(agentUrl(agent('copilot'), prompt)).args).toEqual({ query: prompt, isPartialQuery: true });
  });

  it('keeps the command readable in the link itself', () => {
    // Only `args` is encoded twice — the command id is what a person reads when a
    // link doesn't work, and it has nothing in it that needs escaping.
    expect(agentUrl(agent('copilot'), 'x')).toContain('?command=workbench.action.chat.open&args=');
  });
});

describe('the aiAgents setting', () => {
  beforeEach(async () => {
    await mount();
  });

  it('is off in a config written before it existed', async () => {
    expect((await config()).aiAgents).toEqual([]);
  });

  it('saves the enabled agents, normalized', async () => {
    await updateSettings(store, { aiAgents: ['claude', 'copilot', 'claude'] as AiAgent[] });
    expect((await config()).aiAgents).toEqual(['copilot', 'claude']);
  });

  it('turns them all off again', async () => {
    await updateSettings(store, { aiAgents: ['copilot'] });
    await updateSettings(store, { aiAgents: [] });
    expect((await config()).aiAgents).toEqual([]);
  });

  it('leaves the rest of the settings alone', async () => {
    await updateSettings(store, { aiAgents: ['copilot'] });
    const after = await config();
    expect(after.hoursPerDay).toBe(8);
    expect(after.clients).toHaveLength(1);
  });

  it('drops an id it does not know rather than refusing the save', async () => {
    await updateSettings(store, { aiAgents: ['copilot', 'cursor'] as AiAgent[] });
    expect((await config()).aiAgents).toEqual(['copilot']);
  });
});
