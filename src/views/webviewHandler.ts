// Handles the UI -> host messages that mutate the store or reach the outside
// world (open link, open source, trigger sync). Ported from the extension; the
// VS Code-specific actions are delegated to injected callbacks so this stays
// runtime-agnostic. The data mutations call the exact same services.

import { Store } from '../store';
import { createClient, createTask, updateClient } from '../services/tasks';
import { saveImageAsset } from '../services/assets';
import {
  addTaskNote,
  closeTaskById,
  deleteTaskCascade,
  deleteTaskNote,
  setTaskCompletedDate,
  setTaskParent,
  setTaskStatus,
  toggleTaskWorkedOn,
  updateTask,
} from '../services/taskOps';
import { removeWorklog, setEventWorklog, setWorklog } from '../services/worklog';
import type { HostMessage, WebviewMessage } from '../webview/protocol';

export interface HandlerCtx {
  post: (message: HostMessage) => void;
  /** Open a URL in a new browser tab. */
  openExternal: (url: string) => void;
  /** Build the github.com blob URL for a task's source line (or undefined). */
  sourceUrl: (taskId: string) => string | undefined;
  /** Force an immediate commit of dirty files. */
  triggerSync: () => void;
  /** Reload the repository from GitHub. */
  reload: () => void;
}

export async function handleWebviewMessage(
  store: Store,
  message: WebviewMessage,
  ctx: HandlerCtx,
): Promise<void> {
  const { post } = ctx;
  try {
    switch (message.type) {
      case 'gitSync':
        ctx.triggerSync();
        break;
      case 'logDay':
        // The web UI logs time through the inline Day-view form; nothing to do.
        break;
      case 'reloadWebview':
        ctx.reload();
        break;
      case 'createTask':
        await createTask(store, {
          title: message.title,
          clientId: message.clientId,
          parentId: message.parentId,
          links: message.links,
          description: message.description,
          due: message.due,
          tags: message.tags,
        });
        post({ type: 'actionDone', message: `Added “${message.title}”.` });
        break;
      case 'updateTask':
        await updateTask(store, message.taskId, {
          title: message.title,
          clientId: message.clientId,
          parentId: message.parentId,
          links: message.links,
          description: message.description,
          due: message.due,
          tags: message.tags,
        });
        post({ type: 'actionDone', message: 'Task updated.' });
        break;
      case 'createClient':
        await createClient(store, { name: message.name, color: message.color });
        post({ type: 'actionDone', message: 'Client added.' });
        break;
      case 'updateClient':
        await updateClient(store, message.id, { name: message.name, color: message.color });
        post({ type: 'actionDone', message: 'Client updated.' });
        break;
      case 'closeTask': {
        const closed = await closeTaskById(store, message.taskId, message.date);
        post({ type: 'actionDone', message: `Closed “${closed.title}”.` });
        break;
      }
      case 'setCompletedDate': {
        const updated = await setTaskCompletedDate(store, message.taskId, message.date);
        post({ type: 'actionDone', message: `Updated completion date for “${updated.title}” to ${message.date}.` });
        break;
      }
      case 'toggleWorked': {
        const updated = await toggleTaskWorkedOn(store, message.taskId, message.date);
        const marked = updated.workedOn?.includes(message.date) === true;
        post({
          type: 'actionDone',
          message: marked
            ? `Marked “${updated.title}” as worked on ${message.date}.`
            : `Removed worked marker for “${updated.title}” on ${message.date}.`,
        });
        break;
      }
      case 'setStatus': {
        const updated = await setTaskStatus(store, message.taskId, message.statusId);
        post({ type: 'actionDone', message: `“${updated.title}” → ${message.statusId}.` });
        break;
      }
      case 'setParent':
        await setTaskParent(store, message.taskId, message.parentId);
        post({ type: 'actionDone', message: message.parentId ? 'Parent set.' : 'Parent cleared.' });
        break;
      case 'createParent': {
        const child = store.db.getTask(message.childId);
        if (child) {
          const parent = await createTask(store, { title: message.title, clientId: child.clientIds[0] });
          await setTaskParent(store, child.id, parent.id);
          post({ type: 'actionDone', message: `Parent “${parent.title}” added.` });
        }
        break;
      }
      case 'deleteTask': {
        const { removed } = await deleteTaskCascade(store, message.taskId);
        post({ type: 'actionDone', message: `Removed ${removed} task${removed === 1 ? '' : 's'}.` });
        break;
      }
      case 'addNote':
        await addTaskNote(store, message.taskId, message.text);
        post({ type: 'actionDone', message: 'Note added.' });
        break;
      case 'deleteNote':
        await deleteTaskNote(store, message.taskId, message.index);
        post({ type: 'actionDone', message: 'Note removed.' });
        break;
      case 'setWorklog':
        await setWorklog(store, message.date, message.clientId, message.hours, message.note);
        post({ type: 'actionDone', message: 'Time logged.' });
        break;
      case 'setEventWorklog':
        await setEventWorklog(store, message.date, message.eventType, message.hours, message.note);
        post({ type: 'actionDone', message: 'Day event logged.' });
        break;
      case 'removeWorklog':
        await removeWorklog(store, message.date, message.clientId);
        post({ type: 'actionDone', message: 'Time entry removed.' });
        break;
      case 'openSource': {
        const url = ctx.sourceUrl(message.taskId);
        if (url) {
          ctx.openExternal(url);
        }
        break;
      }
      case 'openTaskWindow': {
        // Open the standalone task view in a new tab.
        ctx.openExternal(`?task=${encodeURIComponent(message.taskId)}`);
        break;
      }
      case 'openLink':
        ctx.openExternal(message.url);
        break;
      case 'saveImage': {
        try {
          const ref = await saveImageAsset(store, message.dataBase64, message.ext);
          post({ type: 'imageSaved', requestId: message.requestId, ref });
        } catch (err) {
          post({ type: 'imageSaved', requestId: message.requestId, error: err instanceof Error ? err.message : String(err) });
        }
        break;
      }
    }
  } catch (err) {
    post({ type: 'actionError', message: err instanceof Error ? err.message : String(err) });
  }
}
