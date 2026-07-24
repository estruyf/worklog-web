import React from 'react';

export type IconName =
  | 'search'
  | 'external'
  | 'check'
  | 'plus'
  | 'calendar'
  | 'briefcase'
  | 'clock'
  | 'close'
  | 'trash'
  | 'edit'
  | 'chevronLeft'
  | 'chevronRight';

const PATHS: Record<IconName, string> = {
  search: 'M10.5 3a5.5 5.5 0 0 1 4.23 9.02l3.12 3.13-1.06 1.06-3.13-3.12A5.5 5.5 0 1 1 10.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  external: 'M6 4h6v6h-1.5V6.56l-5.22 5.22-1.06-1.06L9.44 5.5H6V4Z M4 6H2.5v8.5H11V13H4V6Z',
  check: 'M13.5 4.5 6.5 11.5 3 8l1-1 2.5 2.5L12.5 3.5l1 1Z',
  plus: 'M9 4v4h4v1.5H9v4H7.5v-4h-4V8h4V4H9Z',
  calendar: 'M5 2v1H3.5A1.5 1.5 0 0 0 2 4.5v9A1.5 1.5 0 0 0 3.5 15h10a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 13.5 3H12V2h-1.5v1h-5V2H5Zm8.5 4.5v7h-10v-7h10Z',
  briefcase: 'M6 3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1h2.5A1.5 1.5 0 0 1 16 5.5v7A1.5 1.5 0 0 1 14.5 14h-13A1.5 1.5 0 0 1 0 12.5v-7A1.5 1.5 0 0 1 1.5 4H4V3h2Zm1 1h2v.5H7V4Z',
  clock: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1.5a5 5 0 1 1 0 10A5 5 0 0 1 8 3Zm-.75 1.5v3.81l2.72 1.57.75-1.3L8.75 7.4V4.5h-1.5Z',
  close: 'M8 6.94 11.06 3.88l1.06 1.06L9.06 8l3.06 3.06-1.06 1.06L8 9.06l-3.06 3.06-1.06-1.06L6.94 8 3.88 4.94l1.06-1.06L8 6.94Z',
  trash: 'M6.5 2h3l.5 1H13v1.5H3V3h2.5l.5-1ZM4 5.5h8l-.6 8.1A1.5 1.5 0 0 1 9.9 15H6.1a1.5 1.5 0 0 1-1.5-1.4L4 5.5Z',
  edit: 'M12.1 2.3 13.7 3.9a1 1 0 0 1 0 1.4l-7.6 7.6-2.8.7.7-2.8 7.6-7.6a1 1 0 0 1 1.5 0Z',
  chevronLeft: 'M10.5 4 6.5 8l4 4 1-1L8.5 8l3-3-1-1Z',
  chevronRight: 'M6.5 4 5.5 5l3 3-3 3 1 1 4-4-4-4Z',
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" className={className} fill="currentColor" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
