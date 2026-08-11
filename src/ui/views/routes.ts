// Maps each top-level tab to the view that renders it, and to what it is called.
// Views are propless and source their own data from context, so the shell just
// looks up the active one.

import React from 'react';
import type { AppView } from '../model';
import { DayView } from './DayView';
import { OverdueView } from './OverdueView';
import { TodosView } from './TodosView';
import { CalendarView } from './CalendarView';
import { ClientsView } from './ClientsView';
import { InsightsView } from './InsightsView';
import { ArchiveView } from './ArchiveView';
import { ShortcutsView } from './ShortcutsView';
import { SettingsView } from './SettingsView';

export const ROUTES: Record<AppView, React.ComponentType> = {
  day: DayView,
  overdue: OverdueView,
  todos: TodosView,
  calendar: CalendarView,
  clients: ClientsView,
  insights: InsightsView,
  archive: ArchiveView,
  shortcuts: ShortcutsView,
  settings: SettingsView,
};

/** What each view is called, wherever the app has to name one: the nav tabs, and
 *  the way back from an open task. One list, so a tab and the button that returns
 *  to it can't end up calling the same place two different things. */
export const VIEW_LABELS: Record<AppView, string> = {
  day: 'Day',
  overdue: 'Overdue',
  todos: 'To-dos',
  calendar: 'Calendar',
  clients: 'Clients',
  insights: 'Insights',
  archive: 'Archive',
  shortcuts: 'Shortcuts',
  settings: 'Settings',
};
