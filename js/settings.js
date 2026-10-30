/* ============================================================
   Settings — appearance, modules, dashboard, preferences,
   goals, data import/export.
   ============================================================ */
'use strict';

const THEMES = [
  { id: 'system', label: 'System', bg: 'linear-gradient(135deg,#f4f5f9 50%,#0c0e13 50%)', side: '#ffffff', fg: '#cfd3dd' },
  { id: 'light', label: 'Light', bg: '#f4f5f9', side: '#ffffff', fg: '#dfe2ea' },
  { id: 'dark', label: 'Dark', bg: '#0c0e13', side: '#15181f', fg: '#2a2f3b' },
  { id: 'midnight', label: 'Midnight', bg: '#000000', side: '#0b0b0e', fg: '#222228' },
  { id: 'slate', label: 'Slate', bg: '#0e1526', side: '#162036', fg: '#2a3756' },
  { id: 'forest', label: 'Forest', bg: '#0b1410', side: '#111d17', fg: '#21342a' },
  { id: 'sepia', label: 'Sepia', bg: '#f2ebdf', side: '#fbf7f0', fg: '#e3d7c4' },
];
const ACCENTS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b'];
const FONTS = [
  { id: 'inter', label: 'Inter', css: "'Inter'" }, { id: 'system', label: 'System', css: 'system-ui' }, { id: 'rounded', label: 'Nunito', css: "'Nunito'" },
  { id: 'grotesk', label: 'Space Grotesk', css: "'Space Grotesk'" }, { id: 'serif', label: 'Fraunces', css: "'Fraunces'" }, { id: 'mono', label: 'Mono', css: "'JetBrains Mono'" },
];
const SECTIONS = [
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'modules', label: 'Modules & menu', icon: 'panel' },
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'prefs', label: 'Preferences', icon: 'sliders' },
  { id: 'goals', label: 'Daily targets', icon: 'target' },
  { id: 'data', label: 'Data & backup', icon: 'database' },
  { id: 'keys', label: 'Shortcuts', icon: 'keyboard' },
];

function resolvedTheme() {
  const t = cfg().theme;
  if (t === 'system') return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t;
}
function applySettings() {
  const s = cfg(), h = document.documentElement;
  h.dataset.theme = resolvedTheme();
  h.dataset.density = s.density;
  h.dataset.radius = s.radius;
  h.dataset.font = s.font;
  h.dataset.fontsize = s.fontSize;
  h.dataset.sidebar = s.sidebar;
  h.dataset.motion = s.motion;
  h.style.setProperty('--accent', s.accent);
  h.style.setProperty('--on-accent', colorContrast(s.accent));
  let meta = $('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = getComputedStyle(document.body || h).getPropertyValue('--bg').trim() || '#ffffff';
}

const setRow = (title, sub, ctrl) => `<div class="set-row"><div class="sr-l"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="row wrap">${ctrl}</div></div>`;
const cfgSeg = (key, opts) => seg('setCfgSeg', opts, cfg()[key], `data-key="${key}"`);
const cfgNum = (key, { min = 0, max = 100000, step = 1, unit = '', w = 110 } = {}) => `<input class="input input-sm" type="number" min="${min}" max="${max}" step="${step}" value="${cfg()[key] ?? ''}" style="width:${w}px" data-change="setCfg" data-key="${key}" data-type="num" data-min="${min}" data-max="${max}">${unit ? `<span class="faint small">${unit}</span>` : ''}`;
const cfgSwitch = key => `<label class="check-field"><input type="checkbox" ${cfg()[key] ? 'checked' : ''} data-change="setCfg" data-key="${key}" data-type="bool"><span class="switch"></span></label>`;

App.views.settings = {
  title: 'Settings',
  render() {
    const sec = App.ui.setSec === 'account' && !Auth.user ? 'appearance' : (App.ui.setSec || 'appearance');
    const nav = `<div class="side-nav">${SECTIONS.map(s => `<button class="${sec === s.id ? 'on' : ''}" data-act="setSec" data-val="${s.id}">${ic(s.icon, 17)}${s.label}</button>`).join('')}</div>`;
    const body = ({ account: Auth.user?.cloud ? setAccountCloud : setAccount, appearance: setAppearance, modules: setModules, dashboard: setDashboard, prefs: setPrefs, goals: setGoals, data: setData, keys: setKeys }[sec] || setAppearance)();
    return `<div class="page-head"><div><h2>Settings</h2><p>Make it yours.</p></div></div><div class="split-l"><div>${nav}</div><div>${body}</div></div>`;
  },
};
function setAppearance() {
  const s = cfg();
  return `<div class="card set-sec"><h3>${ic('palette', 18)} Theme</h3><p>Pick a look. “System” follows your device’s light/dark setting.</p>
      <div class="theme-cards">${THEMES.map(t => `<button class="theme-card ${s.theme === t.id ? 'on' : ''}" data-act="setTheme" data-val="${t.id}">
        <div class="tp" style="background:${t.bg}"><i style="background:${t.side}"></i><div class="tp-m"><span style="background:${s.accent};width:60%"></span><span style="background:${t.fg}"></span><span style="background:${t.fg};width:70%"></span></div></div>
        <b>${t.label}${s.theme === t.id ? ic('check', 15) : ''}</b></button>`).join('')}</div></div>
    <div class="card set-sec"><h3>Accent color</h3><p>Used for buttons, highlights and charts.</p>
      <div class="swatches">${ACCENTS.map(c => `<button class="sw-btn ${s.accent.toLowerCase() === c ? 'on' : ''}" style="--c:${c}" data-act="setAccent" data-val="${c}" aria-label="Accent ${c}"></button>`).join('')}
        <label class="row" style="gap:8px;margin-left:6px"><input type="color" value="${s.accent}" data-change="setAccentCustom" aria-label="Custom accent color"><span class="faint small">Custom</span></label></div></div>
    <div class="card set-sec"><h3>Typography & layout</h3>
      ${setRow('Font', '', `<div class="seg">${FONTS.map(f => `<button class="${s.font === f.id ? 'on' : ''}" style="font-family:${f.css}" data-act="setCfgSeg" data-key="font" data-val="${f.id}">${f.label}</button>`).join('')}</div>`)}
      ${setRow('Text size', '', cfgSeg('fontSize', [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]))}
      ${setRow('Density', 'How much breathing room cards get', cfgSeg('density', [{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'spacious', label: 'Spacious' }]))}
      ${setRow('Corners', '', cfgSeg('radius', [{ value: 'sharp', label: 'Sharp' }, { value: 'rounded', label: 'Rounded' }, { value: 'round', label: 'Extra round' }]))}
      ${setRow('Sidebar', 'Collapsed shows icons only', cfgSeg('sidebar', [{ value: 'expanded', label: 'Expanded' }, { value: 'collapsed', label: 'Collapsed' }]))}
      ${setRow('Animations', '', cfgSeg('motion', [{ value: 'full', label: 'On' }, { value: 'reduced', label: 'Reduced' }]))}
    </div>`;
}
function setModules() {
  const s = cfg();
  return `<div class="card set-sec"><h3>${ic('panel', 18)} Modules</h3><p>Turn off what you don’t use and reorder the sidebar. Turning a module off hides it — your data is kept.</p>
    <div class="order-list">${s.moduleOrder.map((id, i) => {
      const m = MODULES.find(x => x.id === id);
      if (!m) return '';
      const on = moduleOn(id);
      return `<div class="order-item ${on ? '' : 'off'}">${ic(m.icon, 18)}<span class="grow">${esc(m.label)}${m.fixed ? ' <span class="faint tiny">(always on)</span>' : ''}</span>
        <button class="btn-icon sm" data-act="modMove" data-id="${id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${ic('up', 15)}</button>
        <button class="btn-icon sm" data-act="modMove" data-id="${id}" data-d="1" ${i === s.moduleOrder.length - 1 ? 'disabled' : ''} aria-label="Move down">${ic('down', 15)}</button>
        ${m.fixed ? '<span style="width:38px"></span>' : `<label class="check-field"><input type="checkbox" ${on ? 'checked' : ''} data-change="modToggle" data-id="${id}" aria-label="Enable ${esc(m.label)}"><span class="switch"></span></label>`}</div>`;
    }).join('')}</div>
    <div class="row mt"><button class="btn btn-sm btn-ghost" data-act="modReset">Reset order</button></div></div>`;
}
function setDashboard() {
  const ws = cfg().widgets;
  return `<div class="card set-sec"><h3>${ic('grid', 18)} Dashboard widgets</h3><p>Show, hide, reorder and resize. You can also click “Customize” on the dashboard itself.</p>
    <div class="order-list">${ws.map((w, i) => {
      const d = WIDGETS.find(x => x.id === w.id);
      const avail = moduleOn(d.module);
      return `<div class="order-item ${w.on && avail ? '' : 'off'}">${ic(d.icon, 18)}<span class="grow">${esc(d.label)}${!avail ? ' <span class="faint tiny">(module off)</span>' : ''}</span>
        <select class="input input-sm" style="width:auto" data-change="wSizeSet" data-id="${w.id}" aria-label="Size"><option value="1" ${w.size === 1 ? 'selected' : ''}>Normal</option><option value="2" ${w.size === 2 ? 'selected' : ''}>Wide</option><option value="3" ${w.size === 3 ? 'selected' : ''}>Full width</option></select>
        <button class="btn-icon sm" data-act="wOrder" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${ic('up', 15)}</button>
        <button class="btn-icon sm" data-act="wOrder" data-i="${i}" data-d="1" ${i === ws.length - 1 ? 'disabled' : ''} aria-label="Move down">${ic('down', 15)}</button>
        <label class="check-field"><input type="checkbox" ${w.on ? 'checked' : ''} data-change="wToggle" data-id="${w.id}" aria-label="Show ${esc(d.label)}"><span class="switch"></span></label></div>`;
    }).join('')}</div>
    <div class="row mt"><button class="btn btn-sm btn-ghost" data-act="wReset">Reset to default</button><button class="btn btn-sm btn-ghost" data-act="wShowAll">Show all</button></div></div>`;
}
function setPrefs() {
  const s = cfg();
  return `<div class="card set-sec"><h3>${ic('user', 18)} You</h3>
      ${setRow('Your name', 'Used in the greeting', `<input class="input input-sm" style="width:220px" value="${esc(s.name)}" data-change="setCfg" data-key="name" data-type="str" placeholder="Name">`)}</div>
    <div class="card set-sec"><h3>${ic('calendar', 18)} Date & time</h3>
      ${setRow('Week starts on', '', cfgSeg('weekStart', [{ value: 1, label: 'Monday' }, { value: 0, label: 'Sunday' }, { value: 6, label: 'Saturday' }]))}
      ${setRow('Clock', '', cfgSeg('clock24', [{ value: false, label: '12-hour' }, { value: true, label: '24-hour' }]))}
      ${setRow('Calendar day view starts at', 'Where week/day view scrolls to', `<select class="input input-sm" style="width:auto" data-change="setCfg" data-key="calStartHour" data-type="int">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${s.calStartHour === h ? 'selected' : ''}>${fmtTime(minToTime(h * 60))}</option>`).join('')}</select>`)}</div>
    <div class="card set-sec"><h3>${ic('scale', 18)} Units & money</h3>
      ${setRow('Weight unit', 'Labels only — values aren’t converted', cfgSeg('weightUnit', ['kg', 'lb']))}
      ${setRow('Distance unit', '', cfgSeg('distUnit', ['km', 'mi']))}
      ${setRow('Show money in', 'Totals are converted into this currency', curSelect('', s.dispCur, 'setCurDisp'))}
      ${setRow('Default currency for new entries', 'You can still pick any currency per transaction', curSelect('', s.baseCur, 'setCurBase'))}
      ${setRow('Exchange rates & more currencies', 'Dram, dollar, euro, ruble… edit rates or update them online', `<button class="btn btn-sm" data-act="goTo" data-route="finance" data-fin="rates">${ic('wallet', 14)} Manage</button>`)}
      ${setRow('Rest timer after a set', 'Starts automatically when you tick a set (0 = off)', cfgNum('defaultRest', { min: 0, max: 600, unit: 'seconds', w: 90 }))}</div>
    <div class="card set-sec"><h3>${ic('tasks', 18)} Tasks & habits</h3>
      ${setRow('Show completed tasks in lists', '', cfgSwitch('taskShowDone'))}
      ${setRow('Habit week strip', '', cfgSeg('habitStrip', [{ value: 'week', label: 'This week' }, { value: 'last7', label: 'Last 7 days' }]))}
      ${setRow('Goal areas', 'Categories for goals', `<button class="btn btn-sm" data-act="editGoalCats">${ic('edit', 14)} Edit</button>`)}
      ${setRow('Finance categories', '', `<button class="btn btn-sm" data-act="finCats">${ic('edit', 14)} Edit</button>`)}</div>`;
}
function setGoals() {
  return `<div class="card set-sec"><h3>${ic('target', 18)} Daily targets</h3><p>These power the rings and progress bars across the app.</p>
    ${setRow('Calories', '', cfgNum('calorieGoal', { min: 500, max: 10000, step: 50, unit: 'kcal' }))}
    ${setRow('Protein', '', cfgNum('proteinGoal', { min: 0, max: 1000, unit: 'g' }))}
    ${setRow('Carbs', '', cfgNum('carbGoal', { min: 0, max: 2000, unit: 'g' }))}
    ${setRow('Fat', '', cfgNum('fatGoal', { min: 0, max: 1000, unit: 'g' }))}
    ${setRow('Water', '', cfgNum('waterGoal', { min: 1, max: 40, unit: 'glasses' }))}
    ${setRow('Glass size', '', cfgNum('glassMl', { min: 50, max: 2000, step: 10, unit: 'ml' }))}
    ${setRow('Sleep', '', cfgNum('sleepGoal', { min: 3, max: 14, step: 0.5, unit: 'hours' }))}
    ${setRow('Workouts per week', '', cfgNum('workoutGoal', { min: 1, max: 14, unit: 'sessions' }))}
    ${setRow('Study per week', 'Used when your subjects have no weekly goals of their own', cfgNum('studyGoalMin', { min: 0, max: 6000, step: 30, unit: 'minutes' }))}
    ${setRow('Goal body weight', 'Optional', cfgNum('goalWeight', { min: 0, max: 2000, step: 0.1, unit: cfg().weightUnit }))}</div>`;
}
function setData() {
  const s = db();
  const size = (() => { try { return new Blob([JSON.stringify(s)]).size; } catch (e) { return 0; } })();
  const counts = [['Events', s.events.length], ['Tasks', s.tasks.length], ['Habits', s.habits.length], ['Workouts', s.workouts.length], ['Meals', s.meals.length], ['Transactions', s.transactions.length], ['Study sessions', s.studyLog.length], ['Exams', s.exams.length], ['Journal entries', Object.keys(s.journal).length], ['Notes', s.notes.length], ['Goals', s.goals.length]];
  return `<div class="card set-sec"><h3>${ic('database', 18)} Your data</h3>
      <p>${Auth.user?.cloud
        ? `Your data (${size > 1e6 ? num(size / 1e6, 1) + ' MB' : num(size / 1024, 1) + ' KB'}) is synced to your private cloud account and cached on this device so it works offline. Exporting a backup now and then is still a good idea.`
        : `Everything for <b>@${esc(Auth.user?.username || '')}</b> is stored privately in this browser on this device (${size > 1e6 ? num(size / 1e6, 1) + ' MB' : num(size / 1024, 1) + ' KB'}). Nothing is sent anywhere. Export regular backups to keep it safe or move it to another device.`}</p>
      <div class="row wrap mb" style="gap:6px">${counts.map(([k, v]) => `<span class="chip">${k}: <b>${v}</b></span>`).join('')}</div>
      ${!App.persistOk ? `<p class="danger-text small mb">⚠ Saving is currently failing in this browser. Export a backup now.</p>` : ''}
      <div class="row wrap"><button class="btn btn-primary" data-act="dataExport">${ic('download', 16)} Export backup (.json)</button>
        <label class="btn">${ic('upload', 16)} Import backup<input type="file" accept="application/json,.json" hidden data-change="dataImport"></label></div></div>
    <div class="card set-sec"><h3>${ic('sparkles', 18)} Sample data</h3><p>Fill the app with realistic example data to explore every feature. This replaces your current data (you can undo right after).</p>
      <button class="btn" data-act="dataSample">${ic('sparkles', 16)} Load sample data</button></div>
    <div class="card set-sec" style="border-color:color-mix(in srgb,var(--danger) 35%,var(--border))"><h3 class="danger-text">${ic('trash', 18)} Danger zone</h3>
      <p>Erase all data and settings from this browser. Export a backup first if you might want it back.</p>
      <div class="row wrap"><button class="btn danger" data-act="dataClearContent">Erase data, keep settings</button><button class="btn btn-danger" data-act="dataReset">Erase everything</button></div></div>`;
}
function setKeys() {
  const k = (keys, d) => `<span>${keys.map(x => `<kbd>${x}</kbd>`).join(' ')}</span><span>${d}</span>`;
  return `<div class="card set-sec"><h3>${ic('keyboard', 18)} Keyboard shortcuts</h3><p>Shortcuts work when you’re not typing in a field.</p>
    <div class="kbd-list">${k(['Ctrl', 'K'], 'Command palette — search & jump anywhere')}${k(['/'], 'Command palette')}${k(['N'], 'New task')}${k(['E'], 'New event')}${k(['W'], 'Log workout')}${k(['S'], 'Log study session')}${k(['J'], 'Open today’s journal')}${k(['T'], 'Toggle light / dark')}${k(['F'], 'Start / pause focus timer')}${k(['G', 'then 1–9'], 'Go to the Nth module')}${k(['?'], 'Show shortcuts')}${k(['Esc'], 'Close dialogs')}${k(['Ctrl', 'Enter'], 'Save the open form')}</div></div>`;
}

Object.assign(App.actions, {
  setSec: el => { App.ui.setSec = el.dataset.val; renderView(); },
  setTheme: el => { update(s => { s.settings.theme = el.dataset.val; }); applySettings(); },
  setAccent: el => { update(s => { s.settings.accent = el.dataset.val; }); applySettings(); },
  setAccentCustom: el => { update(s => { s.settings.accent = el.value; }); applySettings(); },
  setCfgSeg: el => {
    const key = el.closest('[data-key]').dataset.key;
    let v = el.dataset.val;
    if (v === 'true' || v === 'false') v = v === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    update(s => { s.settings[key] = v; });
    applySettings(); renderNav(); renderTopbar();
  },
  setCfg: el => {
    const key = el.dataset.key, t = el.dataset.type;
    let v;
    if (t === 'bool') v = el.checked;
    else if (t === 'num' || t === 'int') {
      if (el.value === '') { v = key === 'goalWeight' ? null : cfg()[key]; }
      else {
        v = Number(el.value);
        if (isNaN(v)) { el.value = cfg()[key] ?? ''; return; }
        if (t === 'int') v = Math.round(v);
        const mn = el.dataset.min !== undefined ? Number(el.dataset.min) : -Infinity, mx = el.dataset.max !== undefined ? Number(el.dataset.max) : Infinity;
        if (v < mn || v > mx) { v = clamp(v, mn, mx); toast(`Adjusted to ${v} (allowed ${mn}–${mx})`); }
        if (key === 'goalWeight' && v === 0) v = null;
      }
    } else v = el.value.trim();
    update(s => { s.settings[key] = v; });
    if (key.startsWith('focus') || ['shortMin', 'longMin', 'longEvery'].includes(key)) focusRefresh();
  },
  modToggle: el => { update(s => { s.settings.modules[el.dataset.id] = el.checked; }); renderNav(); },
  modMove: el => { update(s => { const o = s.settings.moduleOrder, i = o.indexOf(el.dataset.id), j = i + Number(el.dataset.d); if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; }); renderNav(); },
  modReset: () => { update(s => { s.settings.moduleOrder = MODULES.map(m => m.id); }); renderNav(); },
  wToggle: el => update(s => { s.settings.widgets.find(w => w.id === el.dataset.id).on = el.checked; }),
  wSizeSet: el => update(s => { s.settings.widgets.find(w => w.id === el.dataset.id).size = Number(el.value); }),
  wOrder: el => update(s => { const ws = s.settings.widgets, i = Number(el.dataset.i), j = i + Number(el.dataset.d); if (j < 0 || j >= ws.length) return; [ws[i], ws[j]] = [ws[j], ws[i]]; }),
  editGoalCats: () => formModal({
    title: 'Goal areas', values: { cats: cfg().goalCats.join('\n') },
    fields: [{ key: 'cats', label: 'One per line', type: 'textarea', rows: 8 }],
    onSave: v => { const c = [...new Set(v.cats.split('\n').map(x => x.trim()).filter(Boolean))]; if (!c.length) { toast('Keep at least one area', { type: 'error' }); return false; } update(s => { s.settings.goalCats = c; }); },
  }),
  dataExport: () => { saveNow(); download(`life-os-backup-${todayStr()}.json`, JSON.stringify(db(), null, 2)); toast('Backup downloaded', { type: 'success' }); },
  dataImport: async el => {
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('Not a Life OS backup');
      if (!(await confirmDialog(`Replace everything with “${file.name}”? You can undo right after.`, { ok: 'Import', danger: true }))) return;
      const snap = JSON.stringify(App.state);
      App.state = normalize(data); saveNow(); renderAll();
      toast('Backup imported', { action: 'Undo', onAction: () => { App.state = normalize(JSON.parse(snap)); saveNow(); renderAll(); } });
    } catch (e) { toast('That file isn’t a valid Life OS backup', { type: 'error' }); }
  },
  dataSample: async () => {
    if (!(await confirmDialog('Replace your current data with sample data? Your settings stay. You can undo right after.', { ok: 'Load sample data' }))) return;
    const snap = JSON.stringify(App.state);
    App.state = buildSample(App.state.settings); saveNow(); renderAll();
    toast('Sample data loaded', { action: 'Undo', onAction: () => { App.state = normalize(JSON.parse(snap)); saveNow(); renderAll(); } });
  },
  dataClearContent: async () => {
    if (!(await confirmDialog('Erase all events, tasks, habits, workouts, food, money, journal, notes and goals? Settings are kept.', { ok: 'Erase data', danger: true }))) return;
    const snap = JSON.stringify(App.state);
    const fresh = defaultState(); fresh.settings = App.state.settings;
    App.state = normalize(fresh); saveNow(); renderAll();
    toast('All data erased', { action: 'Undo', onAction: () => { App.state = normalize(JSON.parse(snap)); saveNow(); renderAll(); } });
  },
  dataReset: async () => {
    if (!(await confirmDialog('Erase ALL of this account’s data and settings and start over? Your login stays.', { ok: 'Erase everything', danger: true }))) return;
    if (Auth.user?.cloud) {
      // erase the cloud copy too, otherwise it would come straight back
      Cloud.on = false; Cloud.unsub?.();
      try { await Cloud.backend.wipe(Auth.user.id, Cloud.remoteChunks); } catch (e) { Cloud.on = true; toast(cloudError(e), { type: 'error' }); return; }
      localStorage.removeItem('lifeos.sync.' + Auth.user.id);
    }
    // drop in-memory state first so the unload handler can't write it back
    clearTimeout(saveTimer); App.state = null;
    try { localStorage.removeItem(storeKey()); localStorage.removeItem(focusKey()); } catch (e) {}
    location.hash = ''; location.reload();
  },
});
