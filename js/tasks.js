/* ============================================================
   Tasks — lists, smart views, priorities, subtasks, repeats,
   natural quick-add ("Call mom tomorrow !high #personal").
   ============================================================ */
'use strict';

const PRIOS = [
  { value: 0, label: 'None', color: 'var(--text-3)' },
  { value: 1, label: 'Low', color: 'var(--info)' },
  { value: 2, label: 'Medium', color: 'var(--warn)' },
  { value: 3, label: 'High', color: 'var(--danger)' },
];
const TASK_REPEATS = [
  { value: 'none', label: 'No repeat' }, { value: 'daily', label: 'Daily' }, { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' },
];
const WEEKDAY_WORDS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function nextDue(ds, rep) {
  const d = parseYmd(ds || todayStr());
  switch (rep) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekdays': do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); break; }
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return ymd(d);
}

function parseQuick(text) {
  let t = ' ' + text + ' ';
  const o = { priority: 0, due: '', list: null };
  t = t.replace(/\s!(high|hi|h|3|medium|med|m|2|low|lo|l|1)(?=\s)/i, (m, p) => {
    o.priority = { high: 3, hi: 3, h: 3, 3: 3, medium: 2, med: 2, m: 2, 2: 2, low: 1, lo: 1, l: 1, 1: 1 }[p.toLowerCase()];
    return ' ';
  });
  t = t.replace(/\s#([^\s#]+)(?=\s)/, (m, n) => {
    const key = n.toLowerCase().replace(/[-_]/g, ' ');
    const l = db().lists.find(x => x.name.toLowerCase() === key || x.name.toLowerCase().replace(/\s+/g, '') === key.replace(/\s+/g, ''));
    if (l) { o.list = l.id; return ' '; }
    return m;
  });
  const T = todayStr();
  const rules = [
    [/\s(today|tod)(?=\s)/i, () => T],
    [/\s(tomorrow|tmrw|tmr)(?=\s)/i, () => addDaysStr(T, 1)],
    [/\snext week(?=\s)/i, () => addDaysStr(T, 7)],
    [/\sin (\d{1,3}) days?(?=\s)/i, m => addDaysStr(T, Number(m[1]))],
    [/\s(\d{4}-\d{2}-\d{2})(?=\s)/, m => m[1]],
    [new RegExp(`\\s(?:on |next )?(${WEEKDAY_WORDS.join('|')})(?=\\s)`, 'i'), m => {
      const target = WEEKDAY_WORDS.indexOf(m[1].toLowerCase());
      const diff = (target - new Date().getDay() + 7) % 7 || 7;
      return addDaysStr(T, diff);
    }],
  ];
  for (const [re, fn] of rules) {
    const m = t.match(re);
    if (m) { o.due = fn(m); t = t.replace(re, ' '); break; }
  }
  o.title = t.replace(/\s+/g, ' ').trim();
  return o;
}

function addTaskQuick(text, extra = {}) {
  const p = parseQuick(text);
  if (!p.title) return null;
  const view = App.ui.taskView || 'today';
  const task = {
    id: uid(), title: p.title, notes: '', priority: p.priority, done: false, doneAt: null,
    list: p.list || extra.list || (db().lists.some(l => l.id === view) ? view : 'inbox'),
    due: p.due || extra.due || '', dueTime: '', repeat: 'none', subtasks: [], created: Date.now(),
  };
  update(s => { s.tasks.push(task); });
  renderNav();
  return task;
}

function toggleTask(id) {
  const t = db().tasks.find(x => x.id === id);
  if (!t) return;
  const wasDone = t.done;
  update(s => {
    const x = s.tasks.find(y => y.id === id);
    x.done = !x.done;
    x.doneAt = x.done ? Date.now() : null;
    if (x.done && x.repeat && x.repeat !== 'none' && !x.spawnedId) {
      const nid = uid();
      x.spawnedId = nid;
      s.tasks.push({ ...x, id: nid, done: false, doneAt: null, spawnedId: null, due: nextDue(x.due, x.repeat), subtasks: (x.subtasks || []).map(st => ({ ...st, id: uid(), done: false })), created: Date.now() });
    }
  });
  renderNav();
  if (!wasDone && App.route === 'tasks') setTimeout(() => { if (App.route === 'tasks' && !App.modals.length) renderView(); }, 4100);
  if (!wasDone) toast(t.repeat && t.repeat !== 'none' ? 'Done — next one scheduled' : 'Task completed 🎉', { action: 'Undo', onAction: () => {
    update(s => {
      const x = s.tasks.find(y => y.id === id);
      if (!x) return;
      x.done = false; x.doneAt = null;
      if (x.spawnedId) { s.tasks = s.tasks.filter(y => y.id !== x.spawnedId); x.spawnedId = null; }
    });
    renderNav();
  } });
}

function openTaskForm(task, defaults = {}) {
  const isNew = !task;
  const v = task || { title: '', notes: '', list: defaults.list || 'inbox', priority: 0, due: defaults.due || '', dueTime: '', repeat: 'none', subtasks: [] };
  formModal({
    title: isNew ? 'New task' : 'Edit task',
    values: { ...v, priority: String(v.priority || 0) },
    fields: [
      { key: 'title', label: 'Task', required: true, placeholder: 'What needs doing?', autofocus: true },
      { key: 'list', label: 'List', type: 'select', options: () => db().lists.map(l => ({ value: l.id, label: l.name })), half: true },
      { key: 'priority', label: 'Priority', type: 'seg', options: PRIOS.map(p => ({ value: String(p.value), label: p.label })), half: true },
      { key: 'due', label: 'Due date', type: 'date', third: true },
      { key: 'dueTime', label: 'Time', type: 'time', third: true, showIf: x => !!x.due },
      { key: 'repeat', label: 'Repeat', type: 'select', options: TASK_REPEATS, third: true },
      { key: 'subtasks', label: 'Subtasks', type: 'checklist' },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, placeholder: 'Details, links, anything…' },
    ],
    onSave: x => {
      x.priority = Number(x.priority) || 0;
      if (!x.due) x.dueTime = '';
      if (x.repeat !== 'none' && !x.due) x.due = todayStr();
      update(s => {
        if (isNew) s.tasks.push({ id: uid(), done: false, doneAt: null, created: Date.now(), ...x });
        else Object.assign(s.tasks.find(t => t.id === task.id), x);
      });
      renderNav();
      toast(isNew ? 'Task added' : 'Task saved', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo('Task deleted', s => { s.tasks = s.tasks.filter(t => t.id !== task.id); }),
  });
}

function openListForm(list) {
  const isNew = !list;
  formModal({
    title: isNew ? 'New list' : 'Edit list',
    values: list || { name: '', color: PALETTE[Math.floor(Math.random() * PALETTE.length)] },
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Home, Side project, Groceries', autofocus: true },
      { key: 'color', label: 'Color', type: 'color' },
    ],
    onSave: v => {
      if (db().lists.some(l => l.name.toLowerCase() === v.name.toLowerCase() && l.id !== list?.id)) { toast('A list with that name already exists', { type: 'error' }); return false; }
      const id = isNew ? uid() : list.id;
      update(s => { if (isNew) s.lists.push({ id, ...v }); else Object.assign(s.lists.find(l => l.id === id), v); });
      if (isNew) { App.ui.taskView = id; renderView(); }
    },
    onDelete: isNew || list.id === 'inbox' ? null : () => withUndo(`List “${list.name}” deleted — tasks moved to Inbox`, s => {
      s.lists = s.lists.filter(l => l.id !== list.id);
      s.tasks.forEach(t => { if (t.list === list.id) t.list = 'inbox'; });
      if (App.ui.taskView === list.id) App.ui.taskView = 'today';
    }),
  });
}

const openTasks = () => db().tasks.filter(t => !t.done);
const tasksDueToday = () => openTasks().filter(t => t.due && t.due <= todayStr());

function taskFilter(view) {
  const T = todayStr();
  const all = db().tasks;
  switch (view) {
    case 'today': return all.filter(t => t.due && (t.due < T ? !t.done : t.due === T));
    case 'upcoming': return all.filter(t => t.due && t.due > T);
    case 'anytime': return all.filter(t => !t.due);
    case 'all': return all;
    case 'done': return all.filter(t => t.done);
    default: return all.filter(t => t.list === view);
  }
}
function sortTasks(arr, how) {
  const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.dueTime || '99').localeCompare(b.dueTime || '99');
  const f = {
    due: (a, b) => byDue(a, b) || b.priority - a.priority,
    priority: (a, b) => b.priority - a.priority || byDue(a, b),
    created: (a, b) => (b.created || 0) - (a.created || 0),
    alpha: (a, b) => a.title.localeCompare(b.title),
  }[how] || (() => 0);
  return [...arr].sort((a, b) => (a.done - b.done) || f(a, b));
}
function groupTasks(arr, view, how) {
  const T = todayStr();
  if (how === 'auto') how = view === 'today' ? 'today' : view === 'upcoming' ? 'date' : view === 'done' ? 'none' : ['all', 'anytime'].includes(view) ? 'list' : 'none';
  const g = new Map();
  const put = (k, label, t) => { if (!g.has(k)) g.set(k, { label, items: [] }); g.get(k).items.push(t); };
  arr.forEach(t => {
    if (how === 'none') put('all', '', t);
    else if (how === 'today') { if (t.due < T) put('0', 'Overdue', t); else put('1', 'Today', t); }
    else if (how === 'date') put(t.due || 'zzz', t.due ? relDay(t.due) : 'No date', t);
    else if (how === 'list') { const l = listById(t.list); put(l.id, l.name, t); }
    else if (how === 'priority') put(String(3 - (t.priority || 0)), PRIOS[t.priority || 0].label + ' priority', t);
  });
  return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
}

function taskRow(t, { compact = false } = {}) {
  const T = todayStr();
  const l = listById(t.list);
  const dueCls = !t.done && t.due && t.due < T ? 'over' : t.due === T ? 'today' : '';
  const st = t.subtasks || [];
  const stDone = st.filter(s => s.done).length;
  const meta = [
    t.due ? `<span class="m ${dueCls}">${ic('calendar', 13)}${esc(relDay(t.due))}${t.dueTime ? ' ' + fmtTime(t.dueTime) : ''}</span>` : '',
    !compact && App.ui.taskView !== t.list ? `<span class="m"><span class="dot" style="--c:${l.color};width:7px;height:7px"></span>${esc(l.name)}</span>` : '',
    t.priority ? `<span class="m pflag" style="--c:${PRIOS[t.priority].color}">${ic('flag', 13)}${PRIOS[t.priority].label}</span>` : '',
    st.length ? `<span class="m">${ic('check', 13)}${stDone}/${st.length}</span>` : '',
    t.repeat && t.repeat !== 'none' ? `<span class="m">${ic('repeat', 13)}${esc(TASK_REPEATS.find(r => r.value === t.repeat)?.label || '')}</span>` : '',
    t.notes && !compact ? `<span class="m">${ic('note', 13)}</span>` : '',
  ].join('');
  return `<div class="task prio-${t.priority || 0} ${t.done ? 'done' : ''}">
    <button class="check round ${t.done ? 'on' : ''}" data-act="taskToggle" data-id="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${ic('check', 13, 'stroke-width="3"')}</button>
    <div class="tmain" data-act="taskEdit" data-id="${t.id}">
      <div class="ttitle">${esc(t.title)}</div>
      ${meta.trim() ? `<div class="tmeta">${meta}</div>` : ''}
      ${!compact && st.length && !t.done ? `<div class="subtasks">${st.map(s => `<div class="subtask ${s.done ? 'done' : ''}"><button class="check sm ${s.done ? 'on' : ''}" data-act="subToggle" data-id="${t.id}" data-sid="${s.id}" aria-label="Toggle subtask">${ic('check', 11, 'stroke-width="3"')}</button><span>${esc(s.title)}</span></div>`).join('')}</div>` : ''}
    </div>
    ${compact ? '' : `<div class="tact"><button class="btn-icon sm" data-act="taskEdit" data-id="${t.id}" aria-label="Edit">${ic('edit', 15)}</button><button class="btn-icon sm danger" data-act="taskDel" data-id="${t.id}" aria-label="Delete">${ic('trash', 15)}</button></div>`}
  </div>`;
}

function quickPreviewHtml(text) {
  if (!text.trim()) return `<span class="faint tiny">Tip: try “Pay rent friday !high #personal” — dates, <b>!priority</b> and <b>#list</b> are detected.</span>`;
  const p = parseQuick(text);
  return [
    p.due ? `<span class="chip">${ic('calendar', 12)} ${esc(relDay(p.due))}</span>` : '',
    p.priority ? `<span class="chip c" style="--c:${PRIOS[p.priority].color}">${ic('flag', 12)} ${PRIOS[p.priority].label}</span>` : '',
    p.list ? `<span class="chip c" style="--c:${listById(p.list).color}"># ${esc(listById(p.list).name)}</span>` : '',
  ].join('') || '<span class="faint tiny">Press Enter to add</span>';
}

App.views.tasks = {
  title: 'Tasks',
  render() {
    const ui = App.ui;
    ui.taskView ||= 'today';
    if (!['today', 'upcoming', 'anytime', 'all', 'done'].includes(ui.taskView) && !db().lists.some(l => l.id === ui.taskView)) ui.taskView = 'today';
    const view = ui.taskView;
    const q = (ui.taskQ || '').toLowerCase();
    const T = todayStr();
    const cnt = {
      today: db().tasks.filter(t => !t.done && t.due && t.due <= T).length,
      upcoming: db().tasks.filter(t => !t.done && t.due > T).length,
      anytime: db().tasks.filter(t => !t.done && !t.due).length,
      all: openTasks().length,
      done: db().tasks.filter(t => t.done).length,
    };
    const smart = [
      ['today', 'Today', 'sun'], ['upcoming', 'Upcoming', 'calendar'], ['anytime', 'Anytime', 'inbox'], ['all', 'All tasks', 'list'], ['done', 'Completed', 'check'],
    ];
    const side = `<div class="side-nav">
      ${smart.map(([id, label, icon]) => `<button class="${view === id ? 'on' : ''}" data-act="taskView" data-val="${id}">${ic(icon, 17)}${label}<span class="badge">${cnt[id]}</span></button>`).join('')}
      <div class="nav-label row between" style="padding-right:4px">Lists <button class="btn-icon sm" data-act="listNew" aria-label="New list">${ic('plus', 15)}</button></div>
      ${db().lists.map(l => `<button class="${view === l.id ? 'on' : ''}" data-act="taskView" data-val="${l.id}"><span class="dot" style="--c:${l.color}"></span><span class="truncate">${esc(l.name)}</span><span class="badge">${db().tasks.filter(t => t.list === l.id && !t.done).length}</span><span class="sn-edit btn-icon sm" data-act="listEdit" data-id="${l.id}" aria-label="Edit list">${ic('edit', 13)}</span></button>`).join('')}
    </div>`;

    let arr = taskFilter(view);
    const showDone = view === 'done' || cfg().taskShowDone;
    if (!showDone) arr = arr.filter(t => !t.done || (t.doneAt && Date.now() - t.doneAt < 4000));
    if (q) arr = arr.filter(t => (t.title + ' ' + (t.notes || '') + ' ' + (t.subtasks || []).map(s => s.title).join(' ')).toLowerCase().includes(q));
    if (ui.taskPrio) arr = arr.filter(t => String(t.priority || 0) === ui.taskPrio);
    arr = sortTasks(arr, cfg().taskSort);
    const groups = groupTasks(arr, view, cfg().taskGroup);
    const list = db().lists.find(l => l.id === view);
    const title = list ? list.name : smart.find(s => s[0] === view)[1];
    const sub = view === 'today' ? fmtLong(T) : list ? plural(db().tasks.filter(t => t.list === view && !t.done).length, 'open task') : plural(arr.filter(t => !t.done).length, 'open task');

    const body = groups.length && arr.length
      ? groups.map(g => `${g.label ? `<div class="group-h">${esc(g.label)} <span class="badge">${g.items.length}</span></div>` : ''}${g.items.map(t => taskRow(t)).join('')}`).join('')
      : view === 'today' ? emptyState('sun', q ? 'No matches' : 'All clear for today', q ? 'Try a different search.' : 'Nothing due today. Plan ahead or enjoy it.', '')
        : emptyState('tasks', q ? 'No matches' : 'No tasks here', q ? 'Try a different search.' : 'Add one above — it only takes a second.');

    return `<div class="split-l">
      <div>${side}</div>
      <div>
        <div class="page-head"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>
          <div class="actions">
            <label class="search-btn" style="min-width:0;padding:6px 10px;cursor:text">${ic('search', 16)}<input id="taskQ" data-input="taskQ" value="${esc(ui.taskQ || '')}" placeholder="Search tasks" style="border:0;outline:0;background:none;width:140px;color:var(--text)"></label>
            <button class="btn" data-act="taskOpts">${ic('sliders', 16)} View</button>
            ${view === 'done' && cnt.done ? `<button class="btn danger" data-act="taskClearDone">${ic('trash', 16)} Clear</button>` : ''}
          </div>
        </div>
        ${view !== 'done' ? `<div class="mb"><div class="quick-add">${ic('plus', 18, 'style="color:var(--text-3)"')}<input id="taskQuick" placeholder="Add a task…  (Enter)" data-enter="taskQuickAdd" data-input="taskQuickPreview" value="${esc(ui.taskQuickText || '')}" aria-label="Quick add task"><button class="btn btn-primary btn-sm" data-act="taskQuickAddBtn">Add</button></div><div class="qa-preview" id="qaPreview">${quickPreviewHtml(ui.taskQuickText || '')}</div></div>` : ''}
        ${ui.taskPrio ? `<div class="row mb-s"><span class="chip">Priority: ${PRIOS[ui.taskPrio].label} <button data-act="taskPrio" data-val="" aria-label="Clear">${ic('x', 12)}</button></span></div>` : ''}
        <div class="card" style="padding:8px">${body}</div>
      </div>
    </div>`;
  },
};

Object.assign(App.actions, {
  taskView: (el, e) => { if (e.target.closest('[data-act="listEdit"]')) return; App.ui.taskView = el.dataset.val; renderView(); },
  listNew: (el, e) => { e.stopPropagation(); openListForm(null); },
  listEdit: (el, e) => { e.stopPropagation(); openListForm(db().lists.find(l => l.id === el.dataset.id)); },
  taskQ: el => { App.ui.taskQ = el.value; renderView(); },
  taskQuickPreview: el => { App.ui.taskQuickText = el.value; const p = $('#qaPreview'); if (p) p.innerHTML = quickPreviewHtml(el.value); },
  taskQuickAdd: el => {
    const val = el.value.trim();
    if (!val) return;
    const extra = App.ui.taskView === 'today' ? { due: todayStr() } : {};
    const t = addTaskQuick(val, extra);
    if (t) { App.ui.taskQuickText = ''; renderView(); $('#taskQuick')?.focus(); toast(`Added “${t.title}”${t.due ? ' · ' + relDay(t.due) : ''}`, { type: 'success' }); }
  },
  taskQuickAddBtn: () => { const el = $('#taskQuick'); if (el) App.actions.taskQuickAdd(el); },
  taskToggle: el => toggleTask(el.dataset.id),
  taskEdit: el => openTaskForm(db().tasks.find(t => t.id === el.dataset.id)),
  taskDel: el => { const t = db().tasks.find(x => x.id === el.dataset.id); withUndo(`Deleted “${t.title}”`, s => { s.tasks = s.tasks.filter(x => x.id !== t.id); }); },
  subToggle: el => update(s => { const st = s.tasks.find(t => t.id === el.dataset.id)?.subtasks?.find(x => x.id === el.dataset.sid); if (st) st.done = !st.done; }),
  taskPrio: el => { App.ui.taskPrio = el.dataset.val; renderView(); },
  taskClearDone: async () => {
    const n = db().tasks.filter(t => t.done).length;
    if (await confirmDialog(`Permanently remove ${plural(n, 'completed task')}?`, { ok: 'Clear', danger: true })) withUndo('Completed tasks cleared', s => { s.tasks = s.tasks.filter(t => !t.done); });
  },
  taskOpts: el => {
    const s = cfg();
    const pick = (k, v) => () => update(x => { x.settings[k] = v; });
    openMenu(el, [
      { label: `Sort: due date${s.taskSort === 'due' ? ' ✓' : ''}`, icon: 'calendar', onClick: pick('taskSort', 'due') },
      { label: `Sort: priority${s.taskSort === 'priority' ? ' ✓' : ''}`, icon: 'flag', onClick: pick('taskSort', 'priority') },
      { label: `Sort: newest${s.taskSort === 'created' ? ' ✓' : ''}`, icon: 'clock', onClick: pick('taskSort', 'created') },
      { label: `Sort: A → Z${s.taskSort === 'alpha' ? ' ✓' : ''}`, icon: 'list', onClick: pick('taskSort', 'alpha') },
      '-',
      { label: `Group: automatic${s.taskGroup === 'auto' ? ' ✓' : ''}`, icon: 'layers', onClick: pick('taskGroup', 'auto') },
      { label: `Group: by list${s.taskGroup === 'list' ? ' ✓' : ''}`, icon: 'layers', onClick: pick('taskGroup', 'list') },
      { label: `Group: by date${s.taskGroup === 'date' ? ' ✓' : ''}`, icon: 'layers', onClick: pick('taskGroup', 'date') },
      { label: `Group: by priority${s.taskGroup === 'priority' ? ' ✓' : ''}`, icon: 'layers', onClick: pick('taskGroup', 'priority') },
      { label: `No grouping${s.taskGroup === 'none' ? ' ✓' : ''}`, icon: 'layers', onClick: pick('taskGroup', 'none') },
      '-',
      { label: 'Only high priority', icon: 'flag', color: 'var(--danger)', onClick: () => { App.ui.taskPrio = '3'; renderView(); } },
      { label: 'Show completed tasks', check: !!s.taskShowDone, onChange: v => update(x => { x.settings.taskShowDone = v; }) },
    ], { align: 'right' });
  },
});
