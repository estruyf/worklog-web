// Quick-entry shorthand (spec §6). Parse a single line into task fields:
//   Fix social feed @acme ~https://example.com/pr/34 #mobile
// `@client` -> client tag, `~url` -> link, `#parentRef` -> parent reference.
// Everything before the first tag is the title.

export interface QuickEntry {
  title: string;
  clientId?: string;
  links: string[];
  parentRef?: string;
}

const TAG = /(^|\s)([@~#])(\S+)/g;

export function parseQuickEntry(input: string): QuickEntry {
  const result: QuickEntry = { title: "", links: [] };
  let firstTagIndex = input.length;

  for (const m of input.matchAll(TAG)) {
    const at = m.index! + m[1].length; // position of the sigil
    firstTagIndex = Math.min(firstTagIndex, at);
    const value = m[3];
    switch (m[2]) {
      case "@":
        result.clientId = value;
        break;
      case "~":
        result.links.push(value);
        break;
      case "#":
        result.parentRef = value;
        break;
    }
  }

  result.title = input.slice(0, firstTagIndex).trim();
  return result;
}
