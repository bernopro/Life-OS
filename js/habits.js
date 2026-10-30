/* ============================================================
   Habits — check or count habits, daily / specific days /
   N-times-per-week schedules, streaks, heatmaps.
   ============================================================ */
'use strict';

const habitVal = (h, ds) => Number(h.log?.[ds]) || 0;
const habitGoal = h => h.type === 'count' ? Math.max(1, Number(h.goal) || 1) : 1;
const habitDone = (h, ds) => habitVal(h, ds) >= habitGoal(h);
function habitScheduled(h, ds) {
  if (h.schedule === 'days') return (h.days || []).includes(parseYmd(ds).getDay());
  return true; // daily and weekly both allow any day
}
function scheduleText(h) {
  if (h.schedule === 'days') {
    const names = weekdayNames().filter(w => (h.days || []).includes(w.d)).map(w => w.name);
    return names.length === 7 ? 'Every day' : names.length ? names.join(', ') : 'No days selected';
  }
  if (h.schedule === 'weekly') return `${h.perWeek || 1}× per week`;
  return 'Every day';
}
const activeHabits = () => db().habits.filter(h => !h.archived);
const habitsForDay = ds => activeHabits().filter(h => habitScheduled(h, ds) && (!h.created || ds >= h.created || habitVal(h, ds)));

function weekCount(h, weekStart) {
  let c = 0;
  for (let i = 0; i < 7; i++) if (habitDone(h, ymd(addDays(weekStart, i)))) c++;
  return c;
}
function habitStreak(h) {
  const created = h.created || '2000-01-01';
  if (h.schedule === 'weekly') {
    const target = Math.max(1, h.perWeek || 1);
    let wk = startOfWeek(new Date()), n = 0;
    if (weekCount(h, wk) >= target) n++;
    wk = addDays(wk, -7);
    while (n < 520 && ymd(addDays(wk, 6)) >= created && weekCount(h, wk) >= target) { n++; wk = addDays(wk, -7); }
    return { n, unit: n === 1 ? 'week' : 'weeks' };
  }
  let d = new Date(), n = 0;
  if (!habitDone(h, ymd(d))) d = addDays(d, -1); // today still pending doesn't break the streak
  for (let i = 0; i < 3660; i++) {
    const ds = ymd(d);
    if (ds < created) break;
    if (habitScheduled(h, ds)) { if (habitDone(h, ds)) n++; else break; }
    d = addDays(d, -1);
  }
  return { n, unit: n === 1 ? 'day' : 'days' };
}
function habitBest(h) {
  const keys = Object.keys(h.log || {}).filter(k => habitDone(h, k)).sort();
  if (!keys.length) return 0;
  if (h.schedule === 'weekly') {
    const target = Math.max(1, h.perWeek || 1);
    let wk = startOfWeek(parseYmd(keys[0])), best = 0, run = 0;
    const end = startOfWeek(new Date());
    while (wk <= end) { if (weekCount(h, wk) >= target) { run++; best = Math.max(best, run); } else if (ymd(wk) !== ymd(end)) run = 0; wk = addDays(wk, 7); }
    return best;
  }
  let best = 0, run = 0;
  let d = parseYmd(keys[0]);
  const T = todayStr();
  while (ymd(d) <= T) {
    const ds = ymd(d);
    if (habitScheduled(h, ds)) {
      if (habitDone(h, ds)) { run++; best = Math.max(best, run); }
      else if (ds !== T) run = 0;
    }
    d = addDays(d, 1);
  }
  return best;
}
function habitRate(h, days = 30) {
  const T = todayStr();
  const start = h.created && h.created > addDaysStr(T, -(days - 1)) ? h.created : addDaysStr(T, -(days - 1));
  const span = dayDiff(start, T) + 1;
  if (h.schedule === 'weekly') {
    let done = 0;
    for (let i = 0; i < span; i++) if (habitDone(h, addDaysStr(start, i))) done++;
    return clamp(done / Math.max(1, (span / 7) * (h.perWeek || 1)), 0, 1);
  }
  let sched = 0, done = 0;
  for (let i = 0; i < span; i++) {
    const ds = addDaysStr(start, i);
    if (!habitScheduled(h, ds)) continue;
    if (ds === T && !habitDone(h, ds)) continue; // don't penalise today yet
    sched++; if (habitDone(h, ds)) done++;
  }
  return sched ? done / sched : 0;
}

function habitTap(id, ds, delta = 1) {
  const h = db().habits.find(x => x.id === id);
  if (!h) return;
  if (ds > todayStr()) return;
  const before = habitDone(h, ds);
  update(s => {
    const x = s.habits.find(y => y.id === id);
    x.log ||= {};
    const g = habitGoal(x), v = Number(x.log[ds]) || 0;
    let nv;
    if (x.type === 'count') nv = delta > 0 ? (v >= g ? 0 : v + 1) : Math.max(0, v - 1);
    else nv = v ? 0 : 1;
    if (nv) x.log[ds] = nv; else delete x.log[ds];
  });
  const after = habitDone(db().habits.find(x => x.id === id), ds);
  if (!before && after) {
    const st = habitStreak(db().habits.find(x => x.id === id));
    if (ds === todayStr() && st.n > 1 && [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365].includes(st.n)) toast(`🔥 ${st.n}-${st.unit.replace(/s$/, '')} streak on “${h.name}”!`, { type: 'success' });
  }
}
function habitSet(id, ds, val) {
  update(s => { const x = s.habits.find(y => y.id === id); x.log ||= {}; if (val > 0) x.log[ds] = val; else delete x.log[ds]; });
}

function openHabitForm(h) {
  const isNew = !h;
  formModal({
    title: isNew ? 'New habit' : 'Edit habit',
    values: h || { name: '', emoji: '💪', color: PALETTE[8], type: 'check', goal: 8, unit: 'times', schedule: 'daily', days: [1, 2, 3, 4, 5], perWeek: 3, notes: '' },
    fields: [
      { key: 'name', label: 'Habit', required: true, placeholder: 'e.g. Read 20 minutes, Meditate, No sugar', autofocus: true },
      { key: 'emoji', label: 'Icon', type: 'emoji' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'type', label: 'Tracking', type: 'seg', options: [{ value: 'check', label: 'Yes / No' }, { value: 'count', label: 'Count' }] },
      { key: 'goal', label: 'Daily target', type: 'number', min: 1, max: 10000, half: true, showIf: v => v.type === 'count' },
      { key: 'unit', label: 'Unit', placeholder: 'glasses, pages, km…', half: true, showIf: v => v.type === 'count' },
      { key: 'schedule', label: 'Schedule', type: 'select', options: [{ value: 'daily', label: 'Every day' }, { value: 'days', label: 'Specific days of the week' }, { value: 'weekly', label: 'A number of times per week' }] },
      { key: 'days', label: 'On these days', type: 'days', showIf: v => v.schedule === 'days' },
      { key: 'perWeek', label: 'Times per week', type: 'number', min: 1, max: 7, showIf: v => v.schedule === 'weekly' },
      { key: 'notes', label: 'Why it matters (optional)', type: 'textarea', rows: 2 },
    ],
    onSave: v => {
      if (v.schedule === 'days' && !v.days.length) { toast('Pick at least one day', { type: 'error' }); return false; }
      v.goal = v.goal || 1; v.perWeek = clamp(v.perWeek || 1, 1, 7);
      if (!v.emoji) v.emoji = '✅';
      update(s => {
        if (isNew) s.habits.push({ id: uid(), created: todayStr(), archived: false, log: {}, ...v });
        else Object.assign(s.habits.find(x => x.id === h.id), v);
      });
      toast(isNew ? 'Habit created — you got this' : 'Habit saved', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo(`Deleted “${h.name}”`, s => { s.habits = s.habits.filter(x => x.id !== h.id); }),
    extraFoot: isNew ? '' : `<button type="button" class="btn btn-ghost" data-close onclick="App.actions.habitArchive({dataset:{id:'${h.id}'}})">${ic('archive', 16)} ${h.archived ? 'Restore' : 'Archive'}</button>`,
  });
}

function heatmapHtml(h, weeks = 26) {
  const end = startOfWeek(new Date());
  const start = addDays(end, -7 * (weeks - 1));
  const T = todayStr();
  let cells = '';
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
    const ds = ymd(addDays(start, w * 7 + d));
    if (ds > T) { cells += '<i class="fut"></i>'; continue; }
    const v = habitVal(h, ds), g = habitGoal(h);
    const l = v >= g ? 3 : v > 0 ? (v / g >= .5 ? 2 : 1) : 0;
    cells += `<i class="${l ? 'l' + l : ''} ${ds === T ? 'tdy' : ''}" title="${fmtDate(ds, { weekday: 'short', month: 'short', day: 'numeric' })}: ${h.type === 'count' ? v + ' / ' + g : (v ? 'done' : '—')}"></i>`;
  }
  return `<div class="heat" style="--c:${h.color}">${cells}</div>`;
}

function stripDays() {
  if (cfg().habitStrip === 'last7') return Array.from({ length: 7 }, (_, i) => addDaysStr(todayStr(), i - 6));
  const s = startOfWeek(new Date());
  return Array.from({ length: 7 }, (_, i) => ymd(addDays(s, i)));
}
function habitCard(h) {
  const T = todayStr();
  const st = habitStreak(h);
  const open = App.ui.habitOpen === h.id;
  const strip = stripDays().map(ds => {
    const v = habitVal(h, ds), g = habitGoal(h), done = v >= g;
    const sched = habitScheduled(h, ds);
    const cls = [done ? 'done' : v ? 'part' : '', !sched ? 'off' : '', ds === T ? 'tdy' : '', ds > T ? 'fut' : ''].join(' ');
    const label = h.type === 'count' ? (v || '') : (done ? ic('check', 15, 'stroke-width="3"') : '');
    return `<div class="ws-day"><small>${esc(parseYmd(ds).toLocaleDateString(undefined, { weekday: 'narrow' }))}</small><button class="ws-btn ${cls}" style="--c:${h.color};--p:${clamp(v / g, 0, 1) * 100}%" data-act="habitTap" data-id="${h.id}" data-date="${ds}" title="${esc(fmtDate(ds, { weekday: 'long', month: 'short', day: 'numeric' }))}${h.type === 'count' ? ` — ${v}/${g} ${esc(h.unit || '')}` : ''}" aria-label="Toggle ${esc(h.name)} on ${ds}">${label}</button></div>`;
  }).join('');
  const todayCtl = h.type === 'count' ? `<div class="count-ctl"><button class="btn-icon sm" data-act="habitDec" data-id="${h.id}" aria-label="Decrease">${ic('minus', 14)}</button><b>${habitVal(h, T)}/${habitGoal(h)}</b><button class="btn-icon sm" data-act="habitInc" data-id="${h.id}" aria-label="Increase">${ic('plus', 14)}</button></div>` : '';
  return `<div class="card habit-card" style="--c:${h.color}">
    <div class="habit-row">
      <div class="habit-id" data-act="habitOpen" data-id="${h.id}">
        <div class="habit-em">${esc(h.emoji || '✅')}</div>
        <div style="min-width:0"><div class="li-title truncate">${esc(h.name)}${h.archived ? ' <span class="chip">archived</span>' : ''}</div>
        <div class="li-sub">${esc(scheduleText(h))}${h.type === 'count' ? ` · ${habitGoal(h)} ${esc(h.unit || '')}` : ''}</div></div>
      </div>
      <div class="week-strip">${strip}</div>
      <div class="habit-stats">${todayCtl}
        <div class="stat"><span class="k">Streak</span><span class="v">${st.n > 0 ? '🔥' : ''}${st.n}</span></div>
        <div class="stat"><span class="k">30d</span><span class="v">${Math.round(habitRate(h) * 100)}%</span></div>
      </div>
    </div>
    ${open ? `<div class="habit-detail">
      <div class="row wrap between mb-s"><b>Last 6 months</b>
        <div class="row"><span class="faint small">Best streak: <b>${habitBest(h)}</b> ${h.schedule === 'weekly' ? 'weeks' : 'days'}</span>
        <span class="faint small">· Total: <b>${Object.keys(h.log || {}).filter(k => habitDone(h, k)).length}</b></span>
        <button class="btn btn-sm" data-act="habitEdit" data-id="${h.id}">${ic('edit', 14)} Edit</button></div></div>
      ${heatmapHtml(h)}
      ${h.notes ? `<p class="muted small mt-s">“${esc(h.notes)}”</p>` : ''}
    </div>` : ''}
  </div>`;
}

App.views.habits = {
  title: 'Habits',
  render() {
    const T = todayStr();
    const showArch = App.ui.habitArch;
    const hs = db().habits.filter(h => showArch ? h.archived : !h.archived);
    const todays = habitsForDay(T);
    const doneN = todays.filter(h => habitDone(h, T)).length;
    const best = activeHabits().map(h => ({ h, s: habitStreak(h) })).sort((a, b) => b.s.n - a.s.n)[0];
    const avg = activeHabits().length ? sum(activeHabits().map(h => habitRate(h))) / activeHabits().length : 0;
    // 30 day completion chart
    const pts = Array.from({ length: 30 }, (_, i) => {
      const ds = addDaysStr(T, i - 29);
      const list = habitsForDay(ds);
      return { label: fmtDate(ds), v: list.length ? Math.round(list.filter(h => habitDone(h, ds)).length / list.length * 100) : null };
    });
    return `
      <div class="page-head"><div><h2>Habits</h2><p>Small things, done often.</p></div>
        <div class="actions">
          ${seg('habitStrip', [{ value: 'week', label: 'This week' }, { value: 'last7', label: 'Last 7 days' }], cfg().habitStrip)}
          <button class="btn ${showArch ? 'btn-soft' : ''}" data-act="habitArchToggle">${ic('archive', 16)} ${showArch ? 'Showing archived' : 'Archived'}</button>
          <button class="btn btn-primary" data-act="habitNew">${ic('plus', 16)} New habit</button>
        </div></div>
      ${activeHabits().length ? `<div class="grid g4 mb">
        <div class="card stat-card">${ring(todays.length ? doneN / todays.length : 0, { size: 64, sw: 7, font: 14 })}<div class="stat"><span class="k">Today</span><span class="v">${doneN}/${todays.length}</span><span class="d">habits done</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#f97316">${ic('flame', 22)}</div><div class="stat"><span class="k">Best current streak</span><span class="v">${best ? best.s.n : 0}</span><span class="d truncate">${best && best.s.n ? esc(best.h.name) : '—'}</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#22c55e">${ic('trend', 22)}</div><div class="stat"><span class="k">30-day consistency</span><span class="v">${Math.round(avg * 100)}%</span><span class="d">across all habits</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#8b5cf6">${ic('check', 22)}</div><div class="stat"><span class="k">Check-ins</span><span class="v">${num(sum(db().habits.map(h => Object.keys(h.log || {}).filter(k => habitDone(h, k)).length)))}</span><span class="d">all time</span></div></div>
      </div>` : ''}
      <div class="col" style="gap:var(--gap)">
        ${hs.length ? hs.map(habitCard).join('') : `<div class="card">${showArch ? emptyState('archive', 'No archived habits', 'Archived habits keep their history but hide from your day.')
          : emptyState('flame', 'Build your first habit', 'Track anything: workouts, water, reading, meditation, waking up early… Streaks keep you going.', `<button class="btn btn-primary" data-act="habitNew">${ic('plus', 16)} New habit</button>`)}</div>`}
      </div>
      ${activeHabits().length ? `<div class="card mt"><div class="card-title">Daily completion <span class="card-sub">last 30 days</span></div>${chartSlot({ type: 'line', points: pts, min0: true, yMax: 100, fmt: v => Math.round(v) + '%', color: '#22c55e' })}</div>` : ''}`;
  },
};

Object.assign(App.actions, {
  habitNew: () => openHabitForm(null),
  habitEdit: el => openHabitForm(db().habits.find(h => h.id === el.dataset.id)),
  habitOpen: el => { App.ui.habitOpen = App.ui.habitOpen === el.dataset.id ? null : el.dataset.id; renderView(); },
  habitTap: el => habitTap(el.dataset.id, el.dataset.date || todayStr(), 1),
  habitInc: el => { const h = db().habits.find(x => x.id === el.dataset.id); habitSet(h.id, todayStr(), habitVal(h, todayStr()) + 1); },
  habitDec: el => { const h = db().habits.find(x => x.id === el.dataset.id); habitSet(h.id, todayStr(), Math.max(0, habitVal(h, todayStr()) - 1)); },
  habitArchive: el => update(s => { const h = s.habits.find(x => x.id === el.dataset.id); h.archived = !h.archived; toast(h.archived ? 'Habit archived' : 'Habit restored'); }),
  habitArchToggle: () => { App.ui.habitArch = !App.ui.habitArch; renderView(); },
  habitStrip: el => update(s => { s.settings.habitStrip = el.dataset.val; }),
});
