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

## 2026-08-30

- **Lists** — an open list now has its own address: `/app/lists/<list>`. It survives a reload, Back closes it, and a half-ticked packing list is a link you can send someone or pin in a tab.
- **Lists** — the tab is a board now. Every list is a tile with a progress ring, how many items it holds and when you last ran it, and the ones you are part-way through sit in a strip on top with the next unticked item on them — so what you are in the middle of is the first thing you see, without opening anything. Clicking a tile opens that list across the whole pane; Escape or ‹ Lists takes you back to where you were on the board.

## 2026-08-29

- **Lists** — reusable checklists, on a tab of their own. A packing list for a cycling trip, the steps of a release, the invoicing routine: tick through it, press Start again, and it is waiting unticked for next time, with the day that run finished recorded on it. Each list is a plain Markdown file of checkboxes under `lists/`, so it reads as a checklist on GitHub and stays yours to hand-edit — ticking an item rewrites that one line and leaves your own prose, nesting and links exactly where they are.
- A list can be one long run of items or broken into sections — Bike, Clothes, Electronics — with its own **Add item** under each and a done count beside each heading. Add a section to a flat list and what was already on it stays above the new heading, so grouping a list you have been keeping never reshuffles it.
- Lists can be switched off in Settings → Views if you have no use for them: the tab and the view go, and the files stay in your Markdown for whenever you switch it back on.
- Items on a list can be reordered — drag one up or down, or from one section into another, and drop it where it belongs. On a phone the ⋯ menu on the row does the same thing without a drag: Move up, Move down, or Move to a section by name. Sections themselves move up and down from their own ⋯ menu. A reorder made on one device now survives the sync instead of being quietly put back by whatever the branch last saw.
- Every action on a list row is reachable on a phone. The ⋯ menus on items and on section headings used to appear on hover, which a touch screen has no way to do — so renaming, deleting and moving were invisible on the device the packing list is actually read on.
- **Duplicate** on a list menu makes a copy with nothing ticked, so you can keep the run you have just worked through as a record and start the next one from the top.
- Lists are searchable. ⌘K finds an item by its words, or a whole list by its name, under a Lists group of its own, and opening a hit takes you to that list.
- The front page now covers Lists: a card among the features, `lists/` in the repository tree and a sample `lists/release.md` beside the other file formats, so you can see what a checklist looks like in your repo before signing in.
- An empty list now says what it is for and offers one obvious first move, instead of two equally quiet grey links under a blank card. Add section, at the foot of a list that already has things on it, sits under a rule as a dashed button rather than looking like an Add item that has lost its heading. The add-item and add-section fields fill the width of the row they stand in.
- Settings → Sync gained "A list changes", so ticking your way down a packing list can reach GitHub within seconds instead of waiting out the sync delay — the same choice the other change kinds already had.
- On a phone, "New" while a task is open now starts a subtask of that task, the way ⌘N already did on a keyboard — so adding under a to-do opens the form as a to-do with the parent already picked, instead of a blank task on some client.

## 2026-08-28

- Subtasks now show up in the task lists. A task that has them carries a chevron next to its title and a count of how many; opening it lists them as indented rows in the same columns as everything else, so a subtask's status, tags and link line up with its parent's. They start open, and a parent you fold shut stays shut on the next visit. Searching looks inside subtask titles too and opens the parent it found one in.
- Task lists read by task name first: the status has become a small coloured dot with a quiet label, instead of a bold coloured word competing with the title next to it.
- The counts on a client card, in the control bar and beside "Open tasks" now count tasks, not tasks plus their subtasks.
- Searching and filtering a task list now happens inside the list itself: one control bar sits at the top of the card the rows are in, with the search box, the filters and the order on a single line instead of floating above a separate card with a second row of tag chips under it.
- Filters are quiet until they are doing something — a plain word with a chevron, and a box only once one is applied, so an untouched list no longer reads as four equally important controls.
- The counts moved into the menus: "All statuses" no longer carries a number that told you nothing, and each option inside says how many rows picking it would leave. Tags are a menu now too, with a search box once there are more than a dozen.
- On a phone the three menus collapse into one **Filters** sheet that slides up from the bottom, with the status, priority and tag lists in it and a Clear all. Sort keeps its own sheet and stays on the bar, because it changes what is at the top of the list.
- In a mid-width list — a tablet, or the day view's middle column — tags give up their column and ride behind the task title instead, so the titles get the width back. Everything else keeps its lane.
- The lists that group by client — Overdue, and the day's open and worked tasks — now put the column headings once above the cards instead of repeating them on every one, and every card lines its rows up against that single set of columns.
- A client card can be shut: click its header to fold its tasks away. The header keeps the client's name, its count and how many tasks are in it, and what you have shut is remembered per repository across reloads and across all three lists.
- The control bar in those grouped lists sits on the page above the cards rather than in a card of its own.
- "Save as default" and "Reset" moved out of the bar and into the sort menu, under the options they act on. The menu marks which order is the saved default, and the sort trigger carries a dot while the list is in some other one.

## 2026-08-27

- Open task lists are laid out as tables: status, task, priority, subtasks, due and tags each have a column of their own, so a task without a due date leaves a gap instead of shifting the rest of the row along. Subtasks indent their title rather than the whole row, which keeps their status in the status column.
- Clicking a column heading sorts the list by it, and clicking the same one again reverses it. It is the same order the toolbar's picker sets, so the two always agree — and "Save as default" still makes it the order every list opens in.
- Views that split one list across cards — Overdue by client, Upcoming by horizon, the day's open tasks — share one set of columns, so a due date sits in the same place from card to card.
- A wide row now shows one tag and a count of the others ("+2"); the full set is still there on a narrow screen, and in the task itself. Hovering a row lays its view/edit/delete buttons over the right-hand end instead of reserving room for them on every row.
- The landing page has a **See it in action** section under the hero, with a 30-second video of the app being used — a day's hours logged into the gap in the bar, the Markdown that wrote, and the commit that followed. A 90-second tour of every view is linked beside it. Neither loads until you press play.
- Both videos are built in `promo/`, from a scripted run of the real app against a demo timesheet that ships with it. Nothing in either one is a mock-up, and nothing touches a real repository.

## 2026-08-25

- The "a new version is available" bar no longer squeezes itself onto a phone: the sentence gets a line of its own and Reload sits on the next one, instead of every word breaking to fit beside the buttons.
- On a phone, the top bar's "New" adds straight to the to-do list while you're in the To-dos view, so that view's own "New to-do" button is now hidden there and the heading has room to fit on one line.
- The "Today" pill next to the date in the day view is hidden on phones, where it pushed the date onto a second line and the disabled "Today" button already said the same thing.
- The day bar is more compact on phones: each logged entry now sits in a shorter box, so the whole day fits on screen with less scrolling. Nothing changes on larger screens.
- On a phone, the day view is ordered the way you read it: the day itself first, then the links of the clients on it, then open, worked and done tasks, with the general to-do list last. On wide screens the links and to-dos stay together in the side column, which now lines up with the top of the day instead of hanging below it once you scroll.

## 2026-08-21

- A new **Upcoming** view in the nav lists everything you have planned but not yet reached: open tasks due after today, bucketed by how far off they are — tomorrow, later this week, next week, later this month, later — nearest first, with the same search, tag, status and sort controls the other task lists have. A recurring task shows its next occurrence rather than its whole series.
- A task's title can now be renamed straight from the task page — the pencil beside it opens the title in place, ↵ saves and Esc throws the edit away — instead of opening the whole edit form to change one line.
- ⌘↵ (ctrl+↵) now saves the description while you're editing it on the task page, the same keystroke that already saves a note or a new task.
- Adding or removing a task attachment now counts as a task edit for automatic sync, so with “A task is edited or deleted” ticked the file reaches GitHub within seconds instead of waiting for the timer or the Sync button.
- Fenced code blocks in descriptions, notes and previews are syntax highlighted, using the [Demo Time](https://marketplace.visualstudio.com/items?itemName=eliostruyf.vscode-demotime-theme) VS Code theme. Name the language on the opening fence and TypeScript, JavaScript, JSX/TSX, JSON, HTML, CSS, Markdown, shell, YAML, TOML, INI and Dockerfile get colour; anything else stays plain text.
- Code blocks wrap their long lines instead of scrolling sideways, keep their text readable on both themes when no language is named, and carry a copy button that appears when you point at the block.
- **Settings → Code block theme** picks the light or the dark Demo Time theme for those blocks, or follows your operating system, which is what a repo that has never set it does.
- The tag suggestion list opens upwards when the field sits near the bottom of the window, instead of hanging off the end of the page and leaving you to scroll to see what you can pick.
- Opening one task after another no longer leaves the previous task's title stacked on the page — the title of the task you are looking at is the only one there, however many tasks and subtasks you walk through.

## 2026-08-20

- Worklog is MIT licensed: the repo now carries a [LICENSE](https://github.com/estruyf/worklog-web/blob/main/LICENSE) file and `package.json` declares it, so tools that scan dependencies no longer report the license as unknown.
- A long link pasted into a note, a description or a day note now wraps instead of running
  past the edge of the card — on a phone it used to spill over the note's Edit and Delete.
- **Sync right away after** has a new kind to tick: a prompt written, edited, ticked off as run or
  removed in a task's queue. Prompts used to wait for the sync delay or the sync button, since no
  event covered them.

## 2026-08-19

- A prompt in a task's queue can go straight to an AI agent. Whichever you switched on under
  **Settings → AI agents**, **Run in GitHub Copilot** and **Run in Claude Code** now sit next to
  **Copy & mark ran** when you open a queued prompt: they hand VS Code the prompt's body as it
  stands — nothing of the task added — and tick it off in the same click, exactly as copying it
  does.
- A task's header shows its id in light grey next to the way out, so you can read off the `#…` reference you type to link it from another task.
- **Settings → Task content** switches attachments and prompts on or off — both on by default. Off hides the action and the section from every task; what's already written stays in your Markdown and comes back when you switch it on again. Images pasted into a description or a note are Markdown, not attachments, so they keep working either way.
- Tasks can hold prompts: the ones you already know you'll want to run, written when you think of them instead of when you get to them. Each is a title and a body, stored on the task as a `### Prompts` checkbox list, and starts from "Prompt" next to Description and Attach. A prompt is one row until you open it; "Copy & mark ran" copies the body and ticks it off in the same click, and ticked prompts fold away into a "Ran" list so the queue is what you see first. On a repeating task the queued ones carry to the next occurrence; the ones that ran stay with the occurrence that ran them.
- Tasks can carry file attachments: "Attach" a file up to 10 MB and it is stored in your repo's `assets/` folder and recorded on the task as a `- attachment:` line. Each file sits under the description as a card with its type badge (PDF, DOCX, PNG…) and name — click either the name or the download button to save it, or the bin to remove the record and the file together — followed by a button-sized “Attach” you can click *or* drop the next file onto.
- A task now offers what it hasn't got instead of showing empty sections: "+ Description", "Attach" and "+ Subtask" sit in one row under the description, and each drops out as soon as that block exists.
- The notes log is the other way round: the composer is at the top — one line until you click into it, then a full editor that stays open — with the notes under it newest first, each a row headed by the day it was written rather than a card.
- Ticking a task done (or reopening one) now shows a toast with an Undo that puts everything back — the task's status, the subtasks a close took down with it, and the original completion date on a reopen.
- On phones and in the day view's to-do rail, every task row has a "⋯" menu with View, Edit and Delete — actions that used to exist only as desktop hover buttons — and the done/worked circles are easier to hit without being easier to mix up.
- The Overdue view has the same search/status/priority/tag toolbar as the other lists; clients stay ranked longest-overdue first while the sort applies within each card.
- Calendar cells now show the day's total hours next to the date, and each client line carries its hours — no more hovering to find out whether a day was full.
- The log-time form is a real form: it opens with the keyboard in the right field, Enter logs the entry, Escape closes it, and Log is disabled (with a hint) when there is no client to log against.
- Settings is split into labelled General and Sync sections, and an unsaved draft now raises a bar at the bottom of the screen with Save and Discard — with any validation problem named right there instead of at the end of the page.
- Leaving Settings with unsaved changes — via the nav rail, a shortcut, browser Back, switching repository, signing out, or closing the tab — now asks before the draft is lost.
- A failing sync now stays on screen: a persistent "Sync failed" bar with a Retry button replaces the four-second toast, even when auto-sync is on, and the sidebar's repository footer shows when your hours last reached GitHub ("Synced 4 min ago").
- Insights' month picker captions and trend chart no longer count event hours, so they match the "Total hours" tile.

## 2026-08-18

- A task's description now has a copy button next to Edit, putting the raw Markdown on the clipboard.
- On a phone, a task opens straight onto its description and subtasks: the details rail
  and the notes moved into bottom sheets behind two floating buttons — a Notes button
  with the note count, and an ⓘ for status, priority, due date, tags and actions.
- Opening a repo is faster: images no longer download with the timesheet, but each one
  fetches the moment it first appears on screen — and stays in the browser's cache, so it
  won't download again until it changes.
- Tags can now be changed straight from a task's details: the rail's Tags block has an Edit
  link that opens the same tag picker the form uses, and shows an "Add tags" link on a task
  that has none — no need to open the whole task for a one-tag change.
- Fixed the parent picker snapping shut the moment you tapped it on a phone: opening its
  search box raises the on-screen keyboard, and the menu was treating that as a reason to
  close. Menus now follow their button when the page moves instead of closing.
- Indented list items in descriptions and notes now render as nested lists instead of
  falling out of the list as plain text with a stray dash in front of them.

## 2026-08-17

- Upgraded to Astro 7 and the Cloudflare adapter v14, clearing every outstanding `npm audit`
  advisory (12 down to 0). Nothing changes for you in the app, but local development now runs
  on the real Workers runtime instead of Node, so what you see in `npm run dev` matches what
  ships. Requires Node 22.12+.

## 2026-08-14

- The navigation drawer on a phone now scrolls, so Settings, the repository and the rest of
  the bottom of the rail are reachable instead of being cut off the bottom of the screen.
- The task form's client picker is now only about clients: the To-do chip is gone — the
  Task/To-do switch above already picks that — and switching to To-do hides the client
  section entirely instead of leaving an empty one behind.
- Every Markdown field — a task's description, its notes, a day note, a client's description —
  now has a formatting bar along the top of the box, the way GitHub's comment field does: bold,
  italic, strikethrough, code, link, and the four block markers. The shortcuts work without it
  (⌘B, ⌘I, ⌘E, ⌘K, ⌘⇧X, ⌘⇧8, ⌘⇧7), and with nothing selected they format the word the cursor
  is in.
- Enter inside a list carries the marker onto the next line, the way it does on GitHub — the
  bullet, the next number, a fresh `- [ ]`, or the quote. On an empty item it ends the list
  instead, so there is a way out without deleting the marker by hand.
- A note box is one box: the bar sits inside its frame rather than floating above it, and it
  stays put — nothing appears or disappears as you click into the field.
- A task's description is now something you open rather than something that is always half
  open. It sits there as written, with an **Edit** button; once you're in, **Write** and
  **Preview** are two looks at the same unsaved draft — switching to Preview no longer means
  giving anything up — and **Cancel** or **Save** are the two ways out. Cancel puts the
  description back the way it was.
- "+ Add image" has moved onto the formatting bar as a button, in notes and descriptions alike.
  It belongs with the other things that write at the cursor — and it is now only there while you
  are actually writing, rather than in Preview, where it edited text you weren't looking at.
- A subtask no longer offers subtasks of its own. The Subtasks section is gone from its detail
  panel, and the new-task shortcut opens a plain task there instead — the tree is one level
  deep, so there was nothing that section could ever hold.
- The new task form opens with a **Task / To-do** switch beside its heading, so what you're
  writing down can change its mind halfway through. Picking To-do files it under the general
  list instead of a client; picking Task again puts it back on the client you had.
- The sidebar collapses. The button beside the wordmark narrows the rail to its icons, giving the
  view the width back, and the same button puts it back — every tab, action and count is still
  there, with its name as a tooltip. How you left it is remembered on that device, so the app
  opens the way you work.
- **Report an issue** is now in the sidebar, under the actions: it opens a new issue on Worklog's
  own repo in a fresh tab, so a bug or a request goes straight where it can be picked up without
  leaving the app or losing anything you haven't synced yet.
- The app starts on roughly half the JavaScript it used to. Insights brings its own charting
  library, and now that weight loads with Insights instead of ahead of every other tab — fetched
  quietly in the background once the app is up, so the tab still opens instantly and still works
  offline.

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
