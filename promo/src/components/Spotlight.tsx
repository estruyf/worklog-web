import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { T } from '../theme';
import { Rect } from './Framed';

/// Points at one control by dimming everything else. The rect is in the
/// capture's own pixels — the numbers you would read off the file in Preview —
/// because the whole point is being able to measure once and trust it.
///
/// The dimming is a single enormous spread shadow rather than four panels around
/// the hole, so the lit area and the shadow can never drift apart by a pixel as
/// the card is scaled.
///
/// There is deliberately no label. Every row it can point at already carries its
/// own line of explanation, and the caption beside the card says the same thing
/// in the piece's words — a third copy would only cover the row below.
export const Spotlight: React.FC<{ rect: Rect; delay?: number }> = ({ rect, delay = 0 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: 16,
        border: `4px solid ${T.brandDeep}`,
        boxShadow: `0 0 0 9999px rgba(8,10,14,${0.6 * t})`,
        opacity: t,
        transform: `scale(${interpolate(t, [0, 1], [1.05, 1])})`,
      }}
    />
  );
};
