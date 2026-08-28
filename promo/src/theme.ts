// The piece borrows the app's palette rather than inventing one — the gold is
// `--brand` from src/pages/index.astro, the blue/green/purple are the demo
// clients' own accent colours out of demo/.worklog/config.json.
//
// The ground is the one thing that is not the app's: Worklog is light, and a
// white window on a near-white backdrop has nothing to sit on. Dropping the
// ground to ink makes the window the brightest thing in the frame, which is the
// same trick the app's own cards play against their page, one step further.
export const T = {
  ground: '#101319',
  panel: '#181c24',
  line: '#2b313d',
  bright: '#ffffff',
  text: '#e7e9ee',
  muted: '#9aa3b2',
  faint: '#6b7480',
  brand: '#f4cf4d',
  brandDeep: '#e2be2e',
  /// The demo clients, for the few places the piece names one.
  acme: '#4C8BF5',
  northwind: '#16A34A',
  lumen: '#A371F7',
} as const;

export const SANS =
  'Inter, -apple-system, "SF Pro Display", "SF Pro Text", system-ui, "Segoe UI", sans-serif';
export const MONO = '"SF Mono", ui-monospace, Menlo, "JetBrains Mono", "Roboto Mono", monospace';

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
export const DURATION = 900; // the short promo, 30 seconds
export const TOUR_DURATION = 2700; // the tour, 90 seconds

/// Scenes overlap by this much and cross-dissolve through it.
export const XFADE = 12;

/// What the capture is, in its own pixels: a 1280x820 window at 2x. Every crop
/// in Promo.tsx and Tour.tsx is written in these numbers — the ones you would
/// read off a file in Preview — and `Framed` works out the scale.
export const SOURCE = { width: 2560, height: 1640 } as const;

/// The two stages a shot can be mounted on.
///
/// `wide` is for the whole window, which is half again as wide as it is tall,
/// and for the crops that are wider still — a status picker over a list, a
/// settings pane cropped to the part that is written on. The caption goes above
/// and the picture gets the width of the frame, which at a full window puts the
/// app's own 14px text just under 1:1 and at those crops well over it.
///
/// `side` puts the caption in a column on the left and gives the picture nearly
/// the height of the frame. It is for the shapes that are taller than they are
/// wide, and since the task lists became tables that is most of them: a list now
/// runs to the bottom of the window, so the only crop edge below it that isn't
/// slicing a row in half is the window's own. A full-height crop is therefore
/// the norm, and this is as large as one can be drawn — 990 of 1080, leaving the
/// picture a margin rather than a stage.
export const STAGE = {
  wide: { top: 258, maxW: 1560, maxH: 772, left: null },
  side: { top: 45, maxW: 1220, maxH: 990, left: 686 },
} as const;

/// The caption block is bottom-aligned to this line on the `wide` stage, so a
/// headline that wraps to two lines grows upwards and the gap above the card
/// never changes.
export const CAPTION_BASELINE = 222;

/// The left-hand caption column of the `side` stage.
export const COLUMN = { left: 92, width: 540 };

/// A file in `public/` to play under the whole thing, or `null` for silence.
/// Both cuts are made to read without sound — every claim either of them makes
/// is on screen in the same shot — so a track is a choice rather than something
/// the piece leans on. It fades out over the last second either way.
export const MUSIC: string | null = null;
