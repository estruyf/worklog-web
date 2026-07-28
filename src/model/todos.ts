// General to-dos: tasks that aren't tied to any client. They flow through the
// same file-per-client machinery as normal tasks by living under a single
// reserved pseudo-client id, so parsing, closing, archiving and editing all work
// unchanged. The id is hidden from billing surfaces (see worklogStore.deriveState)
// and reserved so a real client can't collide with it (see services/tasks).

import type { Client } from './types';

/** Reserved client id backing general to-dos. Its file is `clients/todos.md`. */
export const GENERAL_TODO_CLIENT_ID = 'todos';

/** Display label for the general to-do bucket. */
export const GENERAL_TODO_LABEL = 'To-dos';

/** Accent color for the general to-do bucket (neutral slate, distinct from client colors). */
export const GENERAL_TODO_COLOR = '#64748b';

export function isGeneralTodoClientId(id: string): boolean {
  return id === GENERAL_TODO_CLIENT_ID;
}

/** The virtual client record for general to-dos, used where a real client is
 *  expected (e.g. creating the first to-do before its file exists). */
export function generalTodoClient(): Client {
  return { id: GENERAL_TODO_CLIENT_ID, name: GENERAL_TODO_LABEL, color: GENERAL_TODO_COLOR };
}
