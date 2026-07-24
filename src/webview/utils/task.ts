// Pure task adapters — no closure over component state, so they can live at
// module scope and be shared without reallocating per render.

import { Task } from '../../model/types';

export function clientIdOf(t: Task): string {
  return t.clientIds[0];
}

export function isDone(t: Task): boolean {
  return !!t.completed;
}

export function workedOnDate(t: Task, date: string): boolean {
  return (t.workedOn ?? []).includes(date);
}

export function linksOf(t: Task): string[] {
  return t.links.map((l) => l.url);
}
