// Barrel for UI utilities.
export { PALETTE, MONTHS, WEEKDAYS, STATUS_COLORS } from "./constants";
export { fmtLong, fmtShort, monthLabel, shiftDate, num } from "./date";
export { clientIdOf, isDone, workedOnDate, linksOf } from "./task";
export { resolveStatusMeta } from "./status";
export { renderMarkdown, makeImageResolver } from "./markdown";
export type { ImageResolver } from "./markdown";
export { splitMatch, deriveSearch } from "./search";
export type { SearchDeps, SearchDerived, SplitMatch } from "./search";
export { deriveArchive, pageWindow, periodStart, ARCHIVE_PAGE_SIZES } from "./archive";
export type { ArchiveDeps, ArchiveDerived, ArchiveFilters, ArchivePeriod } from "./archive";
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
export { defaultTaskClientId } from "./newTaskDefaultClient";
