// Actions over the reusable checklists. The lists themselves come straight off
// the snapshot — there is nothing to derive, a list is what its file says — so
// this is only the mutations, plus the two that ask before they destroy
// something.
//
// Items are addressed by the line they sit on rather than by an id: a checklist
// item has no id in the Markdown, which is what keeps the file something you can
// hand-edit. See `parser/checklistParser`.

import { worklogStore } from "../../../data/worklogStore";
import type { Checklist, ChecklistItem, ChecklistSection } from "../../../model/checklist";
import { checklistProgress } from "../../../model/checklist";
import type { WorklogUiState } from "../useWorklogUiState";

export function useChecklistModel(today: string, ui: WorklogUiState) {
  const { ask } = ui.confirm;

  return {
    /** Start a list. Resolves to the new list so the view can open it. */
    createList: (name: string) => worklogStore.createChecklist(name),
    renameList: (id: string, name: string) => worklogStore.renameChecklist(id, name),

    /** Deleting a list takes its items with it, and the file is the only copy —
     *  the same reason deleting a task asks. */
    deleteList: async (list: Checklist) => {
      const ok = await ask({
        title: `Delete “${list.name}”?`,
        message: "The list and everything on it go with it. This can't be undone here — only in Git.",
        confirmLabel: 'Delete list',
        tone: 'danger',
      });
      if (ok) {
        await worklogStore.deleteChecklist(list.id);
      }
    },

    toggleItem: (list: Checklist, item: ChecklistItem) =>
      worklogStore.setChecklistItem(list.id, item.line, !item.done),
    addItem: (list: Checklist, sectionIndex: number, text: string) =>
      worklogStore.addChecklistItem(list.id, sectionIndex, text),
    renameItem: (list: Checklist, item: ChecklistItem, text: string) =>
      worklogStore.renameChecklistItem(list.id, item.line, text),
    deleteItem: (list: Checklist, item: ChecklistItem) => worklogStore.deleteChecklistItem(list.id, item.line),

    /** Put an item at `index` among `sectionIndex`'s items — the drop target of a
     *  drag, or the neighbouring slot a menu move names. */
    moveItem: (list: Checklist, item: ChecklistItem, sectionIndex: number, index: number) =>
      worklogStore.moveChecklistItem(list.id, item.line, sectionIndex, index),

    /** A copy to run from the top. Resolves to it so the view can open it. */
    duplicateList: (list: Checklist) => worklogStore.duplicateChecklist(list.id),

    addSection: (list: Checklist, title: string) => worklogStore.addChecklistSection(list.id, title),
    renameSection: (list: Checklist, section: ChecklistSection, title: string) =>
      section.line === undefined ? Promise.resolve() : worklogStore.renameChecklistSection(list.id, section.line, title),

    moveSection: (list: Checklist, section: ChecklistSection, direction: -1 | 1) =>
      section.line === undefined ? Promise.resolve() : worklogStore.moveChecklistSection(list.id, section.line, direction),

    /** Removing a section takes its items with it — see `removeChecklistSection`
     *  for why the heading can't go on its own. An empty one goes without asking:
     *  there is nothing to lose and nothing to warn about. */
    deleteSection: async (list: Checklist, section: ChecklistSection) => {
      if (section.line === undefined) {
        return;
      }
      const count = section.items.length;
      const ok =
        count === 0 ||
        (await ask({
          title: `Delete “${section.title}”?`,
          message: `The ${count === 1 ? 'item' : `${count} items`} under it ${count === 1 ? 'goes' : 'go'} too. To keep them, move them out of the section first.`,
          confirmLabel: 'Delete section',
          tone: 'danger',
        }));
      if (ok) {
        await worklogStore.deleteChecklistSection(list.id, section.line);
      }
    },

    /** Clear the ticks and stamp the run that just ended. Asks first: the ticks
     *  are the record of where you got to, and a mis-tap would wipe it. */
    startAgain: async (list: Checklist) => {
      const { done, total } = checklistProgress(list);
      const ok = await ask({
        title: `Start “${list.name}” again?`,
        message: `${done} of ${total} ticked ${done === 1 ? 'item goes' : 'items go'} back to unticked, and today becomes the day this run finished.`,
        confirmLabel: 'Start again',
      });
      if (ok) {
        await worklogStore.startChecklistAgain(list.id, today);
      }
    },
  };
}
