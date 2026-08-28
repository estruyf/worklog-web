# UI primitives — migration plan

The UI grew without a controls layer: every button, input and card was written
inline at the call site, so the same control exists in several slightly different
versions. This document records the audit that found them, what has been fixed,
and what is left.

The ordering is deliberate. Each step is independently shippable and leaves the
app working, so none of this has to land in one go.

**Status:** steps 1–8 done.

---

## The rule

Primitives in `src/ui/primitives/` are style-only — they know nothing about
tasks, clients or the worklog. Anything app-aware belongs in
`src/ui/components/` and is composed *from* primitives.

`cn()` is deliberately not a Tailwind-aware merge (there is no `tailwind-merge`
in the project, and class order in the attribute does not decide which utility
wins — the CSS source order does). So a `className` passed to a primitive can
**add** utilities — layout, margins, width — but cannot reliably **override**
the ones its variant and size already set. Anything needing different padding or
a different colour wants a new variant, not an override at the call site.

If you find yourself reaching for `!` to force a primitive's style, that is the
signal to add a variant or a tone instead.

---

## Step 1 — Button / IconButton / LinkButton ✅ done

**Added:** [`src/ui/primitives/`](../src/ui/primitives/) — `cn`, `Button`,
`IconButton`, `LinkButton`.

**What it collapsed.** Roughly 40 button call sites across 19 files, previously
written as:

| Tone | Instances | Distinct class strings |
| --- | --- | --- |
| Primary (`bg-brand-450`) | 19 | 8 |
| Secondary (white/neutral) | 10 | 6 |
| Danger | 8 | 5 |

Disabled styling had been done three incompatible ways — `disabled:opacity-50`,
`disabled:text-neutral-625`, and a hand-rolled ternary to
`border-brand-375 bg-brand-175 text-brand-550 cursor-not-allowed` duplicated in
three files. Each variant now owns its own `disabled:` treatment.

**One behavioural note.** The three "looks disabled but isn't" buttons became
real `disabled` attributes. This was verified safe rather than assumed:
`submitTask` in [`useWorklogModel.ts`](../src/ui/hooks/useWorklogModel.ts) and
`saveClient` already return early on exactly those conditions, so a click did
nothing before either. The change only makes the rule reachable by keyboard and
assistive tech.

**API:**

```tsx
<Button variant="primary|secondary|neutral|danger|dangerSolid|success|dashed|ghost"
        size="xs|sm|md|lg" />
<IconButton variant="ghost|outline" size="xs|sm|md" aria-label="…" />  // aria-label required
<LinkButton size="inherit|xs|sm|md|lg" tone="info|muted|danger" />
```

**Deliberately left alone** — these are different controls, not buttons, and
belong to later steps: the tag chips and joined segmented pairs in
`TaskDetailPanel`, `ArchiveView`'s pager, `Sidebar`'s nav items (already
extracted locally as `navItemClass` / `actionClass`), `LoggedSection`'s pills,
and `RepoPicker`'s repo-list rows.

---

## Step 2 — Field / Input / TextArea / Select / DateInput ✅ done

**Added:** [`Field`](../src/ui/primitives/Field.tsx),
[`Input`](../src/ui/primitives/Input.tsx),
[`TextArea`](../src/ui/primitives/TextArea.tsx),
[`Select`](../src/ui/primitives/Select.tsx),
[`DateInput`](../src/ui/primitives/DateInput.tsx), over shared style tables in
[`controlStyles.ts`](../src/ui/primitives/controlStyles.ts).

**What it collapsed.** 34 controls across 11 files. The tables are shared with
the *shell* an adorned input needs, so the bordered control and the bordered box
around a bordered-looking control are built from one set of numbers rather than
two that drift.

**The iOS zoom bug is now unrepeatable.** The 16px floor lives in the size table
(`CONTROL_TEXT`), so a control cannot be given a smaller mobile font without
editing that one line. 25 of the 34 had no guard before — every field in
`SettingsView`, `ClientFormModal`, `LogForm`, `TaskDetailPanel` and
`RepoPicker`, both `ArchiveView` selects, and the search field itself, which set
no font size at all and so inherited the body's 13px.

**One focus affordance.** `default` is border + 3px brand ring on focus;
`accent` wears that treatment permanently, which is how the one field a form
opens on says "start typing here"; `invalid` replaces both with the danger pair
rather than layering on top, so a bad field reads the same focused or not.

**Behavioural notes** — three things changed, all deliberately:

- **Labels now point at their control.** Every `<label>` in these forms was a
  bare `<label className="…">` with no `htmlFor`, so clicking it did nothing and
  assistive tech announced the control unlabelled. `Field` generates the id and
  hands it down through context, so the call site never sees it. Controls with
  no visible label (the link repeaters, the filter fields, the two date pickers
  in `TaskDetailPanel`) got an `aria-label` instead.
- **Validation reaches the control.** `SettingsView`'s three numeric settings
  printed a red message below the card while the field itself stayed neutral;
  they now go red too. `TaskDetailPanel`'s overdue due date already did this by
  hand and now does it through the same `invalid` prop.
- **`SearchOverlay`'s clear `×` moved to the end of the row**, after the Esc
  button. `ArchiveView`'s filter already ended with its `×`, and the two search
  fields now end the same way.

**`Select` paints its own chevron** (added after the fact, 2026-07-31). A
bordered native `<select>` still lets the platform draw over it: on iOS that is
a grey pill with centred text and no arrow, which is why the status, sort and
client filters read as dead boxes in the installed PWA while the same markup
looked fine in desktop Chrome. The `select-chevron` utility in
[`styles.css`](../src/ui/styles.css) strips the appearance *and* supplies the
arrow — both in one utility, so a select can't end up with neither — and
`SELECT_CHEVRON` in the style table holds the per-size right padding and arrow
inset. It stays a background image rather than a sibling element so `Select`
remains one element and a call site's `w-full` / `flex-1` keeps landing on the
control. The filter rows in `TaskListToolbar` and `ArchiveView` also give the
query its own row below `sm:`, so the pickers split the next one evenly instead
of wrapping to whatever width their longest option asks for.

`Field` also wires `aria-describedby` to its help and error lines, and owns the
"Clear" link that sits opposite a label on a filled date field — the pattern
`TaskFormPage` and `RecurrencePicker` each wrote out by hand.

**API:**

```tsx
<Field label="Due" hint="optional" action={<LinkButton/>} help={…} error={…}
       labelSize="xs|sm|md" />               // error also marks its control invalid
<Input size="xs|sm|md|lg" variant="default|accent" invalid
       leading={…} trailing={…} clearable onClear={…} />
<TextArea size="…" variant="…" resizable autoGrow /> // autoGrow drops the resize grip
<TextArea header={toolbar} textareaClassName="min-h-[…]" /> // shell + bare textarea, as Input's
                                                           // adornments do; className styles the shell
<Select size="…" variant="…" />
<DateInput size="…" variant="…" />
```

Width is deliberately not in any variant: it is layout, so `w-full`, `flex-1`
and `w-[96px]` stay at the call site — which is the one thing `cn` can safely
add.

**Deliberately left alone:** `TagPicker`'s input (a combobox inside its own chip
shell — a control of its own, not a text field); `TaskFormPage`'s description
textarea, which is borderless inside the write/preview tab box and is step 5's
`DescriptionEditor` to unify with `TaskDetailPanel`'s; the two hidden file
inputs; and `RepoPicker`'s lone checkbox, which has nothing to be consistent
with yet.

---

## Step 3 — Modal ✅ done

**Why:** this was an accessibility gap, not only duplication.

**Added:** [`Modal`](../src/ui/primitives/Modal.tsx).

**What it collapsed.** Four dialogs repeated the backdrop + panel + shadow at
four different levels of correctness — now one row:

| File | `role`/`aria-modal` | Own Esc handler | Focus trap |
| --- | --- | --- | --- |
| `ConfirmDialog` | was yes | was yes | was no |
| `SearchOverlay` | was no | was shell-driven | was no |
| `ClientFormModal` | was no | was shell-driven | was no |
| `WebApp` (recovery) | was no | was no | was no |

`ConfirmDialog` still stops keydowns in the **capture** phase — that is the
`captureKeys` prop, and it is why the trap and the Escape handler live on a
window capture listener rather than on the panel: a listener on the panel would
never see an event that was already stopped above it.

**Behavioural notes** — four things changed, all deliberately:

- **Focus starts inside the dialog and comes back out.** None of the four
  trapped focus, so Tab walked straight out into the page behind. `Modal` takes
  focus on mount when no child claimed it with `autoFocus`, wraps Tab and
  Shift+Tab, and hands focus back to the element that opened the dialog when it
  closes — unless something else claimed focus meanwhile, since closing a search
  hit opens the task it was about and that screen focuses itself.
- **Escape belongs to the dialog with the focus.** It is handled in the modal and
  stopped there, so the shell's Escape branch is down to the task detail panel
  (the one overlay that is not a dialog). This is what makes layering correct:
  the confirm dialog raised over the client form is the one that closes, because
  the client form's own handler stands down while it does not hold the focus.
- **Three dialogs became dialogs.** `SearchOverlay`, `ClientFormModal` and the
  recovery prompt had no `role`, no `aria-modal` and no accessible name; they now
  announce as dialogs, named by their heading (or, for the search palette, which
  has no heading, by a `label`).
- **The recovery prompt has no `onClose` on purpose.** It is the one dialog with
  no dismiss: leaving it would strand the recovered edits as neither restored nor
  discarded. Passing no `onClose` is how a `Modal` says that — backdrop clicks
  and Escape then do nothing, which is what it already did by omission.

`ClientFormModal`'s close `×` is now an `IconButton`, so it has an accessible
name; it was a bare `×` glyph in a `<button>` with nothing to announce.

**Three small visual changes**, all of them drift being collapsed rather than
intent: the confirm panel's padding (28/26/22 → 30/26/24, matching the other
two), its max width on a phone (`max-w-full` inside a `px-4` backdrop →
`max-w-[92vw]`, ~1px different), and the recovery prompt's width (460 → 440).

**API:**

```tsx
<Modal onClose={…}                        // omit for a dialog that must be answered
       title={…} titleSize="sm|md" showClose
       label="…"                          // accessible name when there is no title
       describedBy="…" role="dialog|alertdialog"
       size="sm|md|lg"                    // 440 / 520 / 760
       offset="xs|sm|md|lg"               // pt-8vh / 10vh / 12vh / 16vh
       layer="base|top"                   // z-50 / z-60
       padding="md|none" captureKeys className="max-h-… overflow-…" />
```

`Modal` deliberately owns no spacing under its heading: the gap belongs to
whatever follows, so each dialog keeps its own rhythm (the call sites carry it as
a `mt-` on their first child rather than a `mb-` on a header they no longer
render).

**Deliberately left alone:** [`TaskDetailPanel`](../src/ui/components/TaskDetailPanel.tsx),
which is a full-bleed panel inside the app chrome rather than a centred dialog —
it keeps the shell's Escape and is step 6's to split; `Sidebar`'s mobile drawer
scrim; and the loading overlay in `WorklogApp`, which is not focusable at all.

---

## Step 4 — Card / SectionLabel / EmptyState / Badge / Chip / SegmentedControl / Toggle / Pager ✅ done

**Added:** [`Card`](../src/ui/primitives/Card.tsx),
[`SectionLabel`](../src/ui/primitives/SectionLabel.tsx),
[`EmptyState`](../src/ui/primitives/EmptyState.tsx),
[`Badge`](../src/ui/primitives/Badge.tsx),
[`Chip`](../src/ui/primitives/Chip.tsx),
[`SegmentedControl`](../src/ui/primitives/SegmentedControl.tsx),
[`Toggle`](../src/ui/primitives/Toggle.tsx),
[`Pager`](../src/ui/primitives/Pager.tsx).

**What it collapsed:**

| Control | Call sites | What varied |
| --- | --- | --- |
| `SectionLabel` | 22 | 11 / 10.5px, `tracking` .06 / .05em, bold / semibold |
| `Card` | 22 | white / neutral-50 / brand-50 / danger-bordered, 14 / 12 / 11px corners |
| `EmptyState` | 14 | 14 / 13px |
| `Badge` | 13 | 5 tone spellings across neutral, brand and danger |
| `Chip` | 4 families | select, add, filter, tag |
| `SegmentedControl` | 6 | 3 shapes, one of them written twice byte-for-byte |
| `Pager` | 2 | numbered window, and a "2 / 5" stepper |
| `Toggle` | 1 | `SettingsView` only, still worth naming |

The two signals the audit called out were both right.
[`GroupCard`](../src/ui/views/day-view/GroupCard.tsx) took `cardClassName`,
`headerClassName` and `countBadgeClassName` as props; it now takes
`tone="plain|worked|overdue"` and derives all three. `chipClass` in
`RecurrencePicker` and its inlined twin in `TaskFormPage` are one `Chip`;
`TagChips` and its two re-implementations are the same `Chip variant="tag"`,
hover states and all.

**Design tokens.** The scales live in the `@theme` block of
[`styles.css`](../src/ui/styles.css) and every primitive reads from them, so the
numbers are retired rather than rehoused:

```css
--radius-chip: 5px;  --radius-control: 7px;     --radius-control-md: 8px;
--radius-control-lg: 9px;  --radius-panel: 12px;  --radius-card: 14px;

--text-status: 10.5px;  --text-eyebrow: 11px;   --text-count: 11.5px;
--text-meta: 12px;      --text-chip: 12.5px;    --text-control: 13px;
--text-control-lg: 13.5px;  --text-body: 14px;  --text-row: 14.5px;
--text-touch: 16px;

--tracking-eyebrow: 0.06em;  --tracking-status: 0.05em;
```

They are named for the thing that wears them, not sized t-shirt style, because
that is the decision at the call site: `rounded-card`, not "is this the 14 or
the 12 one". `text-touch` is the iOS floor from step 2 — naming it is what makes
`text-touch md:text-control` legible as *"opens at the floor, steps down on a
real screen"* rather than as two numbers. The names avoid every existing colour
token (`--color-badge` already owns `text-badge`, hence `--text-count`).

The sweep went past the primitives: 0 uses of these values as arbitrary
`text-[…]` / `rounded-[…]` / `tracking-[…]` remain anywhere under `src/ui`.
Sizes outside the ladder — the 15px "+" glyphs, the 17/20/22/24/26px headings,
the calendar cell's 10px corner — were left as they are; they are not a scale,
they are one-offs.

**Icons.** `icons.tsx`'s `Icon` and its 12 paths turned out to be used in *zero*
places, not two — a whole second icon system nothing called. It is deleted. The
file now holds what is genuinely the app's own: the seven nav glyphs
[`Sidebar`](../src/ui/components/Sidebar.tsx) carried inline (76 lines, tuned to
read at 16px against the rail's weight), plus a `DisclosureIcon` for the fold-open
triangle that had been written three ways — an SVG path in `ClientsView`, a `›`
character in `TodosView` and another in `CalendarView`. Everything that was
duplicated *and* has a lucide equivalent now uses it: the external-link glyph
(5 files), the checkmark (5, including `Toast`'s), the search glyph (2). The rule
the file now states: hand-rolled glyphs are the nav's, everything else is lucide.

**Behavioural notes** — three things changed, all deliberately:

- **The segmented controls became one control.** Each is now a `role="group"` of
  `aria-pressed` buttons with an `aria-label` on the group, which is required by
  the type — read one segment at a time, "All" and "Open" say nothing about what
  they switch. A `Chip` gets `aria-pressed` only when the call site passes
  `selected`, so a tag that opens a search is a button and a tag that toggles a
  filter is a toggle, and neither pretends to be the other.
- **`TodoTasksSection`'s pager counts from 1.** It kept a 0-based page and
  rendered `current + 1`; `Pager` is 1-based throughout, so the state and the
  label are the same number. The clamp-don't-reset behaviour is unchanged.
- **The Git-sync switch is named, and its title is no longer a `<label>`.** It
  had `role="switch"` and `aria-checked` but no accessible name at all. `Toggle`
  requires an `aria-label` the way `IconButton` does. The title stays a plain
  `<div>` on purpose: `<label htmlFor>` works on a `<button>`, and it would mean
  a click anywhere in that paragraph flips the switch.

**Visual changes** — all of them drift being collapsed, none of them intent:

- The worked-group count badge (`bg-brand-250 text-brand-625`, no border) became
  the shared brand badge, which has one.
- The calendar's month/week toggle and the task form's Write/Preview tabs both
  became the raised track the archive and search filters already used.
- `Sidebar`'s "Repository" eyebrow was semibold neutral-650 where every other one
  is bold neutral-675.
- The two chart headings and Insights' table headers tracked at 0.05em where the
  other 20 eyebrows track at 0.06em.
- Insights' two tables and both chart boxes were `border-neutral-400` at an 11px
  corner; they are `Card`s now (neutral-375, 14px).
- `ClientsView`'s "Archived" pill dropped its extra bold and letter-spacing.
- The archive pager's `‹ ›` characters became the lucide chevrons the to-do pager
  already used.
- `IconButton`'s `xs` corner moved 6px → 7px, joining the control ladder.

**API:**

```tsx
<Card tone="plain|muted|brand|danger" padding="none|list|md" radius="card|panel" />
<SectionLabel size="sm|md" tone="muted|danger" />   // uppercases its own text
<EmptyState size="sm|md" />
<Badge tone="neutral|outline|brand|danger" size="xs|sm|md" />
<Chip variant="select|add|filter|tag" selected as="button|span" truncate />  // truncate: for a fixed-width column
<SegmentedControl options={[{value, label, title}]} value onChange
                  variant="raised|joined" size="sm|md" aria-label="…" />  // aria-label required
<Toggle checked onChange aria-label="…" />                               // aria-label required
<Pager page={1} pageCount onPage variant="numbers|compact"
       pages={pageWindow(page, pageCount)} previousLabel nextLabel />
```

`Card`'s corner is a `radius` prop rather than a `className`, for the same reason
its fill is a `tone`: `cn` cannot override what a variant already set, and a card
nested inside a card wants the smaller corner often enough to be worth naming.
`Pager` takes its page window rather than computing one — how much of a long list
is worth showing is a decision about that list, and `pageWindow` already exists in
[`utils/archive.ts`](../src/ui/utils/archive.ts).

**Deliberately left alone:**

- `LogForm`'s Type and Amount groups — bordered chips sitting in a row of fields,
  not a track; a raised segment there would read as a second toolbar.
- `RepoPicker`'s Existing/New pair, which is pre-auth and has its own look.
- `SearchOverlay`'s match badge — square, 10px, uppercase: a match-kind tag, not a
  count.
- `LoggedSection`'s log entries — a chip with structure inside it (dot · client ·
  type · hours · note) and an edit action; that is a component, and it is step 5's.
- `RecurrencePicker`'s weekday toggles, squared off so a week reads as a row of
  days rather than seven pills.
- The two "click to add a description" dashed boxes, which are step 5's
  `DescriptionEditor`, and Insights' three stat tiles, which are step 6's
  `StatTile`.

---

## Step 5 — DescriptionEditor / LinksField / CompletedTaskRow / ClientListItem ✅ done

Now that primitives exist, the genuine feature duplication is worth extracting.
These are app components, not primitives: they know what a task and a client are,
so they live in [`src/ui/components/`](../src/ui/components/) and are built *from*
the primitives below them.

**Added:** [`DescriptionEditor`](../src/ui/components/DescriptionEditor.tsx),
[`LinksField`](../src/ui/components/LinksField.tsx),
[`CompletedTaskRow`](../src/ui/components/CompletedTaskRow.tsx),
[`ClientListItem`](../src/ui/components/ClientListItem.tsx).

**`DescriptionEditor` — the highest-value extraction in the codebase.**
`TaskFormPage` and `TaskDetailPanel` both implemented "markdown editor with
write/preview toggle, hidden file input, `useMarkdownImages` wiring, identical
placeholder string, click-to-edit empty state, error line". Two skins, as
budgeted: `boxed` is the form's, where the tabs and the image action ride on the
box the modes swap inside because that box *is* the field; `inline` is the detail
panel's, where the controls sit in the section header beside "Description" and the
preview is a card rather than the inside of a frame.

The placeholder is the reason the component had to exist rather than the toggle:
it doubles as the Markdown cheatsheet, and two copies of a cheatsheet drift toward
whichever one nobody is looking at.

Both call sites lost their `useMarkdownImages` + `makeImageResolver` wiring
(`TaskDetailPanel` keeps a resolver, but for its notes). Mode state stays outside —
the form opens an existing description in preview and a new one ready to type,
which is a decision about that form, and the panel's mode is app-wide UI state.

**`LinksField` — and task links grew labels.** The two repeaters differed in shape
(`string[]` vs `{url, label}[]`); settling on the richer one is a real gain, since
`TaskLink.label` already existed in the model, already round-tripped through
`- link: <url> <label>`, and was already rendered by `TaskDetailPanel` and
`ClientsView` — the task form was simply the one place that couldn't set it.

That widening reaches past the UI: `NewTaskInput.links` and `TaskFields.links` now
take `(TaskLink | string)[]`, and both go through a new `parseLinks` in
[`paths.ts`](../src/workspace/paths.ts) — the normalizer `parseClientLinks` already
was, now factored out and shared. `updateTask` previously mapped links to `{url}`
with no trimming at all; it trims and drops blanks like every other path now.
The form's draft shape is `LinkDraft` in [`viewModels.ts`](../src/ui/model/viewModels.ts):
`label` is always a string while typing (so a controlled input never flips to
uncontrolled) and the blank is dropped on save.

Rows wrap rather than squeeze, which is what lets one field serve a 520px dialog
and the form's 320px rail: side by side in the dialog, label under url in the rail.

**`CompletedTaskRow`.** The struck-through row existed four times — `ClientsView`,
`ArchiveView`, `DoneTasksSection`, `TodosView` — with the same shell
(`gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-225`) in all four and four
different subsets of {reopen check, status, meta, link, actions}. `meta` is the one
fact the surrounding list doesn't already state: the completion date in a client's
own list, the client name in a day's.

**`ClientListItem`.** `ClientsView` wrote its client row four times over — desktop
and mobile, active and archived — and `dimmed` was the only thing that varied.
Width is not in the component (it is layout, per step 2's rule): the desktop rail
passes `w-full mb-[3px]`, and the dropdown's 6px inset moved from a margin on every
row to the panel's own padding, which is what lets the rows be plain full-width
buttons.

**Behavioural notes** — four things changed, all deliberately:

- **Three lists of closed tasks became keyboard-reachable.** `ClientsView`,
  `DoneTasksSection` and `TodosView` rendered the title as a `<span onClick>`;
  `ArchiveView` already had it right as a `<button>`, and that is the version all
  four now share. The same fix applies to the client rows (four `<div onClick>`s,
  now buttons carrying `aria-current` — nothing said which client was selected
  before) and to both "click to add a description" boxes, which were a dead end in
  preview mode for anyone not using a mouse.
- **The description heading is no longer a `<label>`.** It had no `htmlFor` in
  either editor, and it could not have had one: in preview mode there is no control
  for it to point at. It is a heading, and the editor carries the name as an
  `aria-label` — which is what `TaskDetailPanel` already did.
- **One write/preview toggle, one order.** The detail panel's said Preview / Edit;
  the form's said Write / Preview. Both now say Write / Preview, edit first. The
  two empty states said different things ("Nothing to preview yet" vs "No
  description yet"); they say the second.
- **The remove-link buttons became `IconButton`s.** They were bare `×` glyphs in
  36px and 38px hand-styled boxes, one with an `aria-label` and one with only a
  `title`; both are now the outline `IconButton` with a lucide `XIcon` and a
  numbered label ("Remove link 2"), so a repeater of them is distinguishable.

**Visual changes** — all of them drift being collapsed:

- The client rows' padding was `py-[9px]` on desktop and `py-[10px]` in the
  dropdown; they are `py-[10px]`, the larger of the two, since it is also the
  better pointer target.
- The desktop client rows now truncate a long name, which only the mobile ones did.
- The mobile dropdown's "Add client" was a hand-rolled dashed `<div>`; it is the
  `Button variant="dashed"` the desktop rail already used.
- Three of the four completed-task rows gained the `hover:underline` on their title
  that the archive's already had.

**API:**

```tsx
<DescriptionEditor variant="boxed|inline" value onChange mode onModeChange
                   title="Description" hint="optional, Markdown" action={…} />
<LinksField value={LinkDraft[]} onChange keepOne urlPlaceholder="…" />
<CompletedTaskRow task onOpen onReopen={…} status={…} meta={…} showLink actions={…} />
<ClientListItem name color count active dimmed title onClick className="w-full" />
```

`DescriptionEditor` takes a state *setter* rather than a plain callback, because an
image dropped into it splices a ref in at the caret and that has to apply to the
text as it is at that moment, not as it was when the handler was bound.

**Deliberately left alone:** `ClientFormModal`'s colour swatches (a palette picker,
and the only one in the app); the mobile client dropdown itself, which is a
combobox rather than a list and belongs with `TagPicker` if it is ever generalized;
and `WorklogTaskRow`, which is the *open*-task row and already extracted.

---

## Step 6 — Split the large components ✅ done

The pieces step 5 pulled out are the ones two files *shared*. This step is the
opposite case: blocks that belong to one file and are only long. They move to
their own module and stay there rather than becoming shared components — which is
why each one lives in a folder beside its file rather than in
`src/ui/components/`, the way [`day-view/`](../src/ui/views/day-view/) already
did it. A barrel per folder, and nothing outside the owning file imports from it.

| File | Before | After | Split into |
| --- | --- | --- | --- |
| `TaskFormPage` | 440 | 264 | [`task-form/`](../src/ui/components/task-form/) — `TitleField`, `ClientChipPicker`, `DueField`, `FormActionBar`, `SidebarSection` |
| `RecurrencePicker` | 380 | 313 | [`model/recurrencePresets.ts`](../src/model/recurrencePresets.ts) |
| `TaskDetailPanel` | 367 | 99 | [`task-detail/`](../src/ui/components/task-detail/) — `TaskDetailHeader`, `TaskMetaRow`, `DueEditor`, `RepeatSummary`, `SubtaskList`, `NotesSection` |
| `Sidebar` | 355 | 63 | [`sidebar-nav/`](../src/ui/components/sidebar-nav/) — `NavList`, `SidebarActions`, `RepoFooter`, `MobileTopBar`, `SidebarContent`, `BrandMark` |
| `CalendarView` | 340 | 91 | [`calendar-view/`](../src/ui/views/calendar-view/) — `CalendarGrid`, `DayCell`, `Legend`, `PeriodNav`, `WorkedPerClient` |
| `ClientsView` | 293 | 121 | [`clients-view/`](../src/ui/views/clients-view/) — `ClientList`, `MobileClientDropdown`, `ClientInfoCard`, `CompletedTaskList` |
| `SearchOverlay` | 286 | 90 | [`search-overlay/`](../src/ui/components/search-overlay/) — `SearchField`, `ScopeFilterBar`, `TagFilterBar`, `SearchIdleState`, `SearchResultRow` |
| `InsightsView` | 212 | 155 | [`insights-view/`](../src/ui/views/insights-view/) — `HoursTable`, `StatTile` |

[`ArchiveView`](../src/ui/views/ArchiveView.tsx) was the template: a data hook at
the top, named pieces under it, and a body that reads as a list of what the view
is made of.

**Since:** the detail panel grew the same two-column layout as the form, so
`TaskMetaRow` — a one-line row of status / client / tags — became
[`TaskSidebar`](../src/ui/components/task-detail/TaskSidebar.tsx), the panel's
right-hand rail, and `DueEditor` / `RepeatSummary` became blocks in it. That gave
the two files a rail block in common, so `SidebarSection` left `task-form/` for
[`primitives/`](../src/ui/primitives/SidebarSection.tsx) — it knows nothing about
tasks, which is the test for belonging there.

**Props stop at the boundary the file already has.** A piece that needs the
snapshot reaches for `useData` / `useUi` itself rather than being handed ten
props — `ArchiveFilterBar` already did this for its client list. What stays a
prop is what the *parent* decided: which rows to show, what a click means, and
the handful of flags (`routed`, `isWeek`, `isTodo`) that are the parent's mode
rather than app state.

**`sidebar-nav`, not `sidebar`.** A folder named `sidebar/` next to `Sidebar.tsx`
resolves to the same specifier on a case-insensitive filesystem, and TypeScript
says so: *"declares 'MobileTopBar' locally, but it is exported as
'SidebarRepoProps'"*. Only the sidebar hit it — every other pair differs by a
hyphen (`search-overlay` vs `SearchOverlay`) or by name (`task-detail` vs
`TaskDetailPanel`).

**The two genuine duplications this uncovered.**

- The Insights monthly table was written **twice, verbatim** — clients and events
  — with the same `grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr]` string six times. It is
  one `HoursTable` now, and the column string is one `COLUMNS` constant used by
  the header, the rows and the total, so the three cannot drift out of alignment
  with each other. The two tables differ in exactly what they should: the first
  column's name, the total's label, and whether an empty month says so.
- `isEventWorklogClientId(id) ? EVENT_COLOR : colorOf(id)` appeared three times
  in `CalendarView` and the name resolver twice; both are one call now
  ([`entryLabels.ts`](../src/ui/views/calendar-view/entryLabels.ts)). Getting the
  event branch wrong shows a blank name in a cell, which is the kind of thing a
  third copy eventually gets wrong.

**`seedFor` stopped carrying a second copy of the grammar.** `kindOf` and
`seedFor` are calendar reasoning over a `Recurrence`, not rendering, so they moved
to `model/recurrencePresets.ts` — and `seedFor` now builds the rule as a
`Recurrence` and hands it to `formatRecurrence` instead of assembling
`` `weekly on ${weekday}` `` by hand. A seed is canonical by construction rather
than by two copies of the grammar agreeing with each other. `recurrence.ts` now
exports `BUSINESS_DAYS` and `isBusinessWeek`, which the picker had duplicated
along with its own `WEEKDAY_NAMES` table; all three are gone from the UI.
`test/recurrencePicker.test.ts` imports from the model now and is otherwise
untouched — the same eight tests, including the one asserting that every seed
round-trips back onto its own preset.

**Behavioural notes** — four things changed, all deliberately:

- **Insights' date links became buttons.** Every logged date in the monthly table
  was an `<a onClick>` with no `href`: it looked like a link, and no keyboard
  could reach it. They are `LinkButton size="inherit"`, which is the same blue,
  the same underline on hover, and the same inherited size.
- **Subtask titles became buttons**, the last `<span onClick>` of the four step 5
  fixed elsewhere. Its "mark done" circle also gained an `aria-label` — it had a
  `title` and no text, so it announced as an unnamed button.
- **`DueEditor` owns all three date states.** The panel had three sibling
  conditionals — due when open and not repeating, the repeat summary, completed
  when done — and the first and third are the same question: what is this task's
  one editable date? The component answers it and renders nothing for a repeating
  task, whose due date belongs to the rule.
- **`Sidebar`'s Escape effect stopped claiming to lock body scroll.** The comment
  said it did; the code never had. The comment now says what the effect does.

**Deliberately left alone:**

- `TaskFormPage` stays the largest of the eight at 264 lines, and most of what is
  left is its ten `useState`s and the effects that publish them. Splitting those
  out means either prop-drilling ten setters or putting the form's fields back in
  app-wide state, which is the thing the form was extracted *from*.
- `SearchResultRow` stays a `div` with an `onClick` where the completed-task rows
  became buttons: it contains its own controls — the tag chips, the external link
  — and a button cannot hold buttons. The palette's keyboard path is the shell's
  ↑/↓/↵ over the same ordered list, not Tab through the rows.
- The mobile client dropdown moved but stayed its own component rather than
  folding into `ClientList`. It is a combobox, as step 5 already noted; the two
  share `ClientListItem`, which is the part that was actually the same.
- `worklogStore.ts` and `useWorklogModel.ts` were left for
  [step 7](#step-7--split-the-data-layer-and-the-read-model--done): neither is a
  component, and both are long for reasons this step's rule doesn't address.

---

## Step 7 — Split the data layer and the read-model ✅ done

The two files the previous step left out. Both were the same shape of problem as
step 6 — long, not tangled — so both split the same way: the parts that are their
own concern move to their own module, and what stays behind is the sequencing.

| File | Before | After | Split into |
| --- | --- | --- | --- |
| `worklogStore.ts` | 894 | 589 | [`repoApi`](../src/data/repoApi.ts), [`fileSync`](../src/data/fileSync.ts), [`recovery`](../src/data/recovery.ts), [`assetUrls`](../src/data/assetUrls.ts), [`remoteWatcher`](../src/data/remoteWatcher.ts), [`bytes`](../src/data/bytes.ts) |
| `useWorklogModel.ts` | 694 | 115 | [`hooks/model/`](../src/ui/hooks/model/) — `useClientModel`, `useStatusModel`, `useTagModel`, `useTaskActions`, `useTaskRows`, `useTaskFormActions`, `useLogModel` |

**The store keeps the sequencing and nothing else.** What it does that no other
module can is decide *when* to fetch, merge, re-parse, notify and re-render —
`sync()` is that decision written out. Everything it sequences is now a module
with no reference back to it: `repoApi` is the three `/api/*` calls and their
shapes, `fileSync` is the merge/commit arithmetic over a `FileMap`, `recovery` is
the IndexedDB snapshot in both directions, `assetUrls` is the object-URL cache,
and `remoteWatcher` is the poll for commits pushed elsewhere. The split is by what
each part talks to — the network, the file map, IndexedDB, the DOM — which is also
what makes each one testable without a store.

`recovery` needs to delete from the map it is rebuilding, and `deleteFile` only
ever worked on the *mounted* map. It is now
[`removeFileFrom(fm, path)`](../src/workspace/paths.ts) with `deleteFile`
delegating to it, so the rule about what a delete means (a tree deletion for a
path the branch holds, a plain drop for one that only ever existed locally) still
lives in one place.

**The read-model became its composition.** `useWorklogModel` now unpacks the
snapshot, calls one hook per concern and spreads their results — the returned
object is key-for-key what it was, so no consumer changed. Each hook in
[`hooks/model/`](../src/ui/hooks/model/) takes exactly the slices it reads
(`useTagModel(tasks, ui)`, `useLogModel(worklog, clients, hoursPerDay, …)`), which
is what makes them worth having as separate files: the argument list *is* the
dependency list.

**The 18 warnings were two bugs, and both were real.**

- `const tasks = snap?.tasks ?? []` hands out a **fresh array on every render**
  whenever `snap` is null, so every `useMemo` and `useCallback` built on it
  re-ran every render — `allTags`, `clientById`, `makeRow` and with it every row
  in every list. The four collections are memoized on `snap` now, which is the
  fix the rule itself suggests.
- The `ui` object is rebuilt every render, so the callbacks that closed over it
  couldn't list it as a dependency without re-creating themselves every render.
  They depend on the pieces they actually use instead — `setTagFilter`,
  `setDetailId`, `confirm.ask` — every one of which is a `useState` setter or a
  `useCallback([])` and therefore stable. That's why the deps were omissible in
  the first place; now it's stated rather than assumed, and a value that *isn't*
  stable can no longer slip in unnoticed.

`npm run lint` reports 0 errors and 0 warnings.

**Deliberately left alone:** [`taskOps.ts`](../src/services/taskOps.ts) (605) is
now the largest file in the repo. It is the domain's write path and was never
part of this plan.

---

## Step 8 — Menu ✅ done

**Added:** [`Menu`](../src/ui/primitives/Menu.tsx), and its one app-aware
composer, [`StatusPicker`](../src/ui/components/StatusPicker.tsx).

**Why:** configurable task statuses made the old status control — a button that
cycled to the next one — unusable. Cycling is fine at three statuses and absurd
at six, and it can never reach the closing status at all. What was needed was a
list you pick from, and the project had no floating-panel primitive.

**Two decisions worth keeping:**

- The panel is **portalled to `<body>` and positioned `fixed`**, not absolutely
  inside the trigger. Every task list sits in a scrolling container, and an
  in-flow panel is clipped by it — the menu on the last visible row is exactly
  the one you cannot read. The cost is that the panel does not travel with its
  trigger, so a scroll or a resize closes it. `z-70` puts it above both `Modal`
  layers: a menu opened from inside a dialog is the topmost thing on screen.
- `StatusPicker` is **prop-driven, not context-reading**. It renders inside
  `WorklogTaskRow`, the one `React.memo` in the UI, and a `useData()` call there
  would re-render every row on every edit. The choices come down through
  `WorklogRow.status`, memoized once in `useStatusModel`.

`Menu` follows the ARIA menu pattern — `aria-haspopup="menu"` on the trigger,
`role="menu"` on the panel, `role="menuitemradio"` + `aria-checked` on the
options — with roving `tabIndex` so real focus moves with the arrow keys, rather
than `aria-activedescendant` bookkeeping. It owns Escape and stops it, so a menu
inside the task detail panel closes itself rather than the panel behind it.

---

## Step 9 — Menu grows a filter, and priority / parent stop being `<select>`s ✅ done

**Added:** [`PriorityPicker`](../src/ui/components/PriorityPicker.tsx),
[`ParentPicker`](../src/ui/components/ParentPicker.tsx) and the shared
[`PriorityChip`](../src/ui/components/PriorityChip.tsx) the task rows now render
from. **Changed:** `Menu` gained per-option `icon`s and an optional filter box.

**Why:** priority and parent were the last two native `<select>`s in the task
form, and in the detail panel priority was a `<select>` sitting directly under a
status you change by clicking it. Two idioms for the same act, one of which
cannot show a colour, an icon, or be typed into.

**Three decisions worth keeping:**

- **The chip is the control.** `PriorityPicker`'s trigger is the same pill the
  task lists draw, so a priority is read and set as one thing in both places.
  `PriorityChip.tsx` owns the palette that used to live inside `WorklogTaskRow`;
  `normal` is in that table but drawn only by the picker, since a grey "Normal"
  on every row would drown the three that mean something.
- **`Menu` has two keyboard models now.** A plain menu moves DOM focus onto the
  active option; a `searchable` one keeps focus in the input — you have to be
  able to keep typing — and points at the option with `aria-activedescendant`.
  The panel is a combobox in that mode, not a menu: `role="menu"` around a
  textbox is not a thing. `ParentPicker` turns it on past seven options.
- **The list scrolls, not the panel**, so the filter box stays put — which meant
  the outer `scroll` capture listener had to stop closing on events raised
  inside the panel, or a long list could not be scrolled at all.

Who may be a parent is now one rule in
[`taskTree.ts`](../src/ui/utils/taskTree.ts) — `parentCandidates` /
`canHaveParent` — rather than a filter inlined in the form, because the detail
rail asks the same question. `test/taskTree.test.ts` covers it.

---

## Checks to run after each step

```bash
npx tsc --noEmit    # type errors
npm run lint        # 0 errors and 0 warnings expected
npm test            # 228 tests
npm run build       # Tailwind only emits classes its @source scan finds —
                    # a primitive's classes must reach the built CSS
```

That last one matters more than it looks: styles built from variant maps are
still static strings, so Tailwind picks them up, but any class assembled by
string concatenation at runtime will not be emitted.
