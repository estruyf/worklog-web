// Resolve a status id (+ completion state) to its display text and a color,
// falling back through the configured StatusDef, STATUS_COLORS, then terminal state.
//
// Two spellings of the same text, because they are read differently: `label` is
// the uppercase micro-type the status column wears, and `name` is the status as
// its owner typed it — for prose, for menu items, and for the accessible names
// a screen reader would otherwise spell out one letter at a time.

import type { StatusDef } from '../../model/types';
import type { StatusMeta } from '../model';
import { STATUS_COLORS } from './constants';

export function resolveStatusMeta(def: StatusDef | undefined, statusId: string, done: boolean): StatusMeta {
  const terminal = done || def?.terminal;
  const name = def?.label ?? statusId;
  return {
    name,
    label: name.toUpperCase(),
    color: def?.color || STATUS_COLORS[statusId] || (terminal ? '#16A34A' : '#6E7781'),
  };
}
