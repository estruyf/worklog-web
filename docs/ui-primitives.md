# UI primitives — migration plan

The UI grew without a controls layer: every button, input and card was written
inline at the call site, so the same control exists in several slightly different
versions. This document records the audit that found them, what has been fixed,
and what is left.

The ordering is deliberate. Each step is independently shippable and leaves the
app working, so none of this has to land in one go.

**Status:** steps 1–2 done. Steps 3–6 open.

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

`Field` also wires `aria-describedby` to its help and error lines, and owns the
"Clear" link that sits opposite a label on a filled date field — the pattern
`TaskFormPage` and `RecurrencePicker` each wrote out by hand.

**API:**

```tsx
<Field label="Due" hint="optional" action={<LinkButton/>} help={…} error={…}
       labelSize="xs|sm|md" />               // error also marks its control invalid
<Input size="xs|sm|md|lg" variant="default|accent" invalid
       leading={…} trailing={…} clearable onClear={…} />
<TextArea size="…" variant="…" resizable />
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

## Step 3 — Modal

**Why:** this is an accessibility gap, not only duplication.

Four dialogs repeat the backdrop + panel + shadow, at four different levels of
correctness:

| File | `role`/`aria-modal` | Own Esc handler | Focus trap |
| --- | --- | --- | --- |
| `ConfirmDialog` | yes | yes | no |
| `SearchOverlay` | no | shell-driven | no |
| `ClientFormModal` | no | shell-driven | no |
| `WebApp` (recovery) | no | no | no |

**Shape:** one `Modal` owning the backdrop, `role="dialog"`/`aria-modal`, the
labelled-by wiring, Escape, and a focus trap — with the panel width and the
`pt-[Xvh]` offset as props, since the four differ there legitimately.

Note that `ConfirmDialog` stops keydowns in the **capture** phase on purpose, so
nothing behind it reacts — in particular the task form's Esc, which would
otherwise navigate away underneath the question just asked. That behaviour has
to survive the extraction.

---

## Step 4 — Card / SectionLabel / EmptyState / Badge / Chip / SegmentedControl / Toggle / Pager

Purely mechanical, high volume:

| Control | Occurrences | Note |
| --- | --- | --- |
| `SectionLabel` (uppercase eyebrow) | 19 | identical string every time |
| `Card` (`border-neutral-375 rounded-[14px]`) | 15 | bg varies white / neutral-50 / brand-50 |
| `EmptyState` (`text-[14px] text-neutral-625 italic`) | 13 | |
| `Badge` (count pill) | 8 | tones: neutral, danger, brand |
| `Chip` | 3 families | selectable, filter, tag |
| `SegmentedControl` | 4 | two pairs are byte-identical to each other |
| `Pager` | 2 | `ArchiveView` and `TodoTasksSection` |
| `Toggle` | 1 | `SettingsView` only, still worth naming |

Two strong signals that these want to be components:

- [`GroupCard`](../src/ui/views/day-view/GroupCard.tsx) takes
  `cardClassName`, `headerClassName` and `countBadgeClassName` as **props** —
  it is a `Card` + `Badge` with a `tone`, written the long way.
- `chipClass` is already extracted in `RecurrencePicker` and then inlined
  identically in `TaskFormPage`; `TagChips` is already extracted in
  `WorklogTaskRow` and then re-implemented in `TaskDetailPanel` and
  `SearchOverlay`, hover states and all.

**Do the design tokens here too.** The primitives currently centralise magic
numbers (`rounded-[7px]`, `text-[13.5px]`, `py-[9px]`) rather than retire them.
Promoting them to named scales in the `@theme` block of
[`styles.css`](../src/ui/styles.css) belongs with this step — otherwise the
values just moved house.

**Icons, while here.** [`icons.tsx`](../src/ui/components/icons.tsx) already
exists with 12 paths, and `lucide-react` is already a dependency — yet `Icon` is
used in exactly two places. Raw inline `<svg>` is duplicated for the
external-link glyph in 5 files, the checkmark in 4, and the search glyph in 2.
[`Sidebar`](../src/ui/components/Sidebar.tsx) carries 76 lines of inline nav SVG
that belongs in `icons.tsx`.

---

## Step 5 — Shared app components

Now that primitives exist, the genuine feature duplication is worth extracting.

**`DescriptionEditor` — the highest-value extraction in the codebase.**
`TaskFormPage` and `TaskDetailPanel` both implement "markdown editor with
write/preview toggle, hidden file input, `useMarkdownImages` wiring, identical
placeholder string, click-to-edit empty state, error line" — with divergent
toggle UI and divergent styling. One component, two skins at most.

**`LinksField`** — the URL repeater in `TaskFormPage` vs `ClientFormModal`.
Note they differ in shape (`string[]` vs `{url, label}[]`), so the extraction
should settle on the richer one.

**`CompletedTaskRow`** — the strikethrough title + status + date + link row
exists four times: `ClientsView`, `ArchiveView`, `DoneTasksSection`,
`TodosView`.

**`ClientListItem`** — `ClientsView` copy-pastes its client row four times
(desktop active/archived × mobile active/archived). One component with a
`dimmed` flag collapses all four.

---

## Step 6 — Split the large components

Only worth doing after steps 1–5, since much of the bulk is inline styling that
those steps remove.

| File | Lines | Split into |
| --- | --- | --- |
| `TaskFormPage` | ~500 | `TitleField`, `DescriptionEditor`, `ClientChipPicker`, `DueField`, `LinksField`, `FormActionBar` |
| `Sidebar` | ~420 | nav glyphs → `icons.tsx`, then `NavList`, `SidebarActions`, `RepoFooter` (exists), `MobileTopBar` |
| `TaskDetailPanel` | ~400 | `TaskDetailHeader`, `TaskMetaRow`, `SubtaskList`, `NotesSection`, `DueEditor` |
| `RecurrencePicker` | ~395 | move `kindOf`, `seedFor`, `isBusinessWeek` + constants (~90 lines of pure model code) next to `model/recurrence.ts` |
| `CalendarView` | ~338 | `CalendarGrid`, `DayCell`, `Legend`, `PeriodNav`, `WorkedPerClient` |
| `ClientsView` | ~330 | `ClientList`, `ClientInfoCard`, `CompletedTaskList` |
| `SearchOverlay` | ~317 | `SearchField`, `ScopeFilterBar`, `TagFilterBar`, `SearchResultRow` |
| `InsightsView` | ~211 | `HoursTable` — the monthly table is written **twice, verbatim**, for clients and events, with the same `grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr]` string 6× (~70 lines saved); plus `StatTile` |

[`ArchiveView`](../src/ui/views/ArchiveView.tsx) is the best-decomposed file in
the repo and is the template for the rest.

`RepeatSummary` (in `TaskDetailPanel`) and `SidebarSection` (in `TaskFormPage`)
are already extracted locally — the right pattern, currently applied to a small
fraction of each file.

---

## Out of scope, but noted

[`worklogStore.ts`](../src/data/worklogStore.ts) (~894 lines) and
[`useWorklogModel.ts`](../src/ui/hooks/useWorklogModel.ts) (~690) are the two
largest files in the repo and are past the point where splitting by concern
(tasks / worklog / clients / sync) would help. Unrelated to the UI work above.

`useWorklogModel.ts` also carries all 18 of the repo's current lint warnings
(`react-hooks/exhaustive-deps`).

---

## Checks to run after each step

```bash
npx tsc --noEmit    # type errors
npm run lint        # 0 errors expected; 18 pre-existing warnings in useWorklogModel.ts
npm test            # 228 tests
npm run build       # Tailwind only emits classes its @source scan finds —
                    # a primitive's classes must reach the built CSS
```

That last one matters more than it looks: styles built from variant maps are
still static strings, so Tailwind picks them up, but any class assembled by
string concatenation at runtime will not be emitted.
