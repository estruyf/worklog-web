import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from 'remotion';
import { Backdrop, Progress } from './components/Backdrop';
import { Caption } from './components/Caption';
import { Rect, WINDOW } from './components/Framed';
import { Scene } from './components/Scene';
import { Clip, creep, Shot, Still } from './components/Shot';
import { Spotlight } from './components/Spotlight';
import { MarkdownScene } from './scenes/Markdown';
import { Outro } from './scenes/Outro';
import { Title } from './scenes/Title';
import { FPS, MUSIC, TOUR_DURATION, XFADE } from './theme';

// Ninety seconds, and every screen in the app.
//
// Two kinds of picture are cut together. The screens that hold still are stills
// out of public/shots; the four beats where something has to *happen* — time
// logged, a task written, a task closed, a commit — are recordings out of
// public/clips, cut hold-play-hold the same way the short promo cuts them.
//
// `scripts/capture.mjs` took both, and it is repeatable: `npm run capture`
// against a local build replaces every frame below in one pass.
//
// Scene lengths include the dissolve into the next one, so each `from` sits
// XFADE frames before the previous scene's end.
const XF = XFADE;

const S = {
  title: { from: 0, duration: 88 + XF },
  day: { from: 88, duration: 130 + XF },
  log: { from: 218, duration: 340 + XF },
  overdue: { from: 558, duration: 108 + XF },
  upcoming: { from: 666, duration: 108 + XF },
  todos: { from: 774, duration: 108 + XF },
  calendar: { from: 882, duration: 118 + XF },
  clients: { from: 1000, duration: 118 + XF },
  task: { from: 1118, duration: 150 + XF },
  newTask: { from: 1268, duration: 300 + XF },
  close: { from: 1568, duration: 150 + XF },
  archive: { from: 1718, duration: 104 + XF },
  insights: { from: 1822, duration: 128 + XF },
  search: { from: 1950, duration: 114 + XF },
  statuses: { from: 2064, duration: 130 + XF },
  sync: { from: 2194, duration: 128 + XF },
  markdown: { from: 2322, duration: 134 + XF },
  mobile: { from: 2456, duration: 114 + XF },
  outro: { from: 2570, duration: 130 },
};

// ---- crops, in the capture's own 2560x1640 -------------------------------
//
// Read off the files in public/shots. Every edge either falls inside the app —
// which reads as a zoom — or is the window's own; an edge that slices a border
// or a row in half is the one thing that reads as a mistake.

/// The main column with the sidebar dropped: the default for a view whose
/// caption is about what is *in* a list rather than about the app having lists.
/// The task form and the log beat use it too — in the form's case because the
/// Add task button at the bottom has to be in frame, since the beat ends with it
/// being pressed.
///
/// Floor to ceiling. Since the lists became tables they run to the bottom of the
/// window, so there is no gap between cards left to end a crop in; the only
/// clean bottom edge is the window's own. That makes it taller than it is wide,
/// which is why every view using it sits on the side stage. 1.17x.
const MAIN_COL: Rect = { x: 480, y: 0, w: 2080, h: 1640 };

/// The to-do list is the one that does not fill the window — five rows and a
/// completed fold. Below its last card the page is empty, and putting that on
/// screen is putting nothing on screen, so this stops in the white space and
/// goes on the wide stage at 1.43x instead.
const TODO_LIST: Rect = { x: 480, y: 0, w: 2080, h: 1090 };

/// The overdue block with the status picker open over it. Wide and short, which
/// is the one shape the wide stage flatters — 2.36x, and every status in the
/// list is readable.
const STATUS_MENU: Rect = { x: 496, y: 172, w: 1320, h: 648 };

/// The status list in Settings, from its heading to the Add status button.
const STATUS_LIST: Rect = { x: 480, y: 850, w: 2040, h: 790 };

/// The search overlay sits over a dimmed page, so this one keeps the whole
/// window: cropping to the panel would lose the fact that it is an overlay.
const DESK: Rect = WINDOW;

/// The one control the tour points at: the closing status, the only row in that
/// list that cannot be removed or reordered.
const CLOSING_ROW: Rect = { x: 500, y: 1455, w: 2010, h: 105 };

export const Tour: React.FC = () => (
  <AbsoluteFill>
    <Backdrop total={TOUR_DURATION} />

    {MUSIC ? (
      <Audio
        src={staticFile(MUSIC)}
        volume={(f) =>
          interpolate(f, [0, FPS, TOUR_DURATION - FPS, TOUR_DURATION], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
    ) : null}

    <Sequence from={S.title.from} durationInFrames={S.title.duration}>
      <Scene duration={S.title.duration}>
        <Title
          tagline="A closer look"
          note="Every screen, from the day view to the commit it writes"
        />
      </Scene>
    </Sequence>

    <Sequence from={S.day.from} durationInFrames={S.day.duration}>
      <Scene duration={S.day.duration}>
        <Shot
          stage="wide"
          scaleAt={creep(1, 1.018, S.day.duration)}
          aside={
            <Caption
              kicker="Day"
              headline="The view it opens on."
              note="What has slipped, what is due, the hours you have logged drawn at the size they were, and the to-dos beside them."
            />
          }
        >
          <Still name="day" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.log.from} durationInFrames={S.log.duration}>
      <Scene duration={S.log.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <>
              <Sequence durationInFrames={244} layout="none">
                <Caption
                  where="side"
                  kicker="Logging time"
                  headline="The gap in the bar is the form."
                  note="Click it and the client and the hours that were missing are already filled in; a full day, a half day or a number you type."
                  outAt={230}
                />
              </Sequence>
              <Sequence from={242} durationInFrames={S.log.duration - 242} layout="none">
                <Caption
                  where="side"
                  kicker="Logging time"
                  headline="Eight of eight, and a line in this month's ledger."
                  note="worklog/2026-08.md gains “- 2026-08-27 lumen 2 — Onboarding motion review”. That is the whole record."
                />
              </Sequence>
            </>
          }
        >
          <Clip name="logTime" beat={{ holdIn: 26, rate: 0.85, total: S.log.duration }} />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.overdue.from} durationInFrames={S.overdue.duration}>
      <Scene duration={S.overdue.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <Caption
              where="side"
              kicker="Overdue"
              headline="Everything that has slipped, in one place."
              note="Grouped by client, longest overdue first, across every client and the to-do list. The nav badge is this number."
            />
          }
        >
          <Still name="overdue" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.upcoming.from} durationInFrames={S.upcoming.duration}>
      <Scene duration={S.upcoming.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <Caption
              where="side"
              kicker="Upcoming"
              headline="And everything that has not arrived yet."
              note="Tomorrow, later this week, next week, later this month. Between this and Overdue, every dated task has a home."
            />
          }
        >
          <Still name="upcoming" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.todos.from} durationInFrames={S.todos.duration}>
      <Scene duration={S.todos.duration}>
        <Shot
          stage="wide"
          rectAt={() => TODO_LIST}
          aside={
            <Caption
              kicker="To-dos"
              headline="The list that belongs to no client."
              note="Including the ones that come back — weekly on Mondays and Thursdays, monthly on the last, every 30 days. Tick one off and the next date is worked out on the spot."
            />
          }
        >
          <Still name="todos" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.calendar.from} durationInFrames={S.calendar.duration}>
      <Scene duration={S.calendar.duration}>
        <Shot
          stage="wide"
          scaleAt={creep(1, 1.02, S.calendar.duration)}
          aside={
            <Caption
              kicker="Calendar"
              headline="A month of logged time, at a glance."
              note="Every client on its own colour, holidays and vacation alongside them, and a click on any day goes there."
            />
          }
        >
          <Still name="calendar" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.clients.from} durationInFrames={S.clients.duration}>
      <Scene duration={S.clients.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <Caption
              where="side"
              kicker="Clients"
              headline="Each one with its own tasks, colour and notes."
              note="The rate you agreed, who to invoice, the board and the repo — kept beside the work rather than in another tab."
            />
          }
        >
          <Still name="clients" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.task.from} durationInFrames={S.task.duration}>
      <Scene duration={S.task.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <Caption
              where="side"
              kicker="A task"
              headline="Description, subtasks, prompts, notes, links."
              note="Status, priority, a due date and tags down the side. Prompts are the ones you parked to hand to an agent later."
            />
          }
        >
          <Still name="task" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.newTask.from} durationInFrames={S.newTask.duration}>
      <Scene duration={S.newTask.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <Caption
              where="side"
              kicker="Writing one down"
              headline="Title, client, priority — and it is on the branch."
              note="Or ⇧N from anywhere, or a link from the browser extension, or the share sheet on a phone. Getting it written is the part that has to be quick."
            />
          }
        >
          {/* The one beat played at the speed it was driven at. It is mostly
              typing, and typing slowed down reads as hesitation. */}
          <Clip name="newTask" beat={{ holdIn: 14, rate: 1, total: S.newTask.duration }} />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.close.from} durationInFrames={S.close.duration}>
      <Scene duration={S.close.duration}>
        <Shot
          stage="wide"
          rectAt={() => STATUS_MENU}
          aside={
            <Caption
              kicker="Closing one"
              headline="The last status archives it."
              note="The block moves out of clients/ and into archive/<client>/<month>.md, taking any still-open subtasks with it. Nothing is deleted."
            />
          }
        >
          <Clip name="closeTask" beat={{ holdIn: 20, rate: 0.75, total: S.close.duration }} />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.archive.from} durationInFrames={S.archive.duration}>
      <Scene duration={S.archive.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <Caption
              where="side"
              kicker="Archive"
              headline="Closed work, by client and month."
              note="Reopen one and it moves back to the client file it came from."
            />
          }
        >
          <Still name="archive" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.insights.from} durationInFrames={S.insights.duration}>
      <Scene duration={S.insights.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <Caption
              where="side"
              kicker="Insights"
              headline="Hours and days per client, and the dates behind them."
              note="Vacation, holidays and sick days counted separately. The dates copy out as a line for the invoice."
            />
          }
        >
          <Still name="insights" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.search.from} durationInFrames={S.search.duration}>
      <Scene duration={S.search.duration}>
        <Shot
          stage="wide"
          rectAt={() => DESK}
          scaleAt={creep(1, 1.02, S.search.duration)}
          aside={
            <Caption
              kicker="Search"
              headline="⌘F, and everything you have ever written."
              note="Open and archived tasks, day notes, tags. Filter by tag or client without typing a word."
            />
          }
        >
          <Still name="search" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.statuses.from} durationInFrames={S.statuses.duration}>
      <Scene duration={S.statuses.duration}>
        <Shot
          stage="wide"
          rectAt={() => STATUS_LIST}
          overlay={<Spotlight rect={CLOSING_ROW} delay={78} />}
          aside={
            <Caption
              kicker="Statuses"
              headline="The workflow is yours to design."
              note="Add, rename, recolour and reorder them — “Waiting for” and “In review” are in this repo because it put them there. Only the closing one is fixed, because exactly one status has to mean done."
            />
          }
        >
          <Still name="statuses" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.sync.from} durationInFrames={S.sync.duration}>
      <Scene duration={S.sync.duration}>
        <Shot
          stage="wide"
          rectAt={() => DESK}
          aside={
            <Caption
              kicker="Git sync"
              headline="Nothing leaves the browser until it is a commit."
              note="Edits land in an in-memory copy of your Markdown first, then go up as “chore: worklog sync” — automatically after a minute, or the moment you press this."
            />
          }
        >
          {/* From the frame the button is pressed: the edit that made something
              to push is the beat before this one. */}
          <Clip name="sync" beat={{ holdIn: 10, from: 95, play: 107, rate: 1, total: S.sync.duration }} />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.markdown.from} durationInFrames={S.markdown.duration}>
      <Scene duration={S.markdown.duration}>
        <MarkdownScene
          caption={
            <Caption
              kicker="Underneath"
              headline="All of it is Markdown in your repository."
              note="Tasks in clients/, closed ones in archive/, hours in worklog/. Edit a file by hand and the app reads it back."
            />
          }
        />
      </Scene>
    </Sequence>

    <Sequence from={S.mobile.from} durationInFrames={S.mobile.duration}>
      <Scene duration={S.mobile.duration}>
        <Shot
          stage="side"
          of="mobile"
          scaleAt={creep(1, 1.02, S.mobile.duration)}
          aside={
            <Caption
              where="side"
              kicker="And on a phone"
              headline="The same repo, installed as an app."
              note="Add it to the home screen and it opens on the timesheet you had open last. It works with no network — edits queue up and merge record by record when there is one."
            />
          }
        >
          <Still name="mobile" />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.outro.from} durationInFrames={S.outro.duration}>
      <Scene duration={S.outro.duration}>
        <Outro />
      </Scene>
    </Sequence>

    <Progress total={TOUR_DURATION} />
  </AbsoluteFill>
);
