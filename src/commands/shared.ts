// Shared markdown-append helpers used by the task services. Ported from the
// extension; the VS Code `pickClient` quick-pick is dropped (the web UI picks the
// client in a form), and paths are plain repo-relative strings.

import type { Client } from '../model/types';
import { Workspace, readText, writeText, ensureDir } from '../workspace/paths';

/** Append a serialized task block to a client file, creating it if needed. */
export async function appendTaskBlock(
  ws: Workspace,
  client: Client,
  block: string,
): Promise<void> {
  await ensureDir(ws.clientsDir);
  const path = ws.clientFile(client.id);
  const existing = await readText(path);
  let content: string;
  if (existing === undefined || existing.trim() === '') {
    content = `# ${client.name}\n\n${block}\n`;
  } else {
    content = existing.replace(/\s+$/, '') + '\n\n' + block + '\n';
  }
  await writeText(path, content);
}

/** Append a block to the monthly archive file for a client, creating it if needed. */
export async function appendArchiveBlock(
  ws: Workspace,
  clientId: string,
  clientName: string,
  month: string,
  block: string,
): Promise<void> {
  await ensureDir(`${ws.archiveDir}/${clientId}`);
  const path = ws.archiveFile(clientId, month);
  const existing = await readText(path);
  let content: string;
  if (existing === undefined || existing.trim() === '') {
    content = `# ${clientName} — ${month}\n\n${block}\n`;
  } else {
    content = existing.replace(/\s+$/, '') + '\n\n' + block + '\n';
  }
  await writeText(path, content);
}
