/* ============================================================
   Boot: navigation, top bar, quick add, command palette,
   keyboard shortcuts, onboarding.
   ============================================================ */
'use strict';

const enabledModules = () => cfg().moduleOrder.map(id => MODULES.find(m => m.id === id)).filter(m => m && moduleOn(m.id));

function navBadge(id) {
  const T = todayStr();
  if (id === 'tasks') { const n = tasksDueToday().length; return n || ''; }
  if (id === 'habits') { const hs = habitsForDay(T); const left = hs.filter(h => !habitDone(h, T)).length; return left || ''; }
  return '';
}
function renderNav() {
  const sb = $('#sidebar');
  if (!sb || !App.state) return;
  const mods = enabledModules().filter(m => m.id !== 'settings');
  sb.innerHTML = `
    <a class="brand" href="#/dashboard" aria-label="Life OS home"><span class="brand-mark">${ic('check', 20, 'stroke-width="3"')}</span><span class="lbl">Life OS</span></a>
    <nav class="nav">${mods.map(m => { const b = navBadge(m.id); return `<a href="#/${m.id}" class="${App.route === m.id ? 'active' : ''}" title="${esc(m.label)}">${ic(m.icon, 19)}<span class="lbl">${esc(m.label)}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`; }).join('')}</nav>
    <div class="sidebar-foot nav">
      <a href="#/settings" class="${App.route === 'settings' ? 'active' : ''}" title="Settings">${ic('sliders', 19)}<span class="lbl">Settings</span></a>
      <a href="#" class="collapse-btn" data-act="toggleSidebar" title="${cfg().sidebar === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}">${ic(cfg().sidebar === 'collapsed' ? 'right' : 'left', 19)}<span class="lbl">Collapse</span></a>
    </div>`;
}
function renderTopbar() {
  const tb = $('#topbar');
  if (!tb || !App.state) return;
  const v = App.views[App.route];
  const dark = !['light', 'sepia'].includes(resolvedTheme());
  tb.innerHTML = `
    <button class="btn-icon menu-btn" data-act="openNav" aria-label="Open menu">${ic('menu', 20)}</button>
    <h1>${esc(v?.title || '')}</h1>
    <span class="spacer"></span>
    <button class="focus-pill" id="focusPill" data-act="goTo" data-route="focus" hidden></button>
    <button class="search-btn" data-act="openPalette" aria-label="Search and commands">${ic('search', 16)}<span class="lbl">Search or jump to…</span><kbd>Ctrl K</kbd></button>
    <button class="btn-icon" data-act="toggleTheme" aria-label="Toggle dark mode" title="Toggle light/dark (T)">${ic(dark ? 'sun' : 'moon', 19)}</button>
    <button class="btn btn-primary" data-act="quickAdd" aria-label="Quick add">${ic('plus', 17)}<span class="lbl" style="display:inline">New</span></button>
    ${syncPillHtml()}
    ${Auth.user ? `<button class="avatar-btn" data-act="accountMenu" aria-label="Account: ${esc(Auth.user.displayName)}" title="${esc(Auth.user.displayName)}">${avatarHtml(Auth.user, 34)}</button>` : ''}`;
  focusRefresh();
}
function route() {
  const r = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) || 'dashboard';
  App.route = App.views[r] && moduleOn(r) ? r : 'dashboard';
  if (App.route !== r && location.hash && location.hash !== '#' && location.hash !== '#/') history.replaceState(null, '', '#/' + App.route);
  document.body.classList.remove('nav-open');
  closeMenu();
  renderNav(); renderTopbar(); renderView();
  window.scrollTo(0, 0);
}

/* ---------- Quick add ---------- */
function quickAddItems() {
  const items = [
    moduleOn('tasks') && { label: 'Task', icon: 'tasks', color: '#6366f1', hint: 'N', onClick: () => openTaskForm(null, { due: todayStr() }) },
    moduleOn('calendar') && { label: 'Event', icon: 'calendar', color: '#3b82f6', hint: 'E', onClick: () => openEventForm(null, { date: todayStr() }) },
    moduleOn('fitness') && { label: 'Workout', icon: 'dumbbell', color: '#f97316', hint: 'W', onClick: () => openWorkoutEditor(null) },
    moduleOn('health') && { label: 'Food', icon: 'apple', color: '#22c55e', onClick: () => openFoodForm(null) },
    moduleOn('health') && { label: 'Glass of water', icon: 'droplet', color: '#06b6d4', onClick: () => waterAdd(1) },
    moduleOn('health') && { label: 'Sleep', icon: 'moon', color: '#8b5cf6', onClick: () => openSleepForm(null) },
    moduleOn('fitness') && { label: 'Quick training session', icon: 'zap', color: '#8b5cf6', onClick: () => openQuickActivity() },
    moduleOn('study') && { label: 'Study session', icon: 'cap', color: '#8b5cf6', hint: 'S', onClick: () => openStudyForm(null) },
    moduleOn('study') && { label: 'Exam / deadline', icon: 'flag', color: '#ef4444', onClick: () => openExamForm(null) },
    moduleOn('fitness') && { label: 'Body weight', icon: 'scale', color: '#06b6d4', onClick: () => openBodyForm(null) },
    moduleOn('finance') && { label: 'Expense', icon: 'receipt', color: '#ef4444', onClick: () => openTxForm(null, { type: 'expense' }) },
    moduleOn('finance') && { label: 'Income', icon: 'trend', color: '#22c55e', onClick: () => openTxForm(null, { type: 'income' }) },
    moduleOn('habits') && { label: 'Habit', icon: 'flame', color: '#f59e0b', onClick: () => openHabitForm(null) },
    moduleOn('notes') && { label: 'Note', icon: 'note', color: '#64748b', onClick: () => openNoteForm(null) },
    moduleOn('goals') && { label: 'Goal', icon: 'target', color: '#d946ef', onClick: () => openGoalForm(null) },
    moduleOn('journal') && { label: 'Journal entry', icon: 'book', color: '#ec4899', hint: 'J', onClick: () => { App.ui.jDate = todayStr(); go('journal'); } },
  ];
  return items.filter(Boolean);
}

/* ---------- Command palette ---------- */
function openPalette() {
  if (App.modals.some(m => m.palette)) return;
  let sel = 0, results = [];
  const cmds = () => {
    const list = [];
    enabledModules().forEach((m, i) => list.push({ sec: 'Go to', label: m.label, icon: m.icon, sub: i < 9 ? `G ${i + 1}` : '', run: () => go(m.id) }));
    quickAddItems().forEach(q => list.push({ sec: 'Create', label: 'New ' + q.label.toLowerCase(), icon: q.icon, run: q.onClick }));
    list.push({ sec: 'Actions', label: 'Toggle light / dark mode', icon: 'moon', run: () => App.actions.toggleTheme() });
    list.push({ sec: 'Actions', label: 'Customize dashboard', icon: 'grid', run: () => { App.ui.dashEdit = true; go('dashboard'); } });
    if (moduleOn('focus')) list.push({ sec: 'Actions', label: Focus.running ? 'Pause focus timer' : 'Start focus timer', icon: 'timer', run: () => App.actions.focusToggle() });
    list.push({ sec: 'Actions', label: 'Export backup', icon: 'download', run: () => App.actions.dataExport() });
    list.push({ sec: 'Actions', label: 'Change theme & colors', icon: 'palette', run: () => { App.ui.setSec = 'appearance'; go('settings'); } });
    list.push({ sec: 'Actions', label: 'Keyboard shortcuts', icon: 'keyboard', run: () => { App.ui.setSec = 'keys'; go('settings'); } });
    return list;
  };
  const search = q => {
    q = q.trim().toLowerCase();
    const base = cmds();
    if (!q) return base.filter(c => c.sec !== 'Actions' || true).slice(0, 40);
    const words = q.split(/\s+/);
    const match = s => words.every(w => s.toLowerCase().includes(w));
    const out = base.filter(c => match(c.label));
    const add = (sec, icon, label, sub, run) => out.push({ sec, icon, label, sub, run });
    if (moduleOn('tasks')) db().tasks.filter(t => match(t.title + ' ' + (t.notes || ''))).slice(0, 6).forEach(t => add('Tasks', t.done ? 'check' : 'tasks', t.title, t.due ? relDay(t.due) : '', () => { go('tasks'); setTimeout(() => openTaskForm(db().tasks.find(x => x.id === t.id)), 30); }));
    if (moduleOn('calendar')) db().events.filter(e => match(e.title + ' ' + (e.location || ''))).slice(0, 5).forEach(e => add('Events', 'calendar', e.title, relDay(e.date), () => { App.ui.calCursor = App.ui.calSel = e.date; go('calendar'); setTimeout(() => openEventForm(db().events.find(x => x.id === e.id)), 30); }));
    if (moduleOn('notes')) db().notes.filter(n => match((n.title || '') + ' ' + n.body)).slice(0, 5).forEach(n => add('Notes', 'note', n.title || 'Untitled', '', () => { go('notes'); setTimeout(() => openNoteForm(db().notes.find(x => x.id === n.id)), 30); }));
    if (moduleOn('habits')) db().habits.filter(h => match(h.name)).slice(0, 4).forEach(h => add('Habits', 'flame', `${h.emoji} ${h.name}`, '', () => { App.ui.habitOpen = h.id; go('habits'); }));
    if (moduleOn('goals')) db().goals.filter(g => match(g.title)).slice(0, 4).forEach(g => add('Goals', 'target', g.title, Math.round(goalPct(g) * 100) + '%', () => go('goals')));
    if (moduleOn('finance')) db().transactions.filter(t => match(`${t.desc} ${t.category}`)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).forEach(t => add('Money', 'receipt', `${t.desc} · ${fmtMoney(t.amount, { cur: txCur(t) })}`, relDay(t.date), () => { App.ui.finMonth = monthKey(t.date); go('finance'); setTimeout(() => openTxForm(db().transactions.find(x => x.id === t.id)), 30); }));
    if (moduleOn('study')) {
      db().subjects.filter(s => match(s.name + ' ' + (s.teacher || ''))).slice(0, 4).forEach(s => add('Study', 'cap', `${s.emoji} ${s.name}`, studyArea(s.area).label, () => { App.ui.studyTab = 'subjects'; go('study'); }));
      db().exams.filter(x => match(x.title + ' ' + x.kind)).slice(0, 4).forEach(x => add('Study', 'flag', x.title, relDay(x.date), () => { go('study'); setTimeout(() => openExamForm(db().exams.find(y => y.id === x.id)), 30); }));
    }
    if (moduleOn('journal')) Object.entries(db().journal).filter(([, e]) => match(e.text || '')).slice(0, 3).forEach(([d]) => add('Journal', 'book', `Journal · ${relDay(d)}`, '', () => { App.ui.jDate = d; go('journal'); }));
    if (moduleOn('fitness')) db().workouts.filter(w => match(w.name + ' ' + w.exercises.map(e => e.name).join(' '))).slice(0, 3).forEach(w => add('Workouts', 'dumbbell', w.name, relDay(w.date), () => { go('fitness'); setTimeout(() => openWorkoutEditor(db().workouts.find(x => x.id === w.id)), 30); }));
    if (moduleOn('tasks') && q.length > 2) out.push({ sec: 'Create', icon: 'plus', label: `Create task “${q}”`, run: () => { const t = addTaskQuick(q); if (t) toast(`Added “${t.title}”`, { type: 'success' }); } });
    return out;
  };
  const listHtml = () => {
    if (!results.length) return '<div class="empty sm"><p>No results</p></div>';
    let last = '', h = '';
    results.forEach((r, i) => {
      if (r.sec !== last) { h += `<div class="pal-sec">${esc(r.sec)}</div>`; last = r.sec; }
      h += `<button class="pal-item ${i === sel ? 'on' : ''}" data-pi="${i}"><span class="pi-ic">${ic(r.icon, 16)}</span><span class="truncate">${esc(r.label)}</span>${r.sub ? `<span class="pi-sub">${esc(r.sub)}</span>` : ''}</button>`;
    });
    return h;
  };
  const m = openModal({
    title: 'Command palette', cls: 'palette',
    body: `<div class="pal-input">${ic('search', 20)}<input id="palQ" placeholder="Search everything or type a command…" autocomplete="off" aria-label="Search"><kbd>Esc</kbd></div><div class="pal-list" id="palList"></div>
      <div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span>Type to search tasks, events, notes, money…</span></div>`,
    onMount: (wrap, close) => {
      const inp = wrap.querySelector('#palQ'), list = wrap.querySelector('#palList');
      const draw = () => { list.innerHTML = listHtml(); list.querySelector('.pal-item.on')?.scrollIntoView({ block: 'nearest' }); };
      const run = i => { const r = results[i]; if (!r) return; close(); setTimeout(() => r.run(), 10); };
      results = search(''); draw();
      inp.addEventListener('input', () => { results = search(inp.value); sel = 0; draw(); });
      inp.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
        else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      });
      list.addEventListener('click', e => { const b = e.target.closest('[data-pi]'); if (b) run(Number(b.dataset.pi)); });
      list.addEventListener('mousemove', e => { const b = e.target.closest('[data-pi]'); if (b && Number(b.dataset.pi) !== sel) { sel = Number(b.dataset.pi); list.querySelectorAll('.pal-item').forEach((x, i) => x.classList.toggle('on', i === sel)); } });
      setTimeout(() => inp.focus(), 20);
    },
  });
  m.palette = true;
}

/* ---------- Onboarding ---------- */
function onboarding() {
  let mode = 'sample';
  openModal({
    title: 'Welcome', size: 'sm', dismissable: false,
    body: `<div class="welcome-hero"><div class="brand-mark">${ic('check', 30, 'stroke-width="3"')}</div><h2>Welcome to Life OS</h2><p class="muted">Calendar, tasks, habits, gym, food, sleep, money, journal, notes and goals — in one place. Your data stays on this device.</p></div>
      <div class="form-grid"><label class="field half"><span class="flabel">What should we call you?</span><input class="input" id="obName" placeholder="Your name (optional)" autocomplete="given-name" value="${esc(Auth.user?.displayName || '')}"></label>
      <label class="field half"><span class="flabel">Main currency</span><select class="input" id="obCur">${DEFAULT_CURRENCIES.map(c => `<option value="${c.code}">${c.symbol} ${c.code} — ${c.name}</option>`).join('')}</select></label></div>
      <div class="welcome-opts">
        <button type="button" class="welcome-opt on" data-ob="sample"><b>✨ Explore with sample data</b><small>See every feature filled in. Clear it any time in Settings.</small></button>
        <button type="button" class="welcome-opt" data-ob="fresh"><b>🌱 Start fresh</b><small>A clean slate, ready for your life.</small></button>
      </div>`,
    footer: `<span class="spacer"></span><button type="button" class="btn btn-primary btn-lg" data-ob-go>Let’s go ${ic('right', 18)}</button>`,
    onMount: (wrap, close) => {
      wrap.querySelector('[data-close]').hidden = true;
      wrap.querySelectorAll('[data-ob]').forEach(b => b.onclick = () => { mode = b.dataset.ob; wrap.querySelectorAll('[data-ob]').forEach(x => x.classList.toggle('on', x === b)); });
      const goBtn = wrap.querySelector('[data-ob-go]');
      wrap.querySelector('#obName').addEventListener('keydown', e => { if (e.key === 'Enter') goBtn.click(); });
      goBtn.onclick = () => {
        const name = wrap.querySelector('#obName').value.trim();
        const cur = wrap.querySelector('#obCur').value;
        const settings = { ...App.state.settings, name, baseCur: cur, dispCur: cur };
        App.state = mode === 'sample' ? buildSample(settings) : normalize({ ...defaultState(), settings });
        saveNow(); close(); renderAll();
        toast(mode === 'sample' ? 'Sample data loaded — have a look around!' : `Welcome${name ? ', ' + name : ''}! Press Ctrl+K anytime.`, { type: 'success', ms: 5000 });
      };
    },
  });
}

/* ---------- Global actions ---------- */
Object.assign(App.actions, {
  openNav: () => document.body.classList.add('nav-open'),
  closeNav: () => document.body.classList.remove('nav-open'),
  toggleSidebar: () => { update(s => { s.settings.sidebar = s.settings.sidebar === 'collapsed' ? 'expanded' : 'collapsed'; }, { render: false }); applySettings(); renderNav(); setTimeout(() => drawCharts(document), 300); },
  toggleTheme: () => {
    const cur = resolvedTheme();
    const isDark = !['light', 'sepia'].includes(cur);
    update(s => { s.settings.theme = isDark ? (s.settings.lastLight || 'light') : (s.settings.lastDark || 'dark'); if (isDark) s.settings.lastDark = cur; else s.settings.lastLight = cur; }, { render: false });
    applySettings(); renderTopbar(); if (App.route === 'settings') renderView();
  },
  quickAdd: el => openMenu(el, quickAddItems(), { align: 'right' }),
  openPalette: () => openPalette(),
});

/* ---------- Keyboard ---------- */
let gPending = 0;
document.addEventListener('keydown', e => {
  if (!App.state) return; // login screen
  if (e.key === 'Escape') {
    if (App.menu) { closeMenu(); return; }
    const top = App.modals[App.modals.length - 1];
    if (top) { e.preventDefault(); top.tryClose(); return; }
    if (document.body.classList.contains('nav-open')) { document.body.classList.remove('nav-open'); return; }
    if (App.ui.dashEdit) { App.ui.dashEdit = false; renderView(); }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
  if (App.modals.length) return;
  const k = e.key.toLowerCase();
  if (gPending && Date.now() - gPending < 1200 && /^[1-9]$/.test(k)) {
    gPending = 0;
    const m = enabledModules()[Number(k) - 1];
    if (m) go(m.id);
    return;
  }
  gPending = 0;
  if (k === 'g') { gPending = Date.now(); return; }
  if (k === '/') { e.preventDefault(); openPalette(); }
  else if (k === 'n' && moduleOn('tasks')) { e.preventDefault(); openTaskForm(null, { due: todayStr() }); }
  else if (k === 'e' && moduleOn('calendar')) { e.preventDefault(); openEventForm(null, { date: App.route === 'calendar' ? App.ui.calSel || todayStr() : todayStr() }); }
  else if (k === 'w' && moduleOn('fitness')) { e.preventDefault(); openWorkoutEditor(null); }
  else if (k === 's' && moduleOn('study')) { e.preventDefault(); openStudyForm(null); }
  else if (k === 'j' && moduleOn('journal')) { e.preventDefault(); App.ui.jDate = todayStr(); go('journal'); setTimeout(() => $('#jText')?.focus(), 60); }
  else if (k === 't') { e.preventDefault(); App.actions.toggleTheme(); }
  else if (k === 'f' && moduleOn('focus')) { e.preventDefault(); App.actions.focusToggle(); }
  else if (k === '?') { App.ui.setSec = 'keys'; go('settings'); }
});

/* ---------- Boot ---------- */
/** Starts the app for the signed-in user. `loaded` is their saved state, or null for a brand-new account. */
function startApp(loaded) {
  document.body.classList.remove('auth-mode');
  $('#auth')?.remove();
  App.state = loaded || defaultState();
  try { localStorage.setItem('lifeos.probe', '1'); localStorage.removeItem('lifeos.probe'); } catch (e) { App.persistOk = false; }
  focusRestore();
  applySettings();
  window.addEventListener('hashchange', route);
  route();
  if (!loaded) onboarding();
  else autopayBills();
  if (!App.persistOk) toast('Your browser is blocking storage — changes won’t be saved. Use Export in Settings.', { type: 'error', ms: 9000 });

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (cfg().theme === 'system') { applySettings(); renderTopbar(); } });
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); else focusRefresh(); });
  // keep data in sync if the app is open in two tabs
  window.addEventListener('storage', e => {
    if (e.key === storeKey() && e.newValue && !App.modals.length) { try { App.state = normalize(JSON.parse(e.newValue)); renderAll(); } catch (err) {} }
  });

  setInterval(focusTick, 500);
  // live clock + day rollover
  let lastDay = todayStr(), lastMin = -1;
  setInterval(() => {
    const now = new Date();
    if (todayStr() !== lastDay) {
      lastDay = todayStr();
      autopayBills();
      if (!App.modals.length) renderAll();
      return;
    }
    if (now.getMinutes() !== lastMin) {
      lastMin = now.getMinutes();
      const c = $('#heroClock');
      if (c) c.textContent = fmtTime(minToTime(now.getHours() * 60 + now.getMinutes()));
    }
  }, 5000);
}

(function boot() {
  // Cloud sync is on when js/firebase-config.js has a config; otherwise accounts stay on this device.
  if (cloudConfigured()) { cloudBoot(); return; }
  // keep tabs in sync: logging out (or in) elsewhere reloads this tab
  window.addEventListener('storage', e => { if (e.key === SESSION_KEY || e.key === USERS_KEY) { const s = getSession(); if ((s?.userId || null) !== (Auth.user?.id || null)) location.reload(); } });
  const ses = getSession();
  const user = ses && readUsers().find(u => u.id === ses.userId);
  if (!user) {
    clearSession();
    showAuthScreen();
    return;
  }
  Auth.user = user;
  startApp(loadState());
})();
