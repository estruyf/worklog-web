// Product URLs that more than one ring needs. Kept here — beside the other pure,
// dependency-free model modules — so the marketing page (Astro) and the app rail
// (React) can't drift to two different store listings.

/** The Worklog browser extension: adds tasks straight from GitHub and Productive. */
export const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/worklog/kafgmlcbbbolmcfhllldpnheclgioako';

/** The published changelog (src/pages/changelog.astro, rendered from CHANGELOG.md).
 *  Outside the app's client-side router, so linking to it is a real navigation. */
export const CHANGELOG_PATH = '/changelog';

/** Where feedback goes: an issue on Worklog's own repo. There is no in-app
 *  feedback channel and no server to hold one — the app's GitHub token is for the
 *  user's timesheet repo, not for filing issues on someone else's. */
export const ISSUES_URL = 'https://github.com/estruyf/worklog-web/issues';

/** The new-issue form. The rail links here (you arrive wanting to report), the
 *  marketing footer links to the list (you arrive wanting to look). */
export const NEW_ISSUE_URL = `${ISSUES_URL}/new`;
