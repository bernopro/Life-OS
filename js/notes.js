/* ============================================================
   Notes — pinned, coloured, tagged, light markdown with
   clickable checklists.
   ============================================================ */
'use strict';

/** Tiny, safe markdown: escapes first, then formats. Checklist lines become clickable. */
function mdRender(text, noteId) {
  const lines = String(text || '').split('\n');
  let html = '', inList = false;
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>');
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  lines.forEach((ln, i) => {
    const cb = ln.match(/^\s*[-*]?\s*\[( |x|X)\]\s+(.*)$/);
    if (cb) {
      closeList();
      const done = cb[1].toLowerCase() === 'x';
      html += `<div class="md-check ${done ? 'done' : ''}"><button class="check sm ${done ? 'on' : ''}" ${noteId ? `data-act="noteCheck" data-id="${noteId}" data-line="${i}"` : ''} aria-label="Toggle item">${ic('check', 11, 'stroke-width="3"')}</button><span>${inline(cb[2])}</span></div>`;
      return;
    }
    const h = ln.match(/^(#{1,3})\s+(.*)$/);
    if (h) { closeList(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; return; }
    const li = ln.match(/^\s*[-*•]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; return; }
    closeList();
    if (/^\s*>\s?/.test(ln)) { html += `<blockquote>${inline(ln.replace(/^\s*>\s?/, ''))}</blockquote>`; return; }
    if (/^\s*---+\s*$/.test(ln)) { html += '<hr>'; return; }
    html += ln.trim() ? `<p>${inline(ln)}</p>` : '';
  });
  closeList();
  return html;
}

function openNoteForm(note) {
  const isNew = !note;
  formModal({
    title: isNew ? 'New note' : 'Edit note', size: 'lg',
    values: note ? { ...note, tags: (note.tags || []).join(', ') } : { title: '', body: '', color: '#64748b', tags: '', pinned: false },
    fields: [
      { key: 'title', label: 'Title', placeholder: 'Untitled', autofocus: true },
      { key: 'body', label: 'Note', type: 'textarea', rows: 12, placeholder: 'Write anything…\n\n# Heading\n- bullet\n[ ] checklist item\n**bold**  *italic*  `code`', hint: 'Supports simple markdown: # headings, - lists, [ ] checkboxes, **bold**, *italic*, > quotes, links. Ctrl+Enter to save.' },
      { key: 'tags', label: 'Tags', placeholder: 'ideas, recipes, work (comma separated)', half: true },
      { key: 'pinned', label: 'Pin to top', type: 'checkbox', half: true },
      { key: 'color', label: 'Color', type: 'color', colors: ['#64748b', ...PALETTE.slice(0, 12)] },
    ],
    onSave: v => {
      if (!v.title && !v.body) { toast('Write something first', { type: 'error' }); return false; }
      v.tags = [...new Set(v.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))];
      update(s => {
        if (isNew) s.notes.push({ id: uid(), created: Date.now(), updated: Date.now(), ...v });
        else Object.assign(s.notes.find(n => n.id === note.id), v, { updated: Date.now() });
      });
    },
    onDelete: isNew ? null : () => withUndo('Note deleted', s => { s.notes = s.notes.filter(n => n.id !== note.id); }),
    extraFoot: isNew ? '' : `<button type="button" class="btn btn-ghost" data-close onclick="App.actions.noteDup({dataset:{id:'${note.id}'}})">${ic('copy', 16)} Duplicate</button>`,
  });
}
function noteCard(n) {
  const body = mdRender(n.body, n.id);
  const long = (n.body || '').length > 420 || (n.body || '').split('\n').length > 12;
  const tinted = n.color && n.color !== '#64748b';
  return `<div class="card note ${tinted ? 'tinted' : ''}" style="--c:${n.color || '#64748b'}" data-act="noteEdit" data-id="${n.id}">
    <button class="btn-icon sm pin ${n.pinned ? 'on' : ''}" data-act="notePin" data-id="${n.id}" aria-label="${n.pinned ? 'Unpin' : 'Pin'}">${ic('pin', 15)}</button>
    ${n.title ? `<h4>${esc(n.title)}</h4>` : ''}
    <div class="note-body md ${long ? 'clip' : ''}">${body || '<p class="faint">Empty note</p>'}</div>
    <div class="row wrap mt-s" style="gap:6px">${(n.tags || []).map(t => `<span class="chip">#${esc(t)}</span>`).join('')}<span class="spacer"></span><span class="faint tiny">${esc(relDay(ymd(new Date(n.updated || n.created || Date.now()))))}</span></div>
  </div>`;
}

App.views.notes = {
  title: 'Notes',
  render() {
    const q = (App.ui.noteQ || '').toLowerCase();
    const tag = App.ui.noteTag || '';
    const sortBy = cfg().notesSort;
    let list = db().notes.filter(n => (!q || `${n.title} ${n.body} ${(n.tags || []).join(' ')}`.toLowerCase().includes(q)) && (!tag || (n.tags || []).includes(tag)));
    const sorter = { updated: (a, b) => (b.updated || 0) - (a.updated || 0), created: (a, b) => (b.created || 0) - (a.created || 0), title: (a, b) => (a.title || '').localeCompare(b.title || '') }[sortBy];
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || sorter(a, b));
    const tags = [...new Set(db().notes.flatMap(n => n.tags || []))].sort();
    const pinned = list.filter(n => n.pinned), rest = list.filter(n => !n.pinned);
    const wrapCls = cfg().notesView === 'list' ? 'notes-list' : 'notes-grid';
    return `<div class="page-head"><div><h2>Notes</h2><p>${plural(db().notes.length, 'note')}</p></div>
      <div class="actions">
        <input class="input" id="noteQ" style="width:220px" placeholder="Search notes" data-input="noteQ" value="${esc(App.ui.noteQ || '')}" aria-label="Search notes">
        <select class="input" style="width:auto" data-change="noteSort" aria-label="Sort"><option value="updated" ${sortBy === 'updated' ? 'selected' : ''}>Last edited</option><option value="created" ${sortBy === 'created' ? 'selected' : ''}>Newest</option><option value="title" ${sortBy === 'title' ? 'selected' : ''}>Title</option></select>
        ${seg('noteView', [{ value: 'grid', label: ic('grid', 15) }, { value: 'list', label: ic('list', 15) }], cfg().notesView)}
        <button class="btn btn-primary" data-act="noteNew">${ic('plus', 16)} New note</button></div></div>
      ${tags.length ? `<div class="row wrap mb" style="gap:6px"><button class="chip ${!tag ? 'on' : ''}" data-act="noteTag" data-tag="">All</button>${tags.map(t => `<button class="chip ${tag === t ? 'on' : ''}" data-act="noteTag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
      ${list.length ? `${pinned.length ? `<div class="group-h">${ic('pin', 13)} Pinned</div><div class="${wrapCls} mb">${pinned.map(noteCard).join('')}</div>` : ''}
        ${rest.length ? `${pinned.length ? '<div class="group-h">Others</div>' : ''}<div class="${wrapCls}">${rest.map(noteCard).join('')}</div>` : ''}`
        : `<div class="card">${emptyState('note', q || tag ? 'No matching notes' : 'No notes yet', q || tag ? 'Try a different search.' : 'Capture ideas, lists, recipes, meeting notes — anything.', q || tag ? '' : `<button class="btn btn-primary" data-act="noteNew">${ic('plus', 16)} New note</button>`)}</div>`}`;
  },
};

Object.assign(App.actions, {
  noteNew: () => openNoteForm(null),
  noteEdit: (el, e) => { if (e.target.closest('a')) return; openNoteForm(db().notes.find(n => n.id === el.dataset.id)); },
  notePin: (el, e) => { e.stopPropagation(); update(s => { const n = s.notes.find(x => x.id === el.dataset.id); n.pinned = !n.pinned; }); },
  noteCheck: (el, e) => {
    e.stopPropagation();
    update(s => {
      const n = s.notes.find(x => x.id === el.dataset.id);
      const lines = n.body.split('\n'), i = Number(el.dataset.line);
      lines[i] = lines[i].replace(/\[( |x|X)\]/, m => m === '[ ]' ? '[x]' : '[ ]');
      n.body = lines.join('\n'); n.updated = Date.now();
    });
  },
  noteDup: el => { const n = db().notes.find(x => x.id === el.dataset.id); update(s => { s.notes.push({ ...JSON.parse(JSON.stringify(n)), id: uid(), title: (n.title || 'Untitled') + ' (copy)', pinned: false, created: Date.now(), updated: Date.now() }); }); toast('Note duplicated'); },
  noteQ: el => { App.ui.noteQ = el.value; renderView(); },
  noteTag: el => { App.ui.noteTag = el.dataset.tag; renderView(); },
  noteSort: el => update(s => { s.settings.notesSort = el.value; }),
  noteView: el => update(s => { s.settings.notesView = el.dataset.val; }),
});
