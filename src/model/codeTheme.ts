// Which Demo Time theme paints a fenced code block, and the normalization every
// reader relies on.
//
// It lives in `model/` for the same reason `TaskSortPref` does: the preference is
// persisted in `.worklog/config.json`, so `workspace/paths` and
// `services/settings` have to read it, and neither may import the UI. The
// colours themselves are the UI's business (see ui/utils/highlight).

/** `system` follows the OS setting, which is the shipped default: the rest of the
 *  app is light-only, so a fixed choice belongs to whoever makes it. */
export type CodeTheme = "system" | "light" | "dark";

/** The order Settings offers them in, and the list `normalizeCodeTheme` checks. */
export const CODE_THEMES: CodeTheme[] = ["system", "light", "dark"];

export const DEFAULT_CODE_THEME: CodeTheme = "system";

/** A hand-edited or newer-version value reduced to one every reader can use.
 *  Unknown values fall back rather than throwing: an unreadable preference must
 *  not be able to stop the rest of the config from loading. */
export function normalizeCodeTheme(value: unknown): CodeTheme {
  return CODE_THEMES.includes(value as CodeTheme) ? (value as CodeTheme) : DEFAULT_CODE_THEME;
}
