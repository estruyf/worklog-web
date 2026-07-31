// The base64 codec for image assets.
//
// `bytesToBase64` encodes in 32k chunks rather than a byte at a time, because it
// runs on every debounced persist for every unsynced image. Chunking is also the
// classic place to introduce an off-by-one, and a corrupted asset would only show
// up as a broken image some time after the commit — so the boundaries get a test.

import { describe, it, expect } from 'vitest';
import { base64ToBytes, bytesToBase64 } from '../src/data/bytes';

/** Deterministic, non-repeating bytes so a misplaced boundary can't go unnoticed. */
function pattern(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = (i * 31 + (i >> 8)) & 0xff;
  }
  return bytes;
}

// 0x8000 is the chunk size; the sizes either side of it are the ones at risk.
const SIZES = [0, 1, 2, 3, 0x7fff, 0x8000, 0x8001, 0x10000, 0x10001, 1_000_003];

describe('bytesToBase64 / base64ToBytes', () => {
  it('round-trips across every chunk boundary', () => {
    for (const size of SIZES) {
      const bytes = pattern(size);
      const round = base64ToBytes(bytesToBase64(bytes));
      expect(round.length, `length for ${size}`).toBe(size);
      expect(Buffer.from(round).equals(Buffer.from(bytes)), `contents for ${size}`).toBe(true);
    }
  });

  it('agrees with a reference base64 implementation', () => {
    for (const size of SIZES) {
      const bytes = pattern(size);
      expect(bytesToBase64(bytes), `encoding for ${size}`).toBe(Buffer.from(bytes).toString('base64'));
    }
  });

  it('covers the full byte range, not just ASCII', () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect(Buffer.from(base64ToBytes(bytesToBase64(bytes))).equals(Buffer.from(bytes))).toBe(true);
  });
});
