/* ============================================================
   Nutrition, water & sleep
   ============================================================ */
'use strict';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const guessMeal = () => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks'; };
const mealTotals = m => { const k = Number(m.servings) || 1; return { cal: (Number(m.cal) || 0) * k, p: (Number(m.p) || 0) * k, c: (Number(m.c) || 0) * k, f: (Number(m.f) || 0) * k }; };
function dayNutrition(ds) {
  const t = { cal: 0, p: 0, c: 0, f: 0 };
  db().meals.filter(m => m.date === ds).forEach(m => { const x = mealTotals(m); t.cal += x.cal; t.p += x.p; t.c += x.c; t.f += x.f; });
  return t;
}
const waterOn = ds => Number(db().water[ds]) || 0;
function waterAdd(delta, ds = todayStr()) {
  update(s => { const v = Math.max(0, Math.round(((Number(s.water[ds]) || 0) + delta) * 100) / 100); if (v) s.water[ds] = v; else delete s.water[ds]; });
  if (delta > 0 && waterOn(ds) >= cfg().waterGoal && waterOn(ds) - delta < cfg().waterGoal) toast('💧 Water goal reached!', { type: 'success' });
}
function sleepHours(e) {
  const b = timeToMin(e.bed), w = timeToMin(e.wake);
  if (b == null || w == null) return Number(e.hours) || 0;
  return ((w - b + 1440) % 1440) / 60;
}
const sortedSleep = () => [...db().sleep].sort((a, b) => b.date.localeCompare(a.date));

function rememberFood(m) {
  const s = db();
  const key = m.name.trim().toLowerCase();
  const f = s.foods.find(x => x.name.toLowerCase() === key);
  const data = { name: m.name.trim(), cal: m.cal, p: m.p, c: m.c, f: m.f };
  if (f) { Object.assign(f, data); f.uses = (f.uses || 0) + 1; f.last = Date.now(); }
  else s.foods.push({ id: uid(), uses: 1, last: Date.now(), ...data });
}
function refreshFoodList() { const dl = $('#foodlist'); if (dl) dl.innerHTML = db().foods.map(f => `<option value="${esc(f.name)}">`).join(''); }

function openFoodForm(meal, defaults = {}) {
  const isNew = !meal;
  refreshFoodList();
  formModal({
    title: isNew ? 'Add food' : 'Edit food',
    values: meal || { name: '', meal: defaults.meal || guessMeal(), date: defaults.date || todayStr(), cal: '', p: '', c: '', f: '', servings: 1 },
    fields: [
      { key: 'name', label: 'Food', required: true, placeholder: 'e.g. Chicken & rice, Greek yogurt', list: 'foodlist', autofocus: true, hint: 'Foods you log are remembered — pick one to auto-fill.' },
      { key: 'meal', label: 'Meal', type: 'seg', options: MEALS },
      { key: 'date', label: 'Date', type: 'date', half: true, required: true },
      { key: 'servings', label: 'Servings', type: 'number', step: 'any', min: 0.1, max: 100, half: true },
      { key: 'cal', label: 'Calories (per serving)', type: 'number', min: 0, max: 20000, step: 'any', required: true },
      { key: 'p', label: 'Protein g', type: 'number', min: 0, step: 'any', third: true },
      { key: 'c', label: 'Carbs g', type: 'number', min: 0, step: 'any', third: true },
      { key: 'f', label: 'Fat g', type: 'number', min: 0, step: 'any', third: true },
    ],
    onMount: form => {
      const nameInp = form.querySelector('[name=name]');
      const fill = () => {
        const f = db().foods.find(x => x.name.toLowerCase() === nameInp.value.trim().toLowerCase());
        if (!f) return;
        ['cal', 'p', 'c', 'f'].forEach(k => { const i = form.querySelector(`[name=${k}]`); if (i && (i.value === '' || isNew)) i.value = f[k] ?? ''; });
      };
      nameInp.addEventListener('change', fill);
      nameInp.addEventListener('input', () => { if (db().foods.some(x => x.name === nameInp.value)) fill(); });
    },
    onSave: v => {
      v.servings = v.servings || 1;
      ['p', 'c', 'f'].forEach(k => { v[k] = v[k] || 0; });
      update(s => {
        if (isNew) s.meals.push({ id: uid(), ...v }); else Object.assign(s.meals.find(m => m.id === meal.id), v);
        rememberFood(v);
      });
      toast(isNew ? `Logged ${v.name}` : 'Saved', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo('Food removed', s => { s.meals = s.meals.filter(m => m.id !== meal.id); }),
  });
}
function openSleepForm(entry) {
  const isNew = !entry;
  formModal({
    title: isNew ? 'Log sleep' : 'Edit sleep',
    values: entry || { date: todayStr(), bed: '23:00', wake: '07:00', quality: 3, notes: '' },
    fields: [
      { key: 'date', label: 'Morning of', type: 'date', required: true, hint: 'The day you woke up.' },
      { key: 'bed', label: 'Went to bed', type: 'time', half: true, required: true },
      { key: 'wake', label: 'Woke up', type: 'time', half: true, required: true },
      { key: 'quality', label: 'Quality', type: 'seg', options: [{ value: 1, label: '😫' }, { value: 2, label: '😕' }, { value: 3, label: '😐' }, { value: 4, label: '🙂' }, { value: 5, label: '🤩' }] },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 2, placeholder: 'Dreams, caffeine, screens before bed…' },
    ],
    onSave: v => {
      v.quality = Number(v.quality) || 3;
      update(s => {
        if (isNew) {
          const ex = s.sleep.find(x => x.date === v.date);
          if (ex) Object.assign(ex, v); else s.sleep.push({ id: uid(), ...v });
        } else Object.assign(s.sleep.find(x => x.id === entry.id), v);
      });
      toast(`Logged ${fmtDuration(sleepHours(v) * 60)} of sleep`, { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo('Sleep entry removed', s => { s.sleep = s.sleep.filter(x => x.id !== entry.id); }),
  });
}

App.views.health = {
  title: 'Nutrition & Sleep',
  render() {
    const tab = App.ui.healthTab || 'nutrition';
    App.ui.healthDate ||= todayStr();
    return `<div class="page-head"><div><h2>Nutrition & Sleep</h2><p>Fuel, hydrate, recover.</p></div>
      <div class="actions">${tab !== 'sleep' ? dateNav('healthDay', App.ui.healthDate) : ''}</div></div>
      ${tabs('healthTab', [{ value: 'nutrition', label: 'Food', icon: 'utensils' }, { value: 'water', label: 'Water', icon: 'droplet' }, { value: 'sleep', label: 'Sleep', icon: 'moon' }], tab)}
      ${({ nutrition: nutritionTab, water: waterTab, sleep: sleepTab }[tab] || nutritionTab)()}`;
  },
};
function macroBar(label, val, goal, color) {
  return `<div class="macro"><div class="row between"><span><span class="dot" style="--c:${color}"></span> ${label}</span><span class="num faint"><b style="color:var(--text)">${num(val)}</b> / ${num(goal)} g</span></div>${bar(goal ? val / goal : 0, color, 'cap')}</div>`;
}
function nutritionTab() {
  const ds = App.ui.healthDate, s = cfg();
  const t = dayNutrition(ds);
  const meals = db().meals.filter(m => m.date === ds);
  const left = s.calorieGoal - t.cal;
  const favs = [...db().foods].sort((a, b) => (b.uses || 0) - (a.uses || 0) || (b.last || 0) - (a.last || 0)).slice(0, 14);
  const pts = Array.from({ length: 14 }, (_, i) => { const d = addDaysStr(ds, i - 13); return { label: fmtDate(d), v: Math.round(dayNutrition(d).cal) }; });
  const yest = db().meals.filter(m => m.date === addDaysStr(ds, -1));
  return `<div class="split">
    <div>
      <div class="card mb"><div class="row wrap" style="gap:28px">
        ${ring(t.cal / s.calorieGoal, { size: 132, sw: 12, color: t.cal > s.calorieGoal ? 'var(--danger)' : '#22c55e', center: num(t.cal), sub: 'kcal eaten', font: 26 })}
        <div class="col grow" style="flex:1;min-width:220px;gap:12px">
          <div class="row" style="gap:24px"><div class="stat"><span class="k">Goal</span><span class="v" style="font-size:1.25rem">${num(s.calorieGoal)}</span></div>
          <div class="stat"><span class="k">${left >= 0 ? 'Remaining' : 'Over'}</span><span class="v ${left < 0 ? 'danger-text' : 'success-text'}" style="font-size:1.25rem">${num(Math.abs(left))}</span></div></div>
          ${macroBar('Protein', t.p, s.proteinGoal, '#ef4444')}${macroBar('Carbs', t.c, s.carbGoal, '#f59e0b')}${macroBar('Fat', t.f, s.fatGoal, '#3b82f6')}
        </div></div></div>
      <div class="card">
        ${MEALS.map(meal => {
          const list = meals.filter(m => m.meal === meal);
          const kc = sum(list.map(m => mealTotals(m).cal));
          return `<div class="meal-sec"><div class="meal-h">${esc(meal)} <span class="muted">${kc ? num(kc) + ' kcal' : ''}</span><span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="foodNew" data-meal="${meal}">${ic('plus', 14)} Add</button></div>
            ${list.map(m => { const x = mealTotals(m); return `<div class="li click" data-act="foodEdit" data-id="${m.id}"><div class="grow"><div class="li-title">${esc(m.name)}${m.servings && m.servings !== 1 ? ` <span class="faint small">× ${num(m.servings, 2)}</span>` : ''}</div><div class="li-sub">P ${num(x.p)}g · C ${num(x.c)}g · F ${num(x.f)}g</div></div><b class="num">${num(x.cal)}</b><span class="faint tiny">kcal</span></div>`; }).join('') || `<div class="faint small" style="padding:2px 0 8px">Nothing logged</div>`}
          </div>`;
        }).join('')}
      </div>
    </div>
    <div>
      <div class="card mb"><div class="card-title">${ic('star', 16)} Quick add <span class="card-sub">tap to log</span></div>
        ${favs.length ? `<div class="food-chips">${favs.map(f => `<button class="chip" data-act="foodQuick" data-id="${f.id}" title="${num(f.cal)} kcal · P${num(f.p)} C${num(f.c)} F${num(f.f)}">${esc(f.name)} <span class="faint">${num(f.cal)}</span></button>`).join('')}</div>`
          : '<p class="faint small">Foods you log appear here for one-tap logging.</p>'}
        ${yest.length && !meals.length ? `<button class="btn btn-sm btn-block mt" data-act="foodCopyYest">${ic('copy', 14)} Copy ${plural(yest.length, 'item')} from the day before</button>` : ''}
      </div>
      <div class="card"><div class="card-title">Calories <span class="card-sub">14 days</span></div>
        ${chartSlot({ type: 'bar', labels: pts.map(p => p.label), series: [{ name: 'kcal', values: pts.map(p => p.v), color: v => v > s.calorieGoal ? '#ef4444' : '#22c55e' }], goal: s.calorieGoal, fmt: v => num(v) })}
        <div class="row mt-s"><span class="faint small">Avg (days logged): <b>${(() => { const l = pts.filter(p => p.v > 0); return l.length ? num(sum(l.map(p => p.v)) / l.length) : '—'; })()}</b> kcal</span><span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="goTo" data-route="settings" data-sec="goals">Edit goals</button></div>
      </div>
    </div>
  </div>`;
}
function waterTab() {
  const ds = App.ui.healthDate, s = cfg();
  const v = waterOn(ds), g = s.waterGoal || 8;
  const pts = Array.from({ length: 14 }, (_, i) => { const d = addDaysStr(ds, i - 13); return { label: fmtDate(d), v: waterOn(d) }; });
  const ml = Math.round(v * s.glassMl);
  return `<div class="split">
    <div class="card"><div class="water-big">
      <div class="bottle"><div class="fill" style="height:${clamp(v / g, 0, 1) * 100}%"></div><div class="lvl">${Math.round(clamp(v / g, 0, 9.99) * 100)}%</div></div>
      <div class="col" style="gap:14px;flex:1;min-width:220px">
        <div class="stat"><span class="k">${esc(relDay(ds))}</span><span class="v">${num(v, 1)} <span class="faint" style="font-size:1rem">/ ${g} glasses</span></span><span class="d">${ml >= 1000 ? num(ml / 1000, 2) + ' L' : ml + ' ml'} · ${s.glassMl} ml per glass</span></div>
        <div class="glasses">${Array.from({ length: Math.max(g, Math.ceil(v)) }, (_, i) => `<button class="glass ${i < v ? 'full' : ''}" data-act="waterSet" data-v="${i + 1}" aria-label="Set ${i + 1} glasses"></button>`).join('')}</div>
        <div class="row wrap"><button class="btn btn-primary" data-act="waterAdd" data-v="1">${ic('plus', 16)} 1 glass</button><button class="btn" data-act="waterAdd" data-v="0.5">+ ½</button><button class="btn" data-act="waterAdd" data-v="-1">${ic('minus', 16)}</button><button class="btn btn-ghost" data-act="waterCustom">Custom ml…</button></div>
      </div></div></div>
    <div class="card"><div class="card-title">Last 14 days</div>
      ${chartSlot({ type: 'bar', labels: pts.map(p => p.label), series: [{ name: 'Glasses', values: pts.map(p => p.v), color: x => x >= g ? '#3b82f6' : '#93c5fd' }], goal: g, fmt: x => num(x, 1) })}
      <p class="faint small mt-s">Goal hit on <b>${pts.filter(p => p.v >= g).length}</b> of 14 days.</p></div>
  </div>`;
}
function sleepTab() {
  const list = sortedSleep();
  const goal = cfg().sleepGoal || 8;
  const pts = Array.from({ length: 14 }, (_, i) => { const d = addDaysStr(todayStr(), i - 13); const e = db().sleep.find(x => x.date === d); return { label: fmtDate(d), v: e ? Math.round(sleepHours(e) * 10) / 10 : null }; });
  const last7 = list.filter(e => e.date > addDaysStr(todayStr(), -7));
  const avg = last7.length ? sum(last7.map(sleepHours)) / last7.length : 0;
  const avgQ = last7.length ? sum(last7.map(e => e.quality || 3)) / last7.length : 0;
  const debt = last7.length ? sum(last7.map(e => goal - sleepHours(e))) : 0;
  const bedMins = last7.map(e => { const m = timeToMin(e.bed); return m < 720 ? m + 1440 : m; });
  const avgBed = bedMins.length ? minToTime(Math.round(sum(bedMins) / bedMins.length) % 1440) : null;
  return `<div class="grid g4 mb">
    <div class="card stat"><span class="k">Last night</span><span class="v">${list[0] ? fmtDuration(sleepHours(list[0]) * 60) : '—'}</span><span class="d">${list[0] ? relDay(list[0].date) : 'no entries'}</span></div>
    <div class="card stat"><span class="k">7-day average</span><span class="v">${avg ? num(avg, 1) + 'h' : '—'}</span><span class="d">goal ${goal}h</span></div>
    <div class="card stat"><span class="k">Sleep ${debt >= 0 ? 'debt' : 'surplus'} (7d)</span><span class="v ${debt > 3 ? 'danger-text' : ''}">${last7.length ? num(Math.abs(debt), 1) + 'h' : '—'}</span><span class="d">vs. goal</span></div>
    <div class="card stat"><span class="k">Avg bedtime</span><span class="v">${avgBed ? fmtTime(avgBed) : '—'}</span><span class="d">quality ${avgQ ? num(avgQ, 1) + '/5' : '—'}</span></div>
  </div>
  <div class="split">
    <div class="card"><div class="card-title">Hours slept <span class="card-sub">14 days</span><span class="spacer"></span><button class="btn btn-sm btn-primary" data-act="sleepNew">${ic('plus', 14)} Log sleep</button></div>
      ${chartSlot({ type: 'line', h: 230, points: pts, goal, goalLabel: `${goal}h goal`, color: '#8b5cf6', min0: true, fmt: v => num(v, 1) + 'h', empty: 'Log a night of sleep to start' })}</div>
    <div class="card"><div class="card-title">History</div>
      ${list.length ? `<div class="list" style="max-height:320px;overflow:auto">${list.map(e => `<div class="li click" data-act="sleepEdit" data-id="${e.id}"><span style="font-size:1.3rem">${['😫', '😕', '😐', '🙂', '🤩'][(e.quality || 3) - 1]}</span><div class="grow"><div class="li-title">${fmtDuration(sleepHours(e) * 60)}</div><div class="li-sub">${esc(relDay(e.date))} · ${fmtTime(e.bed)} → ${fmtTime(e.wake)}</div></div>${sleepHours(e) >= goal ? `<span class="success-text">${ic('check', 16)}</span>` : ''}</div>`).join('')}</div>`
        : emptyState('moon', 'No sleep logged', 'Track bedtime and wake time to spot patterns.', `<button class="btn btn-primary btn-sm" data-act="sleepNew">Log last night</button>`, true)}</div>
  </div>`;
}

Object.assign(App.actions, {
  healthTab: el => { App.ui.healthTab = el.dataset.val; renderView(); },
  healthDay: el => { const d = Number(el.dataset.d); App.ui.healthDate = d === 0 ? todayStr() : addDaysStr(App.ui.healthDate, d); renderView(); },
  healthDayPick: el => { if (el.value) { App.ui.healthDate = el.value; renderView(); } },
  foodNew: el => openFoodForm(null, { meal: el.dataset.meal, date: App.route === 'health' ? App.ui.healthDate : todayStr() }),
  foodEdit: el => openFoodForm(db().meals.find(m => m.id === el.dataset.id)),
  foodQuick: el => {
    const f = db().foods.find(x => x.id === el.dataset.id);
    const ds = App.route === 'health' ? (App.ui.healthDate || todayStr()) : todayStr();
    const meal = { id: uid(), name: f.name, meal: guessMeal(), date: ds, cal: f.cal, p: f.p, c: f.c, f: f.f, servings: 1 };
    update(s => { s.meals.push(meal); rememberFood(meal); });
    toast(`Logged ${f.name} to ${meal.meal}`, { action: 'Undo', onAction: () => update(s => { s.meals = s.meals.filter(m => m.id !== meal.id); }) });
  },
  foodCopyYest: () => {
    const ds = App.ui.healthDate;
    const y = db().meals.filter(m => m.date === addDaysStr(ds, -1));
    withUndo(`Copied ${plural(y.length, 'item')}`, s => { y.forEach(m => s.meals.push({ ...m, id: uid(), date: ds })); });
  },
  waterAdd: el => waterAdd(Number(el.dataset.v), App.route === 'health' ? App.ui.healthDate || todayStr() : todayStr()),
  waterSet: el => {
    const ds = App.route === 'health' ? App.ui.healthDate || todayStr() : todayStr();
    const v = Number(el.dataset.v);
    waterAdd((waterOn(ds) === v ? v - 1 : v) - waterOn(ds), ds);
  },
  waterCustom: () => formModal({
    title: 'Add water', values: { ml: cfg().glassMl },
    fields: [{ key: 'ml', label: 'Amount (ml)', type: 'number', min: -5000, max: 5000, required: true, hint: 'Use a negative number to remove.' }],
    onSave: v => waterAdd(v.ml / cfg().glassMl, App.ui.healthDate || todayStr()),
  }),
  sleepNew: () => openSleepForm(null),
  sleepEdit: el => openSleepForm(db().sleep.find(x => x.id === el.dataset.id)),
});
