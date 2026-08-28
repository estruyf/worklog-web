// The vocabulary the bar and its phone sheets share. Its own module so the two
// components can both import it without pointing at each other.

/** The id every "no narrowing" option carries. Empty string is what
 *  `TaskListFilters` already stores for "any status" / "any priority", so the
 *  menus can offer it as an option rather than as a separate Clear button. */
export const ANY = '';

/** One status the list can be narrowed to, with what picking it would leave.
 *  The priority picker offers the same shape — both are "one id, with a count". */
export interface TaskStatusOption {
  id: string;
  label: string;
  count: number;
}
