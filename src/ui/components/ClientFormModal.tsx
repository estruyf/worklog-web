import React from 'react';
import { PALETTE } from '../utils';
import { Button, Field, Input, LinkButton, Modal, SectionLabel, TextArea } from '../primitives';
import { useData, useUi } from '../context';

/** Add / edit client modal (name, color, notes and reference links), plus the two
 *  ways to retire one: archive (reversible, keeps every task and ledger entry)
 *  and delete (only for a client that never accumulated any). */
export function ClientFormModal() {
  const {
    editingClientId,
    cName: name,
    setCName: setName,
    cColor: color,
    setCColor: setColor,
    cDesc: desc,
    setCDesc: setDesc,
    cLinks: links,
    setCLinks: setLinks,
    setClientModalOpen,
  } = useUi();
  const { saveClient: onSave, allClients, clientUsage, setClientArchived, deleteClient } = useData();
  const onClose = () => setClientModalOpen(false);
  const editing = editingClientId ? allClients.find((c) => c.id === editingClientId) : undefined;
  const usage = editingClientId ? clientUsage(editingClientId) : { tasks: 0, worklog: 0 };
  const deletable = usage.tasks === 0 && usage.worklog === 0;
  return (
    <Modal
      onClose={onClose}
      showClose
      offset="xs"
      className="max-h-[84vh] overflow-auto"
      title={editingClientId ? 'Edit client' : 'New client'}
    >
      <Field label="Name" className="mt-[22px] mb-[22px]">
        <Input
          autoFocus
          size="lg"
          variant="accent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave();
            }
          }}
          placeholder="Acme Inc"
          className="w-full"
        />
      </Field>

      <label className="block font-semibold text-body mb-[10px]">Color</label>
      <div className="flex flex-wrap gap-[10px] mb-2">
        {PALETTE.map((p) => {
          const active = color.toLowerCase() === p.toLowerCase();
          return (
            <button
              key={p}
              onClick={() => setColor(p)}
              title={p}
              className={'w-7 h-7 rounded-full cursor-pointer border-2 ' + (active ? 'border-brand-800' : 'border-transparent')}
              style={{ background: p }}
            />
          );
        })}
      </div>

      <Field label="Description" hint="optional" className="mt-[22px]">
        <TextArea
          size="lg"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={4}
          placeholder={'Who they are, the contact, the agreed rate…\nSupports **bold**, *italic*, `code`, [links](https://example.com) and lists.'}
          className="w-full"
        />
      </Field>

      <label className="block font-semibold text-body mt-[22px] mb-2">
        Links <span className="text-neutral-625 font-normal">(optional)</span>
      </label>
      {links.map((l, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <Input
            value={l.url}
            onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
            aria-label={`Link ${i + 1} URL`}
            placeholder="https://github.com/acme/website"
            className="flex-[2] min-w-0"
          />
          <Input
            value={l.label}
            onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            aria-label={`Link ${i + 1} label`}
            placeholder="Label"
            className="flex-1 min-w-0"
          />
          <button
            onClick={() => setLinks(links.filter((_, j) => j !== i))}
            title="Remove this link"
            className="w-[38px] shrink-0 border border-neutral-525 rounded-control-lg bg-white text-neutral-650 cursor-pointer text-[15px]"
          >
            ×
          </button>
        </div>
      ))}
      <LinkButton size="lg" onClick={() => setLinks([...links, { url: '', label: '' }])} className="font-medium py-[2px]">
        + Add {links.length ? 'another ' : ''}link
      </LinkButton>

      {editingClientId && <div className="text-meta text-neutral-625 mt-3">Client id <code className="text-neutral-675">{editingClientId}</code> stays the same; only the name, color, description and links change.</div>}

      {editing && (
        <div className="mt-5 pt-4 border-t border-neutral-325">
          <SectionLabel className="mb-[10px]">Retire this client</SectionLabel>
          <div className="flex flex-wrap items-center gap-[10px]">
            <Button size="md" onClick={() => setClientArchived(editing, !editing.archived)}>
              {editing.archived ? 'Restore client' : 'Archive client'}
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => deleteClient(editing)}
              disabled={!deletable}
              title={deletable ? 'Delete this client' : 'Only a client with no tasks and no logged time can be deleted'}
            >
              Delete client
            </Button>
          </div>
          <div className="text-meta text-neutral-625 mt-[10px]">
            {editing.archived
              ? 'Archived: hidden from the pickers, the day view and the log form. Its history is untouched and still shows in Insights, Archive and search.'
              : 'Archiving hides it from the pickers and lists but keeps every task and logged hour.'}
            {!deletable && (
              <>
                {' '}
                Deleting is unavailable — it still has {usage.tasks} task{usage.tasks === 1 ? '' : 's'} and {usage.worklog} time
                entr{usage.worklog === 1 ? 'y' : 'ies'}.
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-[10px] mt-[26px]">
        <Button variant="neutral" size="lg" onClick={onClose}>
          Close
        </Button>
        {/* `saveClient` already no-ops on a blank name, so the disabled attribute
            only makes the existing behaviour reachable by keyboard and screen
            reader rather than changing it. */}
        <Button variant="primary" size="lg" onClick={onSave} disabled={!name.trim()}>
          {editingClientId ? 'Save client' : 'Add client'}
        </Button>
      </div>
    </Modal>
  );
}
