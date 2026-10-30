/* ============================================================
   Focus timer (Pomodoro) — keeps running across pages,
   shows in the top bar and tab title.
   ============================================================ */
'use strict';

const Focus = { mode: 'focus', running: false, endAt: 0, remaining: null, round: 1, taskId: '', subjectId: '' };
const focusKey = () => (Auth.user ? 'lifeos.focus.u.' + Auth.user.id : 'lifeos.focus.v1');
const focusModes = () => ({ focus: { label: 'Focus', min: cfg().focusMin || 25 }, short: { label: 'Short break', min: cfg().shortMin || 5 }, long: { label: 'Long break', min: cfg().longMin || 15 } });
const focusTotal = () => focusModes()[Focus.mode].min * 60;
function focusLeft() {
  if (Focus.running) return Math.max(0, Math.round((Focus.endAt - Date.now()) / 1000));
  return Focus.remaining ?? focusTotal();
}
const fmtClock = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
function focusPersist() { try { localStorage.setItem(focusKey(), JSON.stringify(Focus)); } catch (e) {} }
function focusRestore() {
  try {
    const f = JSON.parse(localStorage.getItem(focusKey()) || 'null');
    if (f && typeof f === 'object') Object.assign(Focus, f);
    // a timer that finished while the page was closed simply stops at zero
    if (Focus.running && Focus.endAt < Date.now()) { Focus.running = false; Focus.remaining = 0; }
  } catch (e) {}
}
function focusStart() {
  if (Focus.running) return;
  const left = focusLeft() || focusTotal();
  Focus.endAt = Date.now() + left * 1000;
  Focus.running = true; Focus.remaining = null;
  focusPersist(); focusRefresh();
}
function focusPause() {
  if (!Focus.running) return;
  Focus.remaining = focusLeft(); Focus.running = false;
  focusPersist(); focusRefresh();
}
function focusReset() { Focus.running = false; Focus.remaining = null; focusPersist(); focusRefresh(); }
function focusSetMode(m) { Focus.mode = m; Focus.running = false; Focus.remaining = null; focusPersist(); focusRefresh(); }
function focusComplete(skipped = false) {
  const wasFocus = Focus.mode === 'focus';
  if (wasFocus && !skipped) {
    const T = todayStr();
    const mins = focusModes().focus.min;
    update(s => {
      const l = s.focusLog[T] ||= { sessions: 0, minutes: 0, tasks: {} };
      l.sessions++; l.minutes += mins;
      if (Focus.taskId) l.tasks[Focus.taskId] = (l.tasks[Focus.taskId] || 0) + mins;
      if (Focus.subjectId && moduleOn('study') && s.subjects.some(x => x.id === Focus.subjectId)) s.studyLog.push({ id: uid(), created: Date.now(), date: T, subjectId: Focus.subjectId, kind: 'focus', minutes: mins, quality: 0, notes: 'Logged by focus timer' });
    }, { render: false });
  }
  if (!skipped) {
    if (cfg().focusSound) beep(wasFocus ? 660 : 880, .22, 3);
    toast(wasFocus ? '🎉 Focus session complete — take a break!' : '☕ Break over — ready to focus?', { type: 'success', ms: 6000 });
    try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Life OS', { body: wasFocus ? 'Focus session complete — take a break!' : 'Break over — time to focus.' }); } catch (e) {}
  }
  if (wasFocus) {
    Focus.mode = Focus.round % (cfg().longEvery || 4) === 0 ? 'long' : 'short';
  } else { Focus.mode = 'focus'; Focus.round++; }
  Focus.running = false; Focus.remaining = null;
  const auto = Focus.mode === 'focus' ? cfg().autoFocus : cfg().autoBreak;
  if (auto) focusStart();
  focusPersist(); focusRefresh(true);
}
function focusTick() {
  if (Focus.running && focusLeft() <= 0) { focusComplete(); return; }
  focusRefresh();
}
/** Update every timer readout in place (no full re-render each second). */
function focusRefresh(full = false) {
  const left = focusLeft(), total = focusTotal();
  $$('[data-focus-time]').forEach(el => { el.textContent = fmtClock(left); });
  $$('[data-focus-ring]').forEach(el => { const c = Number(el.dataset.c); el.style.strokeDashoffset = String(c * (1 - (total - left) / total)); });
  $$('[data-focus-toggle]').forEach(el => { el.innerHTML = ic(Focus.running ? 'pause' : 'play', Number(el.dataset.size) || 26); el.setAttribute('aria-label', Focus.running ? 'Pause' : 'Start'); });
  const pill = $('#focusPill');
  if (pill) {
    const show = Focus.running || (Focus.remaining != null && Focus.remaining < total && Focus.remaining > 0);
    pill.hidden = !show || !moduleOn('focus');
    pill.className = 'focus-pill ' + (Focus.mode !== 'focus' ? 'break' : '');
    pill.innerHTML = `${ic(Focus.mode === 'focus' ? 'timer' : 'sun', 15)}${fmtClock(left)}`;
  }
  if (cfg().focusTitle && (Focus.running)) document.title = `${fmtClock(left)} · ${focusModes()[Focus.mode].label} — Life OS`;
  else document.title = `${App.views[App.route]?.title || 'Life OS'} — Life OS`;
  if (full && (App.route === 'focus' || App.route === 'dashboard') && !App.modals.length) renderView();
}

function focusDial(size = 'big') {
  const left = focusLeft(), total = focusTotal();
  const r = 46, c = 2 * Math.PI * r;
  const col = Focus.mode === 'focus' ? 'var(--accent)' : 'var(--success)';
  return `<div class="focus-ring" ${size === 'small' ? 'style="width:150px"' : ''}><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="5"/><circle data-focus-ring data-c="${c.toFixed(2)}" cx="50" cy="50" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" style="stroke-dashoffset:${c * (1 - (total - left) / total)}"/></svg>
    <div class="focus-time"><b data-focus-time ${size === 'small' ? 'style="font-size:2rem"' : ''}>${fmtClock(left)}</b><span ${size === 'small' ? 'style="font-size:.8rem;margin-top:2px"' : ''}>${esc(focusModes()[Focus.mode].label)}</span></div></div>`;
}

App.views.focus = {
  title: 'Focus Timer',
  render() {
    const s = cfg(), T = todayStr();
    const log = db().focusLog[T] || { sessions: 0, minutes: 0 };
    const every = s.longEvery || 4;
    const pos = ((Focus.round - 1) % every) + 1;
    const tasks = openTasks().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 50);
    const days = Array.from({ length: 14 }, (_, i) => addDaysStr(T, i - 13));
    const weekMin = sum(days.slice(-7).map(d => db().focusLog[d]?.minutes || 0));
    const curTask = db().tasks.find(t => t.id === Focus.taskId);
    return `<div class="page-head"><div><h2>Focus</h2><p>One thing at a time.</p></div></div>
    <div class="split">
      <div class="card"><div class="focus-stage">
        ${seg('focusMode', [{ value: 'focus', label: 'Focus' }, { value: 'short', label: 'Short break' }, { value: 'long', label: 'Long break' }], Focus.mode)}
        ${focusDial()}
        <div class="rounds" title="Round ${pos} of ${every}">${Array.from({ length: every }, (_, i) => `<i class="${i < pos - (Focus.mode === 'focus' ? 1 : 0) ? 'on' : ''}"></i>`).join('')}</div>
        <div class="focus-ctl">
          <button class="btn-icon" data-act="focusReset" aria-label="Reset" title="Reset">${ic('reset', 20)}</button>
          <button class="focus-main-btn" data-act="focusToggle" data-focus-toggle data-size="28" aria-label="${Focus.running ? 'Pause' : 'Start'}">${ic(Focus.running ? 'pause' : 'play', 28)}</button>
          <button class="btn-icon" data-act="focusSkip" aria-label="Skip" title="Skip to next">${ic('skip', 20)}</button>
        </div>
        <div class="col" style="width:min(380px,100%);gap:6px"><span class="flabel">Working on</span>
          <select class="input" data-change="focusTask" aria-label="Task to focus on"><option value="">— Nothing specific —</option>${tasks.map(t => `<option value="${t.id}" ${t.id === Focus.taskId ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
          ${curTask ? `<button class="btn btn-sm btn-ghost" data-act="focusDoneTask">${ic('check', 14)} Mark “${esc(curTask.title.slice(0, 30))}” done</button>` : ''}
          ${moduleOn('study') && activeSubjects().length ? `<span class="flabel mt-s">Studying (logs the time to this subject)</span>
          <select class="input" data-change="focusSubject" aria-label="Study subject"><option value="">— Not studying —</option>${activeSubjects().map(s => `<option value="${s.id}" ${s.id === Focus.subjectId ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`).join('')}</select>` : ''}</div>
      </div></div>
      <div class="col" style="gap:var(--gap)">
        <div class="grid g2"><div class="card stat"><span class="k">Today</span><span class="v">${log.sessions}</span><span class="d">sessions · ${fmtDuration(log.minutes)}</span></div>
          <div class="card stat"><span class="k">Last 7 days</span><span class="v">${fmtDuration(weekMin)}</span><span class="d">focused</span></div></div>
        <div class="card"><div class="card-title">Focus minutes <span class="card-sub">14 days</span></div>${chartSlot({ type: 'bar', h: 150, labels: days.map(d => fmtDate(d)), series: [{ name: 'Minutes', values: days.map(d => db().focusLog[d]?.minutes || 0) }], fmt: v => num(v) })}</div>
        <div class="card"><div class="card-title">Timer settings</div>
          <div class="form-grid">
            ${[['focusMin', 'Focus (min)', 1, 180], ['shortMin', 'Short break', 1, 60], ['longMin', 'Long break', 1, 90], ['longEvery', 'Long break every', 2, 12]].map(([k, l, mn, mx]) => `<label class="field half"><span class="flabel">${l}</span><input class="input" type="number" min="${mn}" max="${mx}" value="${s[k]}" data-change="setCfg" data-key="${k}" data-type="int" data-min="${mn}" data-max="${mx}"></label>`).join('')}
            ${[['autoBreak', 'Auto-start breaks'], ['autoFocus', 'Auto-start next focus'], ['focusSound', 'Sound when done'], ['focusTitle', 'Show timer in tab title']].map(([k, l]) => `<label class="field half check-field"><input type="checkbox" ${s[k] ? 'checked' : ''} data-change="setCfg" data-key="${k}" data-type="bool"><span class="switch"></span><span>${l}</span></label>`).join('')}
          </div>
          ${'Notification' in window && Notification.permission === 'default' ? `<button class="btn btn-sm btn-ghost mt" data-act="focusNotif">${ic('bell', 14)} Enable desktop notifications</button>` : ''}
        </div>
      </div>
    </div>`;
  },
};

Object.assign(App.actions, {
  focusToggle: () => (Focus.running ? focusPause() : focusStart()),
  focusReset: () => focusReset(),
  focusSkip: () => focusComplete(true),
  focusMode: el => { focusSetMode(el.dataset.val); renderView(); },
  focusTask: el => { Focus.taskId = el.value; focusPersist(); renderView(); },
  focusSubject: el => { Focus.subjectId = el.value; focusPersist(); },
  focusDoneTask: () => { const id = Focus.taskId; Focus.taskId = ''; focusPersist(); toggleTask(id); },
  focusNotif: () => { try { Notification.requestPermission().then(() => renderView()); } catch (e) {} },
});
