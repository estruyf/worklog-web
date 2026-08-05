// Claiming (and releasing) `web+worklog:` for this app, so a task can be handed
// over by anything that opens a URL scheme rather than a browser tab. Owned by the
// settings view, which is the only caller: both calls need a user gesture, and a
// permission prompt nobody asked for is worse than no feature.
//
// The parse side is ./deeplink — this module only registers; it never reads an
// inbound link.
//
// Nothing here can report the *state* of the registration. There is no API to ask
// whether we are the handler: `registerProtocolHandler` returns before the user has
// answered the browser's own prompt, and the user can change the answer later in
// browser settings without telling the page. So this reports what was asked, the UI
// says so, and neither pretends to know more than that.

import { DEEPLINK_HANDLER_URL, DEEPLINK_SCHEME } from './deeplink';

/** Not in lib.dom: `unregisterProtocolHandler` is specced but unevenly shipped
 *  (Firefox has it; Chromium doesn't), which is exactly why every call site
 *  feature-detects rather than trusting a type. */
type UnregisteringNavigator = Navigator & {
  unregisterProtocolHandler?: (scheme: string, url: string) => void;
};

/** What asking achieved.
 *
 *  `asked` rather than "registered": the browser answers with a prompt of its own
 *  (an omnibox chip, a notification bar) and tells us nothing about what was picked.
 *  `unsupported` is the browser refusing to take the question at all — Safari has
 *  neither call, and no Chromium has the second one. `refused` is the call throwing:
 *  a non-secure context, a cross-origin handler URL, a scheme off the safelist. */
export type ProtocolHandlerResult = 'asked' | 'unsupported' | 'refused';

/** True when this browser can be asked to *release* the scheme. The register side
 *  is safe to offer everywhere (it degrades to `unsupported`), but an Unregister
 *  button that can only ever say "your browser can't" is worth not rendering. */
export function canUnregisterProtocol(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as UnregisteringNavigator).unregisterProtocolHandler === 'function';
}

/** Offer to become the handler for `web+worklog:`. Call from a click — Firefox
 *  requires user activation, and Chromium ignores a request the user didn't provoke.
 *
 *  Throws nothing: every way this can fail is a "can't, and here's why" for the
 *  user rather than an error for the console. */
export function registerProtocol(): ProtocolHandlerResult {
  if (typeof navigator === 'undefined' || typeof navigator.registerProtocolHandler !== 'function') {
    return 'unsupported';
  }
  try {
    navigator.registerProtocolHandler(DEEPLINK_SCHEME, DEEPLINK_HANDLER_URL);
    return 'asked';
  } catch {
    return 'refused';
  }
}

/** Give the scheme back. Same URL as the registration — the pair identifies which
 *  handler to drop, so the two constants have to stay one pair.
 *
 *  A browser that never had us registered treats this as a no-op, which is the
 *  right behaviour for a button whose "on" state nobody can read. */
export function unregisterProtocol(): ProtocolHandlerResult {
  const nav = typeof navigator === 'undefined' ? null : (navigator as UnregisteringNavigator);
  if (!nav || typeof nav.unregisterProtocolHandler !== 'function') {
    return 'unsupported';
  }
  try {
    nav.unregisterProtocolHandler(DEEPLINK_SCHEME, DEEPLINK_HANDLER_URL);
    return 'asked';
  } catch {
    return 'refused';
  }
}
