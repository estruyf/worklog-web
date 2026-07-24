import React, { useMemo } from 'react';
import { useData, useUi } from '../context';
import { useMarkdownImages } from '../hooks';
import { clientIdOf, isDone, renderMarkdown, makeImageResolver } from '../utils';

/** Derives the parent-task options and save-enabled flag for the open form. */
function useTaskFormData() {
  const { tasks } = useData();
  const { mClient, editingId, mTitle } = useUi();
  const parentOptions = useMemo(
    () => tasks.filter((t) => clientIdOf(t) === mClient && !t.parentId && !isDone(t) && t.id !== editingId),
    [tasks, mClient, editingId],
  );
  return { parentOptions, canAdd: mTitle.trim().length > 0 && !!mClient };
}

/** New / edit task modal. State is owned by the app so it can be seeded from
 * edit, quick-add and host "openAddTask" messages; this component only renders it. */
export function TaskFormModal() {
  const {
    editingId,
    mTitle: title,
    setMTitle: setTitle,
    mClient: clientId,
    setMClient: setClientId,
    mParent: parentId,
    setMParent: setParentId,
    mLinks: links,
    setMLinks: setLinks,
    mDue: due,
    setMDue: setDue,
    mTags: tags,
    setMTags: setTags,
    mDescription: description,
    setMDescription: setDescription,
    mDescMode: descMode,
    setMDescMode: setDescMode,
    addingClient,
    setAddingClient,
    newClientName,
    setNewClientName,
  } = useUi();
  const { clients, colorOf, assetsBase, saveTask: onSave, closeModal: onClose, createClient: onCreateClient, deleteTask: onDelete } = useData();
  const { parentOptions, canAdd } = useTaskFormData();
  const img = useMarkdownImages(description, setDescription);
  const resolveImage = useMemo(() => makeImageResolver(assetsBase), [assetsBase]);
  return (
    // Full-screen page below md (modal dialogs are awkward on phones); centered
    // dialog at md+. The panel is a flex column on mobile — fixed header/footer
    // with only the body scrolling — and a plain card on desktop (md:block).
    <div onClick={onClose} className="fixed inset-0 z-50 md:bg-[rgba(30,33,40,0.45)] md:flex md:items-start md:justify-center md:pt-[8vh]">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col h-full w-full bg-white md:block md:h-auto md:w-[560px] md:max-w-[92vw] md:rounded-[14px] md:shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="flex items-center justify-between shrink-0 px-5 pt-4 pb-3 border-b border-[#ECEEF1] md:px-[30px] md:pt-[26px] md:pb-0 md:mb-[22px] md:border-0">
          <h2 className="text-[20px] font-bold m-0">{editingId ? 'Edit task' : 'New task'}</h2>
          <button onClick={onClose} aria-label="Close" className="bg-none border-none text-[24px] md:text-[20px] text-[#8A9099] cursor-pointer leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-4 md:flex-none md:overflow-visible md:px-[30px] md:py-0">
        <label className="block font-semibold text-[14px] mb-2">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave();
            }
          }}
          placeholder="Fix social feed rendering on mobile"
          className="w-full px-[14px] py-[11px] border border-[#E2BE2E] rounded-[9px] text-[16px] md:text-[14px] shadow-[0_0_0_3px_#FBEFC0] mb-[22px] outline-none"
        />

        <label className="block font-semibold text-[14px] mb-[10px]">Client</label>
        <div className="flex flex-wrap gap-[10px] mb-[22px]">
          {clients.map((c) => {
            const active = c.id === clientId;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setClientId(c.id);
                  setParentId('');
                }}
                className={
                  'flex items-center gap-2 px-4 py-[9px] rounded-full text-[14px] font-semibold cursor-pointer border text-[#1F2328] ' +
                  (active ? 'border-[#E2BE2E] bg-[#F4CF4D]' : 'border-[#D0D7DE] bg-[#EDEFF2]')
                }
              >
                <span className="w-[9px] h-[9px] rounded-full" style={{ background: colorOf(c.id) }} />
                {c.name}
              </button>
            );
          })}
          {!addingClient && (
            <button onClick={() => setAddingClient(true)} className="flex items-center gap-[6px] px-4 py-[9px] border border-dashed border-[#CDD3DA] rounded-full bg-white text-[#57606A] text-[13px] cursor-pointer">
              + Add client
            </button>
          )}
        </div>
        {addingClient && (
          <div className="flex gap-2 mb-[22px]">
            <input
              autoFocus
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onCreateClient(newClientName, 'modal');
                }
              }}
              placeholder="New client name"
              className="flex-1 px-[14px] py-[11px] border border-[#D0D7DE] rounded-[9px] text-[16px] md:text-[14px] outline-none"
            />
            <button onClick={() => onCreateClient(newClientName, 'modal')} className="px-[16px] py-[11px] border border-[#E2BE2E] rounded-[9px] bg-[#F4CF4D] text-[#3A2E05] font-semibold text-[14px] cursor-pointer">
              Add
            </button>
            <button onClick={() => setAddingClient(false)} className="text-[#2D6CDF] text-[14px] cursor-pointer">
              Cancel
            </button>
          </div>
        )}

        <label className="block font-semibold text-[14px] mb-2">
          Parent <span className="text-[#9AA0A6] font-normal">(optional)</span>
        </label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full px-[14px] py-[11px] border border-[#D0D7DE] rounded-[9px] text-[16px] md:text-[14px] bg-white mb-[22px]">
          <option value="">— none —</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>

        <div className="flex flex-col md:flex-row gap-[14px] mb-[22px]">
          <div className="w-full md:w-[180px]">
            <label className="block font-semibold text-[14px] mb-2">
              Due <span className="text-[#9AA0A6] font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full px-[14px] py-[11px] border border-[#D0D7DE] rounded-[9px] text-[16px] md:text-[14px] bg-white"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block font-semibold text-[14px] mb-2">
              Tags <span className="text-[#9AA0A6] font-normal">(comma separated)</span>
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSave();
                }
              }}
              placeholder="frontend, bug, urgent"
              className="w-full px-[14px] py-[11px] border border-[#D0D7DE] rounded-[9px] text-[16px] md:text-[14px]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <label className="font-semibold text-[14px]">
            Description <span className="text-[#9AA0A6] font-normal">(optional, Markdown)</span>
          </label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={img.openFilePicker} disabled={img.uploading} className="text-[12px] text-[#2D6CDF] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-default">
              {img.uploading ? 'Adding…' : '+ Add image'}
            </button>
            <div className="flex border border-[#E5E7EB] rounded-[7px] overflow-hidden text-[12px]">
              <button type="button" onClick={() => setDescMode('edit')} className={'px-[10px] py-[4px] cursor-pointer ' + (descMode === 'edit' ? 'bg-[#FBEFC0] text-[#3A2E05] font-semibold' : 'bg-white text-[#57606A]')}>
                Edit
              </button>
              <button type="button" onClick={() => setDescMode('preview')} className={'px-[10px] py-[4px] cursor-pointer border-l border-[#E5E7EB] ' + (descMode === 'preview' ? 'bg-[#FBEFC0] text-[#3A2E05] font-semibold' : 'bg-white text-[#57606A]')}>
                Preview
              </button>
            </div>
          </div>
        </div>
        <input ref={img.fileInputRef} type="file" accept="image/*" multiple onChange={img.onFileChange} className="hidden" />
        <div className="mb-[22px]">
        {descMode === 'edit' ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onPaste={img.onPaste}
            onDrop={img.onDrop}
            onDragOver={img.onDragOver}
            placeholder={'Add a description in Markdown…\n\n## Notes\n- supports **bold**, *italic*, `code`\n- [links](https://example.com), lists, > quotes\n- paste, drop or add an image'}
            className="w-full min-h-[140px] px-[14px] py-[12px] border border-[#D0D7DE] rounded-[10px] text-[16px] md:text-[13.5px] leading-[1.6] outline-none focus:border-[#E2BE2E] focus:shadow-[0_0_0_3px_#FBEFC0] resize-y mb-2"
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          />
        ) : description.trim() ? (
          <div className="wl-md border border-[#ECEEF1] rounded-[12px] px-[18px] py-[14px] bg-[#FCFCFD] mb-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(description, resolveImage) }} />
        ) : (
          <div onClick={() => setDescMode('edit')} className="border border-dashed border-[#E0E3E7] rounded-[12px] px-[18px] py-[18px] text-[14px] text-[#9AA0A6] italic cursor-text mb-2">
            Nothing to preview yet. Click to add Markdown notes.
          </div>
        )}
        {img.error && <div className="text-[12.5px] text-[#DC2626]">{img.error}</div>}
        </div>

        <label className="block font-semibold text-[14px] mb-2">
          Links <span className="text-[#9AA0A6] font-normal">(optional)</span>
        </label>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={l} onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://github.com/.../pull/34" className="flex-1 px-[14px] py-[11px] border border-[#D0D7DE] rounded-[9px] text-[16px] md:text-[14px]" />
            <button
              onClick={() => {
                const next = links.filter((_, j) => j !== i);
                setLinks(next.length ? next : ['']);
              }}
              className="w-[46px] border border-[#D0D7DE] rounded-[9px] bg-white text-[#8A9099] cursor-pointer text-[15px]"
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={() => setLinks([...links, ''])} className="bg-none border-none text-[#2D6CDF] text-[14px] font-medium cursor-pointer py-[2px]">
          + Add another link
        </button>
        </div>

        <div className="flex items-center justify-between shrink-0 px-5 pt-3 pb-3 border-t border-[#ECEEF1] md:px-[30px] md:pt-0 md:pb-6 md:mt-[26px] md:border-0">
          <div>
            {editingId && (
              <button onClick={() => onDelete(editingId)} className="px-[14px] py-[10px] border border-[#F0C9C9] rounded-[9px] bg-white text-[#DC2626] text-[14px] font-semibold cursor-pointer hover:bg-[#FEF2F2]">
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-[10px]">
            <button onClick={onClose} className="px-5 py-[10px] border border-[#E5E7EB] rounded-[9px] bg-[#F1F2F4] text-[14px] font-semibold cursor-pointer">
              Close
            </button>
            <button
              onClick={onSave}
              className={
                'px-[22px] py-[10px] rounded-[9px] text-[14px] font-semibold border ' +
                (canAdd ? 'border-[#E2BE2E] bg-[#F4CF4D] text-[#3A2E05] cursor-pointer' : 'border-[#EBDFA8] bg-[#FBF1C8] text-[#B7A878] cursor-not-allowed')
              }
            >
              {editingId ? 'Save task' : 'Add task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
