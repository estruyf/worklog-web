// Maps each top-level tab to the view that renders it. Views are propless and
// source their own data from context, so the shell just looks up the active one.

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
