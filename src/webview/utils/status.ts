// Resolve a status id (+ completion state) to an uppercase label and a color,
// falling back through the configured StatusDef, STATUS_COLORS, then terminal state.

import type { StatusDef } from '../../model/types';
import type { StatusMeta } from '../model';
import { STATUS_COLORS } from './constants';

export function resolveStatusMeta(def: StatusDef | undefined, statusId: string, done: boolean): StatusMeta {
  const terminal = done || def?.terminal;
  return {
    label: (def?.label ?? statusId).toUpperCase(),
    color: def?.color || STATUS_COLORS[statusId] || (terminal ? '#16A34A' : '#6E7781'),
  };
}
