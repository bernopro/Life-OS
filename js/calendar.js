/* ============================================================
   Calendar — month / week / day / agenda, recurring events,
   layers for tasks, workouts and bills.
   ============================================================ */
'use strict';

const REPEATS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
];
const HOUR_H = 48;

function occursOn(ev, ds) {
  if (!ev.date || ds < ev.date) return false;
  if (ev.until && ds > ev.until) return false;
  if ((ev.skip || []).includes(ds)) return false;
  const r = ev.repeat || 'none';
  if (r === 'none') return ds === ev.date;
  const d = parseYmd(ds), s = parseYmd(ev.date);
  switch (r) {
    case 'daily': return true;
    case 'weekdays': { const w = d.getDay(); return w > 0 && w < 6; }
    case 'weekly': return d.getDay() === s.getDay();
    case 'biweekly': return d.getDay() === s.getDay() && dayDiff(ev.date, ds) % 14 === 0;
    case 'monthly': {
      // clamp e.g. the 31st to the last day of shorter months
      const want = Math.min(s.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
      return d.getDate() === want;
    }
    case 'yearly': return d.getMonth() === s.getMonth() && d.getDate() === s.getDate();
  }
  return false;
}
function eventsOn(ds) {
  return db().events.filter(e => occursOn(e, ds))
    .sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || (a.start || '').localeCompare(b.start || ''));
}
/** Everything that should appear on a day, honouring calendar layers. */
function calItemsOn(ds, layers = cfg().calLayers) {
  const items = [];
  if (layers.events) eventsOn(ds).forEach(e => items.push({ kind: 'event', id: e.id, title: e.title, color: e.color || PALETTE[0], allDay: !!e.allDay, start: e.start, end: e.end, ev: e }));
  if (layers.tasks && moduleOn('tasks')) db().tasks.filter(t => t.due === ds).forEach(t => items.push({ kind: 'task', id: t.id, title: t.title, color: listById(t.list).color, allDay: !t.dueTime, start: t.dueTime, end: t.dueTime ? minToTime(Math.min(1439, timeToMin(t.dueTime) + 30)) : null, done: t.done }));
  if (layers.workouts && moduleOn('fitness')) db().workouts.filter(w => w.date === ds).forEach(w => items.push({ kind: 'workout', id: w.id, title: trainingType(workoutType(w)).emoji + ' ' + (w.name || 'Workout'), color: trainingType(workoutType(w)).color, allDay: true }));
  if (layers.exams && moduleOn('study')) (db().exams || []).filter(x => x.date === ds).forEach(x => items.push({ kind: 'exam', id: x.id, title: '🎓 ' + x.title, color: subjectById(x.subjectId)?.color || '#8b5cf6', allDay: !x.time, start: x.time || '', end: x.time ? minToTime(Math.min(1439, timeToMin(x.time) + 60)) : null, done: x.done }));
  if (layers.bills && moduleOn('finance')) (db().bills || []).filter(b => billDueDate(b, monthKey(ds)) === ds).forEach(b => items.push({ kind: 'bill', id: b.id, title: '💳 ' + b.name, color: '#14b8a6', allDay: true, done: billPaid(b, monthKey(ds)) }));
  return items.sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || (a.start || '').localeCompare(b.start || ''));
}

function openEventForm(ev, defaults = {}) {
  const isNew = !ev;
  const now = new Date();
  const nextHour = minToTime(Math.min(23, now.getHours() + 1) * 60);
  const base = ev || {
    title: '', date: defaults.date || todayStr(), allDay: false,
    start: defaults.start || nextHour, end: defaults.end || minToTime(Math.min(1439, timeToMin(defaults.start || nextHour) + 60)),
    repeat: 'none', color: PALETTE[0], location: '', notes: '',
  };
  formModal({
    title: isNew ? 'New event' : 'Edit event',
    values: base,
    fields: [
      { key: 'title', label: 'Title', required: true, placeholder: 'e.g. Dentist, Team sync, Dinner with Sam', autofocus: true },
      { key: 'date', label: 'Date', type: 'date', required: true, half: true },
      { key: 'allDay', label: 'All-day', type: 'checkbox', half: true },
      { key: 'start', label: 'Starts', type: 'time', half: true, showIf: v => !v.allDay },
      { key: 'end', label: 'Ends', type: 'time', half: true, showIf: v => !v.allDay },
      { key: 'repeat', label: 'Repeat', type: 'select', options: REPEATS, half: true },
      { key: 'until', label: 'Repeat until (optional)', type: 'date', half: true, showIf: v => v.repeat !== 'none' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'location', label: 'Location', placeholder: 'Optional' },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
    ],
    onSave: v => {
      if (!v.allDay) {
        if (!v.start) { toast('Pick a start time or mark it all-day', { type: 'error' }); return false; }
        if (!v.end || v.end <= v.start) v.end = minToTime(Math.min(1439, timeToMin(v.start) + 60));
      }
      if (v.until && v.until < v.date) { toast('“Repeat until” must be after the start date', { type: 'error' }); return false; }
      if (v.repeat === 'none') v.until = '';
      update(s => {
        if (isNew) s.events.push({ id: uid(), skip: [], ...v });
        else Object.assign(s.events.find(e => e.id === ev.id), v);
      });
      toast(isNew ? 'Event added' : 'Event updated', { type: 'success' });
    },
    onDelete: isNew ? null : () => deleteEvent(ev.id, defaults.occurrence || ev.date),
  });
}
async function deleteEvent(id, occ) {
  const ev = db().events.find(e => e.id === id);
  if (!ev) return;
  if ((ev.repeat || 'none') !== 'none') {
    const scope = await choiceDialog('Delete repeating event', `“${ev.title}” repeats. What do you want to delete?`, [
      { label: 'Only this one', value: 'one' },
      { label: 'All events', value: 'all', cls: 'btn-danger' },
    ]);
    if (!scope) return;
    if (scope === 'one') {
      withUndo('Occurrence removed', s => { const e = s.events.find(x => x.id === id); e.skip = [...(e.skip || []), occ]; });
      return;
    }
  }
  withUndo('Event deleted', s => { s.events = s.events.filter(e => e.id !== id); });
}
function openCalItem(kind, id, date) {
  if (kind === 'event') { const ev = db().events.find(e => e.id === id); if (ev) openEventForm(ev, { occurrence: date }); }
  else if (kind === 'task') openTaskForm(db().tasks.find(t => t.id === id));
  else if (kind === 'workout') openWorkoutEditor(db().workouts.find(w => w.id === id));
  else if (kind === 'bill') openBillForm(db().bills.find(b => b.id === id));
  else if (kind === 'exam') openExamForm(db().exams.find(x => x.id === id));
}

/* ---------- View ---------- */
App.views.calendar = {
  title: 'Calendar',
  render() {
    const ui = App.ui;
    ui.calCursor ||= todayStr();
    ui.calSel ||= todayStr();
    const view = cfg().calView;
    const cur = parseYmd(ui.calCursor);
    let title;
    if (view === 'month') title = cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    else if (view === 'week') {
      const s = startOfWeek(cur), e = addDays(s, 6);
      title = s.getMonth() === e.getMonth()
        ? `${s.toLocaleDateString(undefined, { month: 'long' })} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
        : `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (view === 'day') title = fmtLong(ui.calCursor);
    else title = 'Upcoming';

    const L = cfg().calLayers;
    const layerBtn = (k, label) => `<button class="chip ${L[k] ? 'on' : ''}" data-act="calLayer" data-k="${k}">${label}</button>`;
    let body = '';
    if (view === 'month') body = `<div class="cal-wrap"><div>${monthHtml(cur)}</div>${dayPanel(ui.calSel)}</div>`;
    else if (view === 'week' || view === 'day') body = timeGridHtml(view === 'week' ? Array.from({ length: 7 }, (_, i) => ymd(addDays(startOfWeek(cur), i))) : [ui.calCursor]);
    else body = `<div class="card">${agendaHtml()}</div>`;

    return `
      <div class="cal-toolbar">
        <button class="btn" data-act="calToday">Today</button>
        <button class="btn-icon" data-act="calStep" data-d="-1" aria-label="Previous">${ic('left')}</button>
        <button class="btn-icon" data-act="calStep" data-d="1" aria-label="Next">${ic('right')}</button>
        <h2>${esc(title)}</h2>
        <span class="spacer"></span>
        ${seg('calView', [{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }, { value: 'agenda', label: 'Agenda' }], view)}
        <button class="btn btn-primary" data-act="calNew" data-date="${ui.calSel}">${ic('plus', 16)} Event</button>
      </div>
      <div class="row wrap mb-s" style="margin-top:-6px"><span class="faint small">Show:</span>
        <div class="layer-toggle">${layerBtn('events', 'Events')}${moduleOn('tasks') ? layerBtn('tasks', 'Tasks') : ''}${moduleOn('fitness') ? layerBtn('workouts', 'Workouts') : ''}${moduleOn('finance') ? layerBtn('bills', 'Bills') : ''}${moduleOn('study') ? layerBtn('exams', 'Exams & deadlines') : ''}</div>
      </div>
      ${body}`;
  },
  mount(el) {
    const sc = el.querySelector('.tscroll');
    if (sc) {
      if (App.ui.calScroll == null) App.ui.calScroll = (cfg().calStartHour ?? 7) * HOUR_H;
      sc.scrollTop = App.ui.calScroll;
      sc.addEventListener('scroll', () => { App.ui.calScroll = sc.scrollTop; }, { passive: true });
    }
  },
};

function chipHtml(it, ds) {
  const t = !it.allDay && it.start ? `<span class="num">${fmtTime(it.start).replace(':00', '').replace(' ', '').toLowerCase()}</span> ` : '';
  return `<div class="mchip ${it.done ? 'done' : ''}" style="--c:${it.color}" data-act="calOpen" data-kind="${it.kind}" data-id="${it.id}" data-date="${ds}" title="${esc(it.title)}">${t}${esc(it.title)}</div>`;
}
function monthHtml(cur) {
  const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const start = startOfWeek(first);
  const t = todayStr();
  let h = weekdayNames().map(w => `<div class="m-dow">${esc(w.name)}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), ds = ymd(d);
    if (i === 35 && d.getMonth() !== cur.getMonth()) break; // only 5 rows when the month fits
    const items = calItemsOn(ds);
    const max = 3;
    h += `<div class="mcell ${d.getMonth() !== cur.getMonth() ? 'out' : ''} ${ds === t ? 'today' : ''} ${ds === App.ui.calSel ? 'sel' : ''}" data-act="calPick" data-date="${ds}">
      <div class="mnum">${d.getDate()}</div>
      <button class="madd" data-act="calNew" data-date="${ds}" aria-label="Add event on ${ds}">${ic('plus', 14)}</button>
      <div class="mitems">${items.slice(0, max).map(it => chipHtml(it, ds)).join('')}${items.length > max ? `<div class="mmore">+${items.length - max} more</div>` : ''}</div>
    </div>`;
  }
  return `<div class="month">${h}</div>`;
}
function itemTimeLabel(it) {
  if (it.allDay) return it.kind === 'task' ? 'Due' : 'All day';
  return `${fmtTime(it.start)}${it.end && it.kind === 'event' ? ' – ' + fmtTime(it.end) : ''}`;
}
function dayPanel(ds) {
  const items = calItemsOn(ds);
  return `<div class="card">
    <div class="card-title">${esc(relDay(ds))}<span class="card-sub">${fmtDate(ds, { month: 'long', day: 'numeric' })}</span><span class="spacer"></span>
      <button class="btn btn-sm btn-soft" data-act="calNew" data-date="${ds}">${ic('plus', 14)} Add</button></div>
    ${items.length ? items.map(it => `<div class="ag-item" data-act="calOpen" data-kind="${it.kind}" data-id="${it.id}" data-date="${ds}">
        <span class="dot" style="--c:${it.color}"></span>
        <div class="grow" style="min-width:0;flex:1"><div class="truncate" style="font-weight:600;${it.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(it.title)}</div>
        <div class="faint tiny">${esc(itemTimeLabel(it))}${it.ev?.location ? ' · ' + esc(it.ev.location) : ''}${it.ev && it.ev.repeat !== 'none' ? ' · repeats' : ''}</div></div>
      </div>`).join('') : emptyState('calendar', 'Nothing planned', 'Enjoy the free time, or add something.', '', true)}
  </div>`;
}
function layoutLanes(evs) {
  // assign each timed event a lane so overlapping events sit side by side
  const sorted = [...evs].sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    cluster.forEach(ev => {
      let l = lanes.findIndex(end => end <= ev.s);
      if (l === -1) { l = lanes.length; lanes.push(ev.e); } else lanes[l] = ev.e;
      ev.lane = l;
    });
    cluster.forEach(ev => { ev.lanes = lanes.length; out.push(ev); });
    cluster = [];
  };
  sorted.forEach(ev => {
    if (ev.s >= clusterEnd && cluster.length) flush();
    cluster.push(ev); clusterEnd = Math.max(clusterEnd, ev.e);
  });
  if (cluster.length) flush();
  return out;
}
function timeGridHtml(days) {
  const t = todayStr();
  const cols = days.length;
  const head = `<div class="wk-head" style="--cols:${cols}"><div></div>${days.map(ds => {
    const d = parseYmd(ds);
    return `<div class="${ds === t ? 'today' : ''}" data-act="calGoDay" data-date="${ds}"><div class="dw">${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))}</div><div class="dn">${d.getDate()}</div></div>`;
  }).join('')}</div>`;
  const allDay = `<div class="wk-all" style="--cols:${cols}"><div>all-day</div>${days.map(ds => `<div>${calItemsOn(ds).filter(i => i.allDay).map(it => chipHtml(it, ds)).join('')}</div>`).join('')}</div>`;
  const labels = `<div class="tlabels">${Array.from({ length: 24 }, (_, h) => `<div>${h ? fmtTime(minToTime(h * 60)).replace(':00', '') : ''}</div>`).join('')}</div>`;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const colsHtml = days.map(ds => {
    const timed = calItemsOn(ds).filter(i => !i.allDay && i.start).map(i => {
      const s = timeToMin(i.start); let e = timeToMin(i.end) ?? s + 60;
      if (e <= s) e = Math.min(1440, s + 30);
      return { ...i, s, e };
    });
    const evs = layoutLanes(timed).map(i => {
      const top = i.s / 60 * HOUR_H, h = Math.max(22, (i.e - i.s) / 60 * HOUR_H - 2);
      const w = 100 / i.lanes;
      return `<div class="tev" style="--c:${i.color};top:${top}px;height:${h}px;left:calc(${i.lane * w}% + 2px);width:calc(${w}% - 4px);${i.done ? 'opacity:.55' : ''}" data-act="calOpen" data-kind="${i.kind}" data-id="${i.id}" data-date="${ds}" title="${esc(i.title)}"><b>${esc(i.title)}</b>${h > 34 ? `<span>${fmtTime(i.start)}${i.kind === 'event' ? ' – ' + fmtTime(i.end) : ''}</span>` : ''}</div>`;
    }).join('');
    const nowLine = ds === t ? `<div class="now-line" style="top:${nowMin / 60 * HOUR_H}px"></div>` : '';
    return `<div class="tcol ${ds === t ? 'today' : ''}" data-act="calSlot" data-date="${ds}" style="height:${24 * HOUR_H}px">${evs}${nowLine}</div>`;
  }).join('');
  return `<div class="week" style="--hh:${HOUR_H}px">${head}${allDay}<div class="tscroll" data-keep-scroll="cal"><div class="tgrid" style="--cols:${cols}">${labels}${colsHtml}</div></div></div>`;
}
function agendaHtml() {
  const t = todayStr();
  let out = '';
  for (let i = 0; i < 60; i++) {
    const ds = addDaysStr(t, i);
    const items = calItemsOn(ds);
    if (!items.length) continue;
    const d = parseYmd(ds);
    out += `<div class="agenda-day"><div class="agenda-date ${i === 0 ? 'today' : ''}"><b>${d.getDate()}</b><span>${esc(d.toLocaleDateString(undefined, { weekday: 'short', month: 'short' }))}</span><div class="faint tiny">${i < 2 ? relDay(ds) : ''}</div></div>
      <div>${items.map(it => `<div class="ag-item" data-act="calOpen" data-kind="${it.kind}" data-id="${it.id}" data-date="${ds}"><span class="time">${esc(itemTimeLabel(it))}</span><span class="dot" style="--c:${it.color}"></span><span class="truncate" style="font-weight:600;${it.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(it.title)}</span></div>`).join('')}</div></div>`;
  }
  return out || emptyState('calendar', 'Nothing in the next 60 days', 'Add an event to see it here.', `<button class="btn btn-primary" data-act="calNew" data-date="${t}">${ic('plus', 16)} New event</button>`);
}

/* ---------- Actions ---------- */
Object.assign(App.actions, {
  calView: el => { update(s => { s.settings.calView = el.dataset.val; }); },
  calToday: () => { App.ui.calCursor = App.ui.calSel = todayStr(); App.ui.calScroll = null; renderView(); },
  calStep: el => {
    const d = Number(el.dataset.d), v = cfg().calView, c = parseYmd(App.ui.calCursor);
    if (v === 'month') { c.setDate(1); c.setMonth(c.getMonth() + d); }
    else if (v === 'week') c.setDate(c.getDate() + 7 * d);
    else if (v === 'day') c.setDate(c.getDate() + d);
    else return;
    App.ui.calCursor = ymd(c);
    if (v !== 'month') App.ui.calSel = ymd(c);
    renderView();
  },
  calPick: el => { App.ui.calSel = el.dataset.date; renderView(); },
  calGoDay: el => { App.ui.calCursor = App.ui.calSel = el.dataset.date; update(s => { s.settings.calView = 'day'; }); },
  calNew: (el, e) => { e.stopPropagation(); openEventForm(null, { date: el.dataset.date || todayStr() }); },
  calOpen: (el, e) => { e.stopPropagation(); openCalItem(el.dataset.kind, el.dataset.id, el.dataset.date); },
  calSlot: (el, e) => {
    if (e.target !== el) return;
    const y = e.clientY - el.getBoundingClientRect().top;
    const min = clamp(Math.floor(y / HOUR_H * 2) * 30, 0, 1410);
    openEventForm(null, { date: el.dataset.date, start: minToTime(min), end: minToTime(Math.min(1439, min + 60)) });
  },
  calLayer: el => { update(s => { s.settings.calLayers[el.dataset.k] = !s.settings.calLayers[el.dataset.k]; }); },
});
