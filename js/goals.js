/* ============================================================
   Goals — numeric targets or milestone checklists, deadlines,
   pace tracking.
   ============================================================ */
'use strict';

function goalPct(g) {
  if (g.type === 'milestones') { const m = g.milestones || []; return m.length ? m.filter(x => x.done).length / m.length : (g.done ? 1 : 0); }
  const start = Number(g.start) || 0, target = Number(g.target), cur = Number(g.current) || 0;
  if (!target && target !== 0 || target === start) return g.done ? 1 : 0;
  return clamp((cur - start) / (target - start), 0, 1);
}
const goalComplete = g => g.done || goalPct(g) >= 1;
function goalPace(g) {
  if (!g.deadline || goalComplete(g)) return null;
  const created = g.created ? ymd(new Date(g.created)) : todayStr();
  const total = Math.max(1, dayDiff(created, g.deadline));
  const elapsed = clamp(dayDiff(created, todayStr()), 0, total);
  const expected = elapsed / total;
  const left = dayDiff(todayStr(), g.deadline);
  return { expected, left, onTrack: goalPct(g) + 0.05 >= expected };
}

function openGoalForm(g) {
  const isNew = !g;
  formModal({
    title: isNew ? 'New goal' : 'Edit goal',
    values: g || { title: '', category: cfg().goalCats[0], type: 'number', start: 0, current: 0, target: '', unit: '', deadline: '', color: PALETTE[0], why: '', milestones: [] },
    fields: [
      { key: 'title', label: 'Goal', required: true, placeholder: 'e.g. Run a half marathon, Save $5,000, Read 24 books', autofocus: true },
      { key: 'category', label: 'Area of life', type: 'select', options: () => cfg().goalCats, half: true },
      { key: 'deadline', label: 'Deadline (optional)', type: 'date', half: true },
      { key: 'type', label: 'Measure progress by', type: 'seg', options: [{ value: 'number', label: 'A number' }, { value: 'milestones', label: 'Milestones' }] },
      { key: 'start', label: 'Starting value', type: 'number', step: 'any', third: true, showIf: v => v.type === 'number' },
      { key: 'current', label: 'Current', type: 'number', step: 'any', third: true, showIf: v => v.type === 'number' },
      { key: 'target', label: 'Target', type: 'number', step: 'any', third: true, required: true, showIf: v => v.type === 'number' },
      { key: 'unit', label: 'Unit', placeholder: 'kg, books, $, km…', showIf: v => v.type === 'number' },
      { key: 'milestones', label: 'Milestones', type: 'checklist', showIf: v => v.type === 'milestones' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'why', label: 'Why does this matter?', type: 'textarea', rows: 2, placeholder: 'Your reason keeps you going on hard days.' },
    ],
    onSave: v => {
      if (v.type === 'number' && v.target === v.start) { toast('Target must be different from the starting value', { type: 'error' }); return false; }
      if (v.type === 'milestones' && !v.milestones.length) { toast('Add at least one milestone', { type: 'error' }); return false; }
      update(s => {
        if (isNew) s.goals.push({ id: uid(), created: Date.now(), done: false, log: [], ...v });
        else Object.assign(s.goals.find(x => x.id === g.id), v);
      });
      toast(isNew ? 'Goal set — go get it 🎯' : 'Goal saved', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo('Goal deleted', s => { s.goals = s.goals.filter(x => x.id !== g.id); }),
  });
}
function openGoalProgress(g) {
  formModal({
    title: `Update: ${g.title}`, size: 'sm',
    values: { mode: 'set', value: g.current },
    fields: [
      { key: 'mode', label: '', type: 'seg', options: [{ value: 'set', label: 'Set to' }, { value: 'add', label: 'Add' }] },
      { key: 'value', label: g.unit ? `Value (${g.unit})` : 'Value', type: 'number', step: 'any', required: true, autofocus: true },
    ],
    submit: 'Update',
    onSave: v => {
      const was = goalComplete(g);
      update(s => {
        const x = s.goals.find(y => y.id === g.id);
        x.current = v.mode === 'add' ? (Number(x.current) || 0) + v.value : v.value;
        x.log = [...(x.log || []), { date: todayStr(), v: x.current }];
      });
      const now = db().goals.find(y => y.id === g.id);
      if (!was && goalComplete(now)) toast('🎉 Goal achieved! Incredible.', { type: 'success', ms: 6000 });
    },
  });
}
function goalCard(g) {
  const p = goalPct(g), pace = goalPace(g), done = goalComplete(g);
  return `<div class="card goal-card" style="--c:${g.color}">
    <div class="row between" style="align-items:flex-start"><div style="min-width:0"><span class="chip c" style="--c:${g.color}">${esc(g.category)}</span><h4 class="mt-s">${esc(g.title)}</h4></div>
      <button class="btn-icon sm" data-act="goalEdit" data-id="${g.id}" aria-label="Edit goal">${ic('edit', 15)}</button></div>
    <div class="row between" style="align-items:flex-end"><span class="goal-pct">${Math.round(p * 100)}%</span>
      <span class="faint small num">${g.type === 'number' ? `${num(g.current, 2)} / ${num(g.target, 2)} ${esc(g.unit || '')}` : `${(g.milestones || []).filter(m => m.done).length} / ${(g.milestones || []).length} milestones`}</span></div>
    ${bar(p, g.color, 'thick')}
    ${g.type === 'milestones' ? `<div class="ms-list">${(g.milestones || []).map(m => `<div class="ms ${m.done ? 'done' : ''}" data-act="goalMs" data-id="${g.id}" data-mid="${m.id}"><span class="check sm ${m.done ? 'on' : ''}">${ic('check', 11, 'stroke-width="3"')}</span><span>${esc(m.title)}</span></div>`).join('')}</div>` : ''}
    <div class="row wrap" style="gap:8px">
      ${done ? `<span class="chip c" style="--c:var(--success)">${ic('trophy', 12)} Achieved</span>`
        : pace ? `<span class="chip c" style="--c:${pace.left < 0 ? 'var(--danger)' : pace.onTrack ? 'var(--success)' : 'var(--warn)'}">${pace.left < 0 ? `${-pace.left}d overdue` : pace.onTrack ? 'On track' : 'Behind pace'}</span><span class="faint small">${pace.left >= 0 ? plural(pace.left, 'day') + ' left' : ''}</span>` : '<span class="faint small">No deadline</span>'}
      <span class="spacer"></span>
      ${!done && g.type === 'number' ? `<button class="btn btn-sm btn-soft" data-act="goalUpd" data-id="${g.id}">${ic('plus', 14)} Update</button>` : ''}
      ${!done && g.type === 'number' ? '' : ''}
      ${done && !g.done ? `<button class="btn btn-sm" data-act="goalDone" data-id="${g.id}">Archive</button>` : ''}
      ${!done ? `<button class="btn btn-sm btn-ghost" data-act="goalDone" data-id="${g.id}" title="Mark complete">${ic('check', 14)}</button>` : g.done ? `<button class="btn btn-sm btn-ghost" data-act="goalDone" data-id="${g.id}">Reopen</button>` : ''}
    </div>
    ${g.why ? `<p class="faint small" style="font-style:italic">“${esc(g.why)}”</p>` : ''}
  </div>`;
}

App.views.goals = {
  title: 'Goals',
  render() {
    const f = App.ui.goalF || 'active';
    const cat = App.ui.goalCat || '';
    let list = db().goals.filter(g => f === 'all' || (f === 'active' ? !g.done : g.done));
    if (cat) list = list.filter(g => g.category === cat);
    list.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    const active = db().goals.filter(g => !g.done);
    const avg = active.length ? sum(active.map(goalPct)) / active.length : 0;
    const cats = [...new Set(db().goals.map(g => g.category))];
    return `<div class="page-head"><div><h2>Goals</h2><p>${active.length ? `${plural(active.length, 'active goal')} · ${Math.round(avg * 100)}% average progress` : 'Dream big, track small.'}</p></div>
      <div class="actions">${seg('goalF', [{ value: 'active', label: 'Active' }, { value: 'done', label: 'Completed' }, { value: 'all', label: 'All' }], f)}
      <button class="btn btn-primary" data-act="goalNew">${ic('plus', 16)} New goal</button></div></div>
      ${cats.length > 1 ? `<div class="row wrap mb" style="gap:6px"><button class="chip ${!cat ? 'on' : ''}" data-act="goalCat" data-c="">All areas</button>${cats.map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-act="goalCat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
      ${list.length ? `<div class="grid g3">${list.map(goalCard).join('')}</div>`
        : `<div class="card">${emptyState('target', f === 'done' ? 'No completed goals yet' : 'No goals yet', f === 'done' ? 'Finished goals will show up here.' : 'Set a goal for any area of life and track progress with numbers or milestones.', f === 'done' ? '' : `<button class="btn btn-primary" data-act="goalNew">${ic('plus', 16)} New goal</button>`)}</div>`}`;
  },
};

Object.assign(App.actions, {
  goalNew: () => openGoalForm(null),
  goalEdit: el => openGoalForm(db().goals.find(g => g.id === el.dataset.id)),
  goalUpd: el => openGoalProgress(db().goals.find(g => g.id === el.dataset.id)),
  goalMs: el => {
    const g = db().goals.find(x => x.id === el.dataset.id);
    const was = goalComplete(g);
    update(s => { const m = s.goals.find(x => x.id === el.dataset.id).milestones.find(x => x.id === el.dataset.mid); m.done = !m.done; });
    if (!was && goalComplete(db().goals.find(x => x.id === el.dataset.id))) toast('🎉 Goal achieved!', { type: 'success', ms: 5000 });
  },
  goalDone: el => update(s => { const g = s.goals.find(x => x.id === el.dataset.id); g.done = !g.done; g.doneAt = g.done ? Date.now() : null; toast(g.done ? 'Goal completed & archived 🏆' : 'Goal reopened'); }),
  goalF: el => { App.ui.goalF = el.dataset.val; renderView(); },
  goalCat: el => { App.ui.goalCat = el.dataset.c; renderView(); },
});
