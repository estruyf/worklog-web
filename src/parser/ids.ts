// Task id generation. Ids are explicit and stable — `t_` + a short, URL-safe,
// collision-resistant token. Uses the Web Crypto API (available in browsers and
// the Cloudflare Workers runtime) and the `t_<6 base36>` shape.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Generate a stable task id, e.g. `t_a1b2c3`.
 * @param size number of random chars after the `t_` prefix (default 6).
 */
export function newTaskId(size = 6): string {
  return 't_' + randomToken(size);
}

function randomToken(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < size; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
