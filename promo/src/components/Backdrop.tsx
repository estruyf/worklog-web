import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { DURATION, T } from '../theme';

/// The ground the whole piece sits on. It never cuts — scenes dissolve over it —
/// so the gold drifting across the runtime is the only thing that says the frame
/// is still alive during a long hold.
///
/// The two glows are the same pair the landing page puts behind its hero, at the
/// same corners, inverted onto ink.
export const Backdrop: React.FC<{ total?: number }> = ({ total = DURATION }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, total], [0, 1]);
  const glowX = interpolate(drift, [0, 1], [74, 62]);

  return (
    <AbsoluteFill style={{ backgroundColor: T.ground }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1150px 640px at ${glowX}% -10%, rgba(244,207,77,0.17), transparent 66%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(950px 620px at ${100 - glowX}% 108%, rgba(244,207,77,0.07), transparent 64%)`,
        }}
      />
      {/* Pulls the corners down so a white window never reads as continuous with
          the frame edge. */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(1500px 900px at 50% 46%, transparent 38%, rgba(0,0,0,0.5) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/// A hairline filling across the bottom edge over the full runtime. It is the
/// only element that never dissolves, so it doubles as a progress bar and as the
/// one piece of gold that is always on screen.
export const Progress: React.FC<{ total?: number }> = ({ total = DURATION }) => {
  const frame = useCurrentFrame();
  const pct = interpolate(frame, [0, total - 1], [0, 100], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: T.brand,
          boxShadow: `0 0 14px ${T.brand}`,
        }}
      />
    </div>
  );
};
