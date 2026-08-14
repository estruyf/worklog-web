import React from 'react';
import type { AppView } from '../../model';
import { Badge } from '../../primitives';
import { useData, useUi } from '../../context';
import { isGeneralTodoClientId } from '../../../model/todos';
import { collectOverdue } from '../../../model/overdue';
import { clientIdOf, isDone } from '../../utils';
import {
  NavArchiveIcon,
  NavCalendarIcon,
  NavClientsIcon,
  NavDayIcon,
  NavInsightsIcon,
  NavOverdueIcon,
  NavTodosIcon,
} from '../icons';
import { VIEW_LABELS } from '../../views/routes';
import { navItemClass } from './styles';

/** Nav tabs, in display order. Each keeps the app's tuned glyph — see `icons.tsx`.
 *  The names come from `VIEW_LABELS`, which the way back from an open task reads
 *  too, so a tab and the button returning to it always agree. */
const NAV_ITEMS: { view: AppView; icon: React.ReactNode }[] = [
  { view: 'day', icon: <NavDayIcon /> },
  { view: 'overdue', icon: <NavOverdueIcon /> },
  { view: 'todos', icon: <NavTodosIcon /> },
  { view: 'calendar', icon: <NavCalendarIcon /> },
  { view: 'clients', icon: <NavClientsIcon /> },
  { view: 'insights', icon: <NavInsightsIcon /> },
  { view: 'archive', icon: <NavArchiveIcon /> },
];

/** The seven view tabs, with counts on the two that would otherwise go unnoticed.
 *  Collapsed, a tab is its glyph and its count rides the corner of it — the point
 *  of the badge is that you notice it without reading the row. */
export function NavList({ onGo, collapsed = false }: { onGo: (view: AppView) => void; collapsed?: boolean }) {
  const { view } = useUi();
  const { tasks, today } = useData();

  // Open general to-dos get a count badge — they're the one nav target whose list
  // isn't tied to the selected day, so nothing else surfaces that they're waiting.
  const todoCount = React.useMemo(
    () => tasks.filter((t) => isGeneralTodoClientId(clientIdOf(t)) && !isDone(t)).length,
    [tasks],
  );
  // What has slipped past its due date, counted against today rather than the
  // day being browsed: the rail says the same thing wherever you are in the app.
  const overdueCount = React.useMemo(() => collectOverdue(tasks, today).length, [tasks, today]);

  return (
    <nav className="flex flex-col gap-[3px] px-[10px]">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.view}
          onClick={() => onGo(item.view)}
          className={navItemClass(view === item.view, collapsed)}
          title={collapsed ? VIEW_LABELS[item.view] : undefined}
        >
          <span className="shrink-0">{item.icon}</span>
          {!collapsed && VIEW_LABELS[item.view]}
          {item.view === 'todos' && todoCount > 0 && (
            <Badge size="sm" className={collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'}>
              {todoCount}
            </Badge>
          )}
          {item.view === 'overdue' && overdueCount > 0 && (
            <Badge size="sm" tone="danger" className={collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'}>
              {overdueCount}
            </Badge>
          )}
        </button>
      ))}
    </nav>
  );
}
