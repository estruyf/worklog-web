import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from 'remotion';
import { Backdrop, Progress } from './components/Backdrop';
import { Caption } from './components/Caption';
import { Rect, WINDOW } from './components/Framed';
import { Clip, creep, Shot, Still } from './components/Shot';
import { Scene } from './components/Scene';
import { MarkdownScene } from './scenes/Markdown';
import { Outro } from './scenes/Outro';
import { Title } from './scenes/Title';
import { DURATION, FPS, MUSIC, XFADE } from './theme';

// Thirty seconds, and one argument: your timesheet is Markdown in your own repo,
// and this is the thing that edits it.
//
// Five beats — what a day looks like, filling one in, what that actually wrote,
// the commit, and where to get it. Everything on screen is the real app driven
// against ../demo; see scripts/capture.mjs and the README.
//
// Scene lengths include the cross-dissolve into the next one, which is why each
// `from` sits XFADE frames before the previous scene ends.
const S = {
  title: { from: 0, duration: 84 + XFADE },
  day: { from: 84, duration: 110 + XFADE },
  log: { from: 194, duration: 340 + XFADE },
  markdown: { from: 534, duration: 146 + XFADE },
  sync: { from: 680, duration: 124 + XFADE },
  outro: { from: 804, duration: 96 },
};

// Crops, in the capture's own 2560x1640. Read off the files in public/shots and
// public/clips. Every edge either falls inside the app — which reads as a zoom —
// or is the window's own edge; an edge that slices a border in half is the one
// thing that reads as a mistake.

/// The day column, floor to ceiling.
///
/// It used to crop to the day card alone, at half again the size. That worked
/// while the form was open and fell apart the moment it closed: the card shrinks
/// back, the open-task table slides up into the frame, and the crop's bottom
/// edge lands somewhere in the middle of a row. There is exactly one gap below
/// the card in the payoff state, 23px of it, and the form is 190px taller than
/// that — so no single crop frames both halves of this beat. The window's own
/// bottom edge is the one that is clean in both. 1.17x.
const MAIN_COL: Rect = { x: 480, y: 0, w: 2080, h: 1640 };

/// The whole window. It shares its aspect with `MAIN` below, so cutting between
/// the two is a push rather than a reframe.
const DESK: Rect = WINDOW;

export const Promo: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />

    {MUSIC ? (
      <Audio
        src={staticFile(MUSIC)}
        volume={(f) =>
          interpolate(f, [0, FPS, DURATION - FPS, DURATION], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
    ) : null}

    <Sequence from={S.title.from} durationInFrames={S.title.duration}>
      <Scene duration={S.title.duration}>
        <Title />
      </Scene>
    </Sequence>

    {/* The whole app once, so the beats that follow have somewhere to be. */}
    <Sequence from={S.day.from} durationInFrames={S.day.duration}>
      <Scene duration={S.day.duration}>
        <Shot
          stage="wide"
          rectAt={() => DESK}
          scaleAt={creep(1, 1.018, S.day.duration)}
          aside={
            <Caption
              kicker="Your day"
              headline="One day, one bar: what you logged, and what is still missing."
              note="Overdue at the top, the to-dos beside it, and the hours drawn at the size they actually were."
            />
          }
        >
          <Still name="day" />
        </Shot>
      </Scene>
    </Sequence>

    {/* On the side stage, cropped to the card: this is the beat you are actually
        asked to read, and the caption can afford a column when the picture is
        nearly square. */}
    <Sequence from={S.log.from} durationInFrames={S.log.duration}>
      <Scene duration={S.log.duration}>
        <Shot
          stage="side"
          rectAt={() => MAIN_COL}
          aside={
            <>
              <Sequence durationInFrames={246} layout="none">
                <Caption
                  where="side"
                  kicker="Two hours left"
                  headline="Click the gap and it is already filled in."
                  note="The client, the hours that were missing, the note — the form opens on the answer rather than on an empty box."
                  outAt={232}
                />
              </Sequence>
              <Sequence from={244} durationInFrames={S.log.duration - 244} layout="none">
                <Caption
                  where="side"
                  kicker="Logged"
                  headline="The day closes at eight of eight."
                  note="No timer to remember to start, and no stopwatch running in a tab you forgot about."
                />
              </Sequence>
            </>
          }
        >
          {/* No `play`: the whole recording, at nine tenths of the speed it was
              driven at. The scene is as long as that takes plus a hold at each
              end — a beat that cuts before its own payoff is worse than a slow
              one, and the length of the recording is in public/clips.json rather
              than repeated here. */}
          <Clip name="logTime" beat={{ holdIn: 26, rate: 0.85, total: S.log.duration }} />
        </Shot>
      </Scene>
    </Sequence>

    {/* The claim the app is actually built on, and the only scene that shows a
        thing the app is not drawing. */}
    <Sequence from={S.markdown.from} durationInFrames={S.markdown.duration}>
      <Scene duration={S.markdown.duration}>
        <MarkdownScene
          caption={
            <Caption
              kicker="Markdown, all the way down"
              headline="Every edit is a line in a file you own."
              note="No database, no export button. Read it in your editor, grep it, or edit it by hand — the app parses it back."
            />
          }
        />
      </Scene>
    </Sequence>

    <Sequence from={S.sync.from} durationInFrames={S.sync.duration}>
      <Scene duration={S.sync.duration}>
        <Shot
          stage="wide"
          rectAt={() => DESK}
          aside={
            <Caption
              kicker="Synced"
              headline="Committed straight to your repo."
              note="chore: worklog sync — no pull request, no service in the middle, nothing to trust but GitHub."
            />
          }
        >
          {/* Only the second half of that recording: the first is the edit being
              made, which the scene before has already shown. It starts on the
              frame the sync button is pressed. */}
          <Clip name="sync" beat={{ holdIn: 8, from: 95, play: 107, rate: 1, total: S.sync.duration }} />
        </Shot>
      </Scene>
    </Sequence>

    <Sequence from={S.outro.from} durationInFrames={S.outro.duration}>
      <Scene duration={S.outro.duration}>
        <Outro />
      </Scene>
    </Sequence>

    <Progress />
  </AbsoluteFill>
);
