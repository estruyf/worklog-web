# Changelog

Every change to Worklog, by day, newest first.

<!-- This file is the /changelog page: src/pages/changelog.astro renders it as-is, so
     the heading and the line above are what a reader sees, and the notes below stay
     invisible. Anything that would only make sense to whoever writes the entries
     belongs in a comment like this one, not in the prose.

     One line per change, written as what it means for someone using the app — not as
     a commit message. Internal work (refactors, docs, test plumbing) gets a line too
     when it changes how the codebase is worked in.

     Newest day on top; date headings are YYYY-MM-DD (test/changelog.test.ts enforces
     both). Links must be absolute — a relative path resolves against /changelog and
     404s. -->

## 2026-08-12

- A task can now be handed to an AI agent. Switch on GitHub Copilot or Claude Code under
  **Settings → AI agents** — both start off — and each one you enable shows up in a task's
  **Actions** list. Pressing it opens the task's title and description as a prompt in VS Code,
  sitting in the input for you to read and send yourself. It needs the
  [Command Executor](https://marketplace.visualstudio.com/items?itemName=eliostruyf.execcommand)
  extension (0.0.2 or newer), which is what lets a link open a command in VS Code at all. Claude
  opens as a proper Claude Code tab rather than a terminal command. A task whose title or
  description contains an `&` opens correctly too — it used to arrive cut off at that character,
  and sent itself rather than waiting in the input.
- Every view now keeps its header on screen while you scroll. Stepping to yesterday, jumping to
  today, switching the calendar's month, marking the open task done — the buttons stay where you
  left them instead of scrolling off the top of a long day. The nav rail and the "not synced"
  banner stay put with them, and the Day view's to-do list finally pins itself beside your work
  on a wide screen the way it was always meant to.
- Fixed the second scrollbar sitting next to the view's own one. There is one scrollbar again,
  the one that moves your work.

## 2026-08-11

- Open a subtask *from its parent* and the way out now leads back to the parent, so you can work
  down its list one subtask at a time instead of landing on the day and finding your way in again.
  Open the same subtask from the day, the search or a shared link and the button reads "Back to
  Day" as before — it names where you came from, not where the task sits.
- Task lists with no subtasks in them no longer leave a gap on the left for the fold arrow — the titles
  start where the list starts, and the arrow's column appears only once something in that list has subtasks
- This changelog is now a page anyone can read, at `/changelog` — linked from the site footer
  and from "What's new" at the bottom of the app's sidebar. It is this file, rendered: the
  dates run down one side and the day's changes beside them, so what shipped and when is
  answerable without reading the commit log.
- Task notes take images now. Paste a screenshot, drop a file on the note box, or use
  "+ Add image" — in the composer and when correcting a note already written. Notes have
  always *shown* images; they were the one place you couldn't put one in, which meant
  screenshotting a bug meant writing it in the description instead of in the log where it
  belonged.
- Fixed the README's claim that a pasted image only appears after the next sync and doesn't
  work in private repos. Neither has been true for a while — images render from the copy in
  memory, so they show immediately and private repos behave like public ones.
- A task's subtasks can now be logged as worked on straight from the list, the way the Day
  view's rows can — no more opening each subtask to say you spent time on it.
- The worked-on button says what it does: "Log work today" rather than "Mark worked", and
  hovering it spells out the day it writes to ("Log this task as worked on Tue 11 Aug 2026 —
  it then shows under that day's worked tasks"). It names the date you are looking at, so
  logging against an earlier day can't be mistaken for logging against today.
- Opening a task from a day no longer nudges the page sideways: the task view's content now
  lines up with the same column every other view uses.
- A tab left open overnight now notices the new day when you come back to it, instead of going
  on calling yesterday "today": the Day view's Today button works again, overdue counts are
  counted against the real date, and a recurring task due today shows up. It used to depend on
  a timer at midnight, which a backgrounded or sleeping machine never runs. The day you were
  looking at stays put — only the app's idea of the date moves.
- Opening a task now goes to its own address (`/app/task/<id>`), so the task in front of you
  is a link you can copy out of the address bar and hand to someone — it used to open as a
  panel over the app with the URL never changing. Leaving it — the button top left, which now
  names where it goes ("‹ Back to Day", "‹ Back to Calendar"), Escape, or the browser's Back —
  returns you to the view you opened it from, and a task's tag chips now lead to the tag search
  from the task itself. A task link truncated at the last slash (`/app/task`) lands on the
  dashboard instead of a "page not found".
- Task details now put the description above the subtasks, so what the task is comes before
  what it breaks down into.
- A task's subtask list now shows only what is still open, with a "Show N done" toggle in the
  section header for the rest; when shown, the done ones sit at the bottom. A task whose
  subtasks are all done still lists them all.
- Every listed link — a task's issue links, a client's reference links in the day view and on
  the client page — now has a copy button next to it, so the URL no longer needs the browser's
  right-click menu; the button answers with a green check. Long links show truncated on one
  line with the full URL on hover.
- Timesheets can carry a default order for open-task lists in `.worklog/config.json`
  (`defaultTaskSort`); repos without one keep showing tasks in the order they were created.
- Saving a new task now opens that task instead of returning to the day view.
- Client links in the day view can be selected and navigated to.
- README leads with the product name and links the live demo.
- Removed the stale code audit document.

## 2026-08-10

- Task detail groups its actions in one row instead of scattering them across the panel.
- The parent picker says what picking a parent will do, and refuses moves that would nest a task under its own subtask.
- Subtask rows read correctly to a screen reader and line up on narrow screens.
- Worklog row buttons carry icons and titles, so what each one does is visible without hovering.

## 2026-08-07

- Tasks can carry a priority, shown on the row and usable as a filter.
- Task detail moved its metadata into a sidebar, leaving the description the width of the panel.
- Notes on a task are edited in place rather than through a separate form.
- Typing `#` in a description links to another task, and the link renders as that task's title.

## 2026-08-06

- Statuses are yours to define in Settings — add, rename and reorder them; tasks using a removed status keep working and are listed back under "Still in use".
- Sharing a page from the OS share sheet opens the new-task form with it filled in.
- The installed app badges its icon with how many tasks are due or overdue.
- Subtasks can be added straight from the task's subtask list.
- Installed-app polish: external links open in the browser, any screen orientation, and the app is categorised for app stores.

## 2026-08-05

- `web+worklog:` links open the app on a prefilled new task; opening a second one reuses the window you already have.
- Task rows collapse, and stay collapsed the next time you open the app.
- Checkboxes inside a task's Markdown can be ticked from the app.
- A new version of the app offers to reload instead of waiting for the next cold start.
- The launcher's shortcut menu jumps straight to New task, Day, Calendar or To-dos.
- The Chrome extension is linked from the sidebar and the FAQ.

## 2026-08-04

- The app opens and stays usable without a network — edits queue up and sync when you're back, with a status bar showing where sync stands.
- Days take free-form notes alongside the logged entries.
- The sign-in cookie is httpOnly and Secure, so the GitHub token never reaches browser JavaScript.
- Homepage and app icons refreshed.

## 2026-08-03

- Auto-sync can push chosen kinds of change immediately instead of waiting out the delay.
- Insights gained a month picker and a copy button for the hours table.
- A recurring task's series can be ended, archiving it without leaving a next occurrence behind.
- The day view shows the day as a bar, so logged, open and overdue work is visible at a glance.

## 2026-07-31

- Task lists filter and sort across every view.
- Opening `/app/new?title=…` prefills the new-task form, so other tools can hand work over.
- Bare URLs in Markdown become links.
- Search clears with a close button instead of a Cancel button.
- Internal: `worklogStore` split into sync, recovery, remote-watch and asset modules, and the one giant model hook into `hooks/model/*` — the seams the UI is refactored along since.

## 2026-07-30

- Destructive actions ask first, and a shortcuts view lists every key binding; `d` jumps to the day view.
- Task creation and editing moved to a full page with a sidebar that stacks on mobile.
- Internal: buttons, modals and dialogs rebuilt on a shared primitives layer, so tone and focus behaviour are decided in one place ([docs/ui-primitives.md](https://github.com/estruyf/worklog-web/blob/main/docs/ui-primitives.md)).

## 2026-07-29

- Overdue work has its own view, grouped by how late it is.
- Two devices editing the same timesheet merge record by record — no conflict markers in your Markdown, and one-sided changes always win.
- Changes pushed from elsewhere show up without a reload.
- Clients carry a description and links, rendered on the client page.
- Images stored in the repo's `assets/` render in task descriptions.
- The sidebar and day header navigate between dates directly.

## 2026-07-28

- Tasks can recur — ticking one off computes the next occurrence, with nothing scheduled in the background.
- The day view's to-do list pages, at a size set by `todosPerPage`.
- Worklog edits sync both ways against the branch.
- Time can be logged as a public holiday.
- The marketing homepage landed at `/`.

## 2026-07-27

- To-dos that belong to no client.
- Tasks take tags, and clients you're done with can be archived out of the pickers.
- Insights got more room, and offline pages match the app's theme colour.

## 2026-07-24

- First release: a timesheet that lives in your own GitHub repo as Markdown — day view, clients, calendar, insights and settings.
- Point it at an existing repo or have it create and scaffold a new one.
- Auto-sync commits your edits on a delay you choose.
- Unsynced edits survive a closed tab and are offered back on the next open.
- Installable as an app, with offline caching, splash screens and icons.
