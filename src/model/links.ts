// Product URLs that more than one ring needs. Kept here — beside the other pure,
// dependency-free model modules — so the marketing page (Astro) and the app rail
// (React) can't drift to two different store listings.

/** The Worklog browser extension: adds tasks straight from GitHub and Productive. */
export const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/worklog/kafgmlcbbbolmcfhllldpnheclgioako';

/** The published changelog (src/pages/changelog.astro, rendered from CHANGELOG.md).
 *  Outside the app's client-side router, so linking to it is a real navigation. */
export const CHANGELOG_PATH = '/changelog';
