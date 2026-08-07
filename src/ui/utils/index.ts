// Barrel for UI utilities.
export { PALETTE, MONTHS, WEEKDAYS, STATUS_COLORS, STATUS_PALETTE } from "./constants";
export { fmtLong, fmtShort, monthLabel, shiftDate, shiftMonth, weekdayShort, num } from "./date";
export { clientIdOf, isDone, workedOnDate, dueOn, linksOf } from "./task";
export { resolveStatusMeta } from "./status";
export { renderMarkdown, makeImageResolver, toggleTaskLine } from "./markdown";
export type { ImageResolver, MarkdownOptions } from "./markdown";
export { splitMatch, deriveSearch, deriveNoteGroup, appendGroup, snippetAround, NOTE_COLOR, NOTE_GROUP_NAME } from "./search";
export type { NoteSearchDeps, SearchDeps, SearchDerived, SearchFilters, SplitMatch } from "./search";
export { deriveArchive, pageWindow, periodStart, ARCHIVE_PAGE_SIZES } from "./archive";
export type { ArchiveDeps, ArchiveDerived, ArchiveFilters, ArchivePeriod } from "./archive";
export { deriveTaskList, matchesTaskQuery, DEFAULT_TASK_LIST_FILTERS, TASK_SORTS } from "./taskFilter";
export {
  canHaveParent,
  parentCandidates,
  parseCollapsedStore,
  planTaskRows,
  pruneCollapsed,
  toggleCollapsed,
} from "./taskTree";
export type { CollapsedStore, ParentSubject, TaskRowPlan } from "./taskTree";
export type {
  TaskListDeps,
  TaskListDerived,
  TaskListFilters,
  TaskSortDirection,
  TaskSortKey,
  TaskTagCount,
} from "./taskFilter";
export {
  calendarCells,
  deriveWorkedByClient,
  monthCells,
  periodContains,
  periodLabel,
  shiftPeriod,
  startOfWeek,
  weekCells,
  ymOf,
  EVENT_COLOR,
} from "./calendar";
export type { CalendarMode, CalendarWorkDeps, ClientWorkGroup, WorkedItem } from "./calendar";
export { deriveDayBar, previousLoggedDay, roundHours } from "./dayBar";
export type { DayBarModel, DaySegment } from "./dayBar";
export { deriveClientLinks, relevantDayClientIds } from "./clientLinks";
export type { ClientLinkGroup } from "./clientLinks";
export { defaultTaskClientId } from "./newTaskDefaultClient";
export { addTag, isNewTag, matchExistingTag, normalizeTag, removeTag, suggestTags } from "./tags";
