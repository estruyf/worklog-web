// Local-date helpers. Billing is keyed by the author's local day, so format from
// local time (not UTC) to avoid an evening edit landing on "tomorrow".

export function today(): string {
  return toISODate(new Date());
}

export function thisMonth(): string {
  return today().slice(0, 7);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Local timestamp down to the minute ("YYYY-MM-DD HH:mm"), for note stamps. */
export function nowStamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toISODate(d)} ${hh}:${mm}`;
}
