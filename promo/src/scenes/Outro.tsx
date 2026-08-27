import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { SANS, T } from '../theme';

const ease = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const line = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 18], [0, 1], ease),
    transform: `translateY(${interpolate(frame, [delay, delay + 18], [16, 0], ease)}px)`,
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', fontFamily: SANS, textAlign: 'center' }}
    >
      <div style={{ ...line(0), display: 'flex', alignItems: 'center', gap: 22 }}>
        <Img src={staticFile('icon.png')} style={{ width: 84, height: 84, borderRadius: 19 }} />
        <span style={{ fontSize: 66, fontWeight: 700, letterSpacing: -1.8, color: T.bright }}>
          Worklog
        </span>
      </div>

      <div style={{ ...line(8), marginTop: 30, fontSize: 42, fontWeight: 600, color: T.bright }}>
        Free, open source, and your data never leaves your repo.
      </div>

      {/* The URL is the one thing anyone needs to take away, so it gets the app's
          own card treatment and the gold border rather than another line of copy. */}
      <div
        style={{
          ...line(16),
          marginTop: 44,
          padding: '22px 44px',
          borderRadius: 14,
          backgroundColor: T.panel,
          border: `1px solid ${T.line}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          fontSize: 34,
          fontWeight: 600,
          color: T.bright,
        }}
      >
        worklog<span style={{ color: T.brand }}>.struyfconsulting.be</span>
      </div>

      <div style={{ ...line(24), marginTop: 26, fontSize: 24, color: T.muted }}>
        Sign in with GitHub, pick the repo that holds your timesheet, and start.
      </div>

      <div style={{ ...line(32), marginTop: 40, fontSize: 21, color: T.faint }}>
        No database &middot; no account to create &middot; works offline &middot; installs as an app
      </div>
    </AbsoluteFill>
  );
};
