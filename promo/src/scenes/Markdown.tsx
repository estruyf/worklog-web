import React from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile } from 'remotion';
import { Framed, Rect } from '../components/Framed';
import { Still } from '../components/Shot';
import { MONO, SANS, T } from '../theme';

/// The task block, out of the file the app was reading.
///
/// `scripts/assets.mjs` copies demo/clients/acme.md into public/, and this pulls
/// one `## ` block out of it. Nothing is retyped: the scene's claim is that the
/// card on the left and the text on the right are the same task, and a hand-kept
/// copy of the Markdown would stop being true the first time either side moved.
const TASK = 'Rebuild the reporting export';

function blockFor(source: string, title: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l === `## ${title}`);
  if (start < 0) {
    return [`## ${title}`, '(not found in acme.md)'];
  }
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## ')) {
    end++;
  }
  const block = lines.slice(start, end);
  while (block.length && block[block.length - 1].trim() === '') {
    block.pop();
  }
  return block;
}

/// Colour by what the line *is*, which for this format is decided by the first
/// two characters. It is not a Markdown highlighter and does not want to be —
/// the point is that a person can see the shape of the file, not that every
/// token is classified.
const Line: React.FC<{ text: string }> = ({ text }) => {
  if (text.startsWith('## ')) {
    return (
      <div style={{ color: T.brand, fontWeight: 700 }}>
        <span style={{ color: T.faint }}>## </span>
        {text.slice(3)}
      </div>
    );
  }
  if (text.startsWith('### ')) {
    return (
      <div style={{ color: T.text, fontWeight: 700 }}>
        <span style={{ color: T.faint }}>### </span>
        {text.slice(4)}
      </div>
    );
  }
  const meta = /^- ([a-zA-Z]+): (.*)$/.exec(text);
  if (meta) {
    return (
      <div>
        <span style={{ color: T.faint }}>- </span>
        <span style={{ color: T.lumen }}>{meta[1]}</span>
        <span style={{ color: T.faint }}>: </span>
        <span style={{ color: T.text }}>{meta[2]}</span>
      </div>
    );
  }
  const box = /^(\s*)- \[( |x)\] (.*)$/.exec(text);
  if (box) {
    return (
      <div>
        {box[1]}
        <span style={{ color: box[2] === 'x' ? T.northwind : T.faint }}>- [{box[2]}] </span>
        <span style={{ color: T.muted }}>{box[3]}</span>
      </div>
    );
  }
  return <div style={{ color: T.muted }}>{text || ' '}</div>;
};

export const MarkdownCard: React.FC<{ lines?: number }> = ({ lines: cap = 17 }) => {
  const [handle] = React.useState(() => delayRender('reading acme.md'));
  const [block, setBlock] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    fetch(staticFile('acme.md'))
      .then((r) => r.text())
      .then((text) => {
        setBlock(blockFor(text, TASK).slice(0, cap));
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle, cap]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 18,
        border: `1px solid ${T.line}`,
        backgroundColor: T.panel,
        boxShadow: '0 54px 120px rgba(0,0,0,0.72)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '16px 26px',
          borderBottom: `1px solid ${T.line}`,
          fontFamily: MONO,
          fontSize: 20,
          color: T.muted,
          letterSpacing: 0.2,
        }}
      >
        clients/<span style={{ color: T.brand }}>acme.md</span>
      </div>
      <div
        style={{
          flex: 1,
          padding: '22px 26px',
          fontFamily: MONO,
          fontSize: 19,
          lineHeight: 1.55,
          // Wrapped rather than clipped. Every metadata line fits; the two prose
          // lines of the description are the only ones long enough to run off the
          // card, and cut off mid-word they would read as the file being
          // truncated — which is the one thing this scene must not suggest.
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {(block ?? []).map((text, i) => (
          <Line key={i} text={text} />
        ))}
      </div>
      {/* The block goes on past what fits — prompts, notes. Fading the last line
          says so without a row of dots pretending to be part of the file. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 88,
          background: `linear-gradient(180deg, transparent, ${T.panel})`,
        }}
      />
    </div>
  );
};

/// The task as the app draws it, beside the lines it was parsed from.
///
/// This is the one scene with two pictures in the frame, and the only one that
/// does not use `Shot`: the argument is the pairing, so neither half can be the
/// subject and the layout is symmetrical rather than staged.
const CARD_TOP = 268;
const CARD_H = 636;
const LEFT = { x: 96, w: 858 };
const RIGHT = { x: 986, w: 838 };

/// The task's own part of the detail screen — the heading, the links, the
/// description, the subtask and the whole right-hand rail — with the nav outside
/// the crop. Its aspect matches the card it is mounted in, so nothing is lost at
/// an edge that the numbers do not already say is lost.
const TASK_RECT: Rect = { x: 478, y: 96, w: 2044, h: 1515 };

export const MarkdownScene: React.FC<{ caption: React.ReactNode }> = ({ caption }) => (
  <AbsoluteFill>
    {caption}
    <div
      style={{
        position: 'absolute',
        top: CARD_TOP,
        left: LEFT.x,
        width: LEFT.w,
        height: CARD_H,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: T.bright,
        boxShadow: '0 54px 120px rgba(0,0,0,0.72)',
      }}
    >
      <Framed rect={TASK_RECT} width={LEFT.w} height={CARD_H}>
        <Still name="task" />
      </Framed>
    </div>

    <div style={{ position: 'absolute', top: CARD_TOP, left: RIGHT.x, width: RIGHT.w, height: CARD_H }}>
      <MarkdownCard />
    </div>

    {/* The whole argument of the scene in one character, on the seam between the
        two cards rather than up in the caption. */}
    <div
      style={{
        position: 'absolute',
        top: CARD_TOP + CARD_H + 34,
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        fontFamily: SANS,
        fontSize: 23,
        color: T.faint,
      }}
    >
      <span>what you see</span>
      <span style={{ color: T.brand, fontWeight: 700, fontSize: 30 }}>=</span>
      <span>what is committed</span>
    </div>
  </AbsoluteFill>
);
