// The app's keyboard reference. Every shortcut here is bound somewhere in the UI —
// the shell's global handler (../WorklogApp), the task form (../components/TaskFormPage),
// the detail panel and the tag picker — and this page is the only place that
// collects them. Adding or changing a binding means editing this list too;
// nothing derives it from the handlers, so a stale row here is a silent lie.

import React from 'react';
import { KeyboardIcon } from 'lucide-react';
import { Kbd } from '../components';
import { Card, SectionLabel } from '../primitives';

/** One binding: the chords that trigger it, what it does, and any caveat about
 *  where or when it applies. Multiple combos read as "A or B" — the handlers
 *  accept either form. */
interface Shortcut {
  combos: string[][];
  label: string;
  note?: string;
}

interface ShortcutGroup {
  title: string;
  hint: string;
  items: Shortcut[];
}

/** ⌘ on Apple keyboards, Ctrl everywhere else. Every handler accepts both, so the
 *  page shows only the key the reader actually has. `client:only` hydration means
 *  there's no server render to disagree with. */
const MOD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Everywhere',
    hint: 'On any view. Single-letter shortcuts stand down while you are typing in a field, and the task form takes over the keyboard entirely while it is open.',
    items: [
      {
        combos: [[MOD, 'F'], [MOD, 'S']],
        label: 'Open search',
        note: `${MOD}S is bound as well so the browser's own save dialog doesn't open over the app.`,
      },
      {
        combos: [['⇧', 'N'], [MOD, 'N']],
        label: 'New task',
        note: `${MOD}N only reaches the app in the installed PWA — a browser tab keeps it for "new window" — and there, with a task's detail panel open, it starts a subtask of that task instead.`,
      },
      {
        combos: [['⇧', 'D'], [MOD, 'D']],
        label: 'Open the day view',
        note: 'Snaps back to today, so a date left over from the calendar is cleared.',
      },
      {
        combos: [[MOD, 'L']],
        label: 'Log time',
        note: 'Day view only. Opens the log form with today’s defaults filled in.',
      },
      {
        combos: [['Esc']],
        label: 'Close what is on top',
        note: 'The client dialog first, then a task’s detail panel, then search.',
      },
    ],
  },
  {
    title: 'Search',
    hint: 'While the search overlay is open.',
    items: [
      { combos: [['↓'], ['↑']], label: 'Move through the results' },
      { combos: [['↵']], label: 'Open the selected task and close search' },
      { combos: [['Esc']], label: 'Close search', note: 'Clears the query and every filter on the way out.' },
    ],
  },
  {
    title: 'Task form',
    hint: 'The new-task and edit-task pages.',
    items: [
      { combos: [[MOD, 'S'], [MOD, '↵']], label: 'Save the task' },
      { combos: [['↵']], label: 'Save the task', note: 'From the title field — a bare ↵ there saves straight away.' },
      { combos: [['↵']], label: 'Add the client', note: 'From the "New client name" field.' },
      { combos: [['Esc']], label: 'Leave the form' },
    ],
  },
  {
    title: 'Task details',
    hint: 'The panel that opens when you click a task.',
    items: [
      { combos: [[MOD, '↵']], label: 'Save the note you are writing' },
      { combos: [['Esc']], label: 'Close the panel', note: 'The browser’s Back button does the same thing.' },
    ],
  },
  {
    title: 'Tags',
    hint: 'The tag field on the task form.',
    items: [
      { combos: [['↓'], ['↑']], label: 'Move through the suggestions' },
      { combos: [['↵']], label: 'Add the highlighted suggestion, or whatever you typed' },
      { combos: [['⌫']], label: 'Remove the last tag', note: 'With the field itself empty.' },
      { combos: [['Esc']], label: 'Close the suggestion list', note: 'Leaves the form open — only the list closes.' },
    ],
  },
];

/** A chord as adjacent chips, with alternatives joined by "or". */
function Combos({ combos }: { combos: string[][] }) {
  return (
    <span className="flex items-center gap-[6px] shrink-0">
      {combos.map((combo, i) => (
        <React.Fragment key={combo.join('+')}>
          {i > 0 && <span className="text-count text-neutral-650">or</span>}
          <span className="flex items-center gap-[3px]">
            {combo.map((key, k) => (
              <Kbd key={`${key}-${k}`}>{key}</Kbd>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

export function ShortcutsView() {
  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-[10px]">
            <KeyboardIcon size={20} className="text-neutral-650" />
            <h1 className="text-[24px] font-bold m-0">Keyboard shortcuts</h1>
          </div>
          <p className="text-control text-neutral-675 mt-2 mb-0">
            Every shortcut the app binds. Modifier keys work as {MOD === '⌘' ? '⌘ or Ctrl' : 'Ctrl or ⌘'} — whichever your
            keyboard has.
          </p>
        </div>

        {GROUPS.map((group) => (
          <section key={group.title} className="mb-7">
            <div className="mb-3">
              <SectionLabel>{group.title}</SectionLabel>
              <div className="text-control text-neutral-675 mt-[5px]">{group.hint}</div>
            </div>

            <Card className="divide-y divide-neutral-250">
              {group.items.map((item, i) => (
                <div
                  key={`${item.label}-${i}`}
                  className="flex items-start justify-between gap-5 px-[18px] py-[13px]"
                >
                  <div className="min-w-0">
                    <div className="text-body font-medium">{item.label}</div>
                    {item.note && <div className="text-chip text-neutral-675 mt-[3px]">{item.note}</div>}
                  </div>
                  <Combos combos={item.combos} />
                </div>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
