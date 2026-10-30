/* ============================================================
   Gym & Fitness — workout logger with sets, rest timer,
   templates/routines, PRs, progress charts, body weight.
   ============================================================ */
'use strict';

const EXERCISES = [
  'Bench Press', 'Incline Bench Press', 'Dumbbell Bench Press', 'Squat', 'Front Squat', 'Deadlift', 'Romanian Deadlift', 'Overhead Press',
  'Barbell Row', 'Dumbbell Row', 'Pull-up', 'Chin-up', 'Lat Pulldown', 'Seated Cable Row', 'Dip', 'Push-up', 'Leg Press', 'Lunge',
  'Bulgarian Split Squat', 'Leg Curl', 'Leg Extension', 'Calf Raise', 'Hip Thrust', 'Bicep Curl', 'Hammer Curl', 'Tricep Pushdown',
  'Skull Crusher', 'Lateral Raise', 'Face Pull', 'Rear Delt Fly', 'Chest Fly', 'Plank', 'Hanging Leg Raise', 'Cable Crunch',
  'Running', 'Cycling', 'Rowing Machine', 'Elliptical', 'Stair Climber', 'Swimming', 'Walking', 'Jump Rope', 'HIIT',
];
const CARDIO = new Set(['Running', 'Cycling', 'Rowing Machine', 'Elliptical', 'Stair Climber', 'Swimming', 'Walking', 'Hiking', 'Treadmill', 'Spin class']);
// exercises that are counted in reps without weight, or held/done for time
const BODYWEIGHT_EX = ['Push-up', 'Pull-up', 'Chin-up', 'Dip', 'Burpee', 'Air Squat', 'Jump Squat', 'Sit-up', 'Crunch', 'Lunge (bodyweight)', 'Pistol Squat', 'Muscle-up', 'Handstand Push-up', 'Inverted Row', 'Leg Raise', 'Box Jump', 'Kettlebell Swing'];
const TIMED_EX = ['Plank', 'Side Plank', 'Wall Sit', 'Dead Hang', 'L-sit', 'Handstand Hold', 'Jump Rope', 'Mountain Climbers', 'Jumping Jacks', 'High Knees', 'Shadow Boxing', 'Heavy Bag', 'Speed Bag', 'Sparring', 'Pad Work', 'Sun Salutation', 'Yoga Flow', 'Stretching', 'Foam Rolling', 'Battle Ropes', 'Sled Push', 'Tabata', 'Rounds'];
EXERCISES.push(...BODYWEIGHT_EX.filter(x => !EXERCISES.includes(x)), ...TIMED_EX.filter(x => !EXERCISES.includes(x)), 'Hiking', 'Treadmill', 'Spin class');
const EX_KINDS = [
  { value: 'strength', label: 'Weights' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'time', label: 'Timed' },
  { value: 'cardio', label: 'Cardio' },
];
function defaultKind(name) {
  const n = (name || '').trim();
  if (CARDIO.has(n)) return 'cardio';
  if (TIMED_EX.includes(n)) return 'time';
  if (BODYWEIGHT_EX.includes(n)) return 'bodyweight';
  return 'strength';
}
const TRAINING_TYPES = [
  { id: 'strength', label: 'Strength / Gym', emoji: '🏋️', color: '#f97316' },
  { id: 'calisthenics', label: 'Calisthenics', emoji: '🤸', color: '#eab308' },
  { id: 'crossfit', label: 'CrossFit / Functional', emoji: '🔥', color: '#ef4444' },
  { id: 'hiit', label: 'HIIT / Circuit', emoji: '⚡', color: '#f43f5e' },
  { id: 'running', label: 'Running', emoji: '🏃', color: '#22c55e' },
  { id: 'cycling', label: 'Cycling', emoji: '🚴', color: '#14b8a6' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊', color: '#06b6d4' },
  { id: 'walking', label: 'Walking / Hiking', emoji: '🥾', color: '#84cc16' },
  { id: 'cardio', label: 'Cardio machines', emoji: '🫀', color: '#10b981' },
  { id: 'boxing', label: 'Boxing / Martial arts', emoji: '🥊', color: '#dc2626' },
  { id: 'yoga', label: 'Yoga', emoji: '🧘', color: '#8b5cf6' },
  { id: 'pilates', label: 'Pilates', emoji: '🩰', color: '#d946ef' },
  { id: 'mobility', label: 'Stretching / Mobility', emoji: '🙆', color: '#a855f7' },
  { id: 'sports', label: 'Team sports', emoji: '⚽', color: '#3b82f6' },
  { id: 'racket', label: 'Tennis / Racket sports', emoji: '🎾', color: '#65a30d' },
  { id: 'climbing', label: 'Climbing', emoji: '🧗', color: '#b45309' },
  { id: 'dance', label: 'Dance', emoji: '💃', color: '#ec4899' },
  { id: 'other', label: 'Other', emoji: '✨', color: '#64748b' },
];
const trainingType = id => TRAINING_TYPES.find(t => t.id === id) || TRAINING_TYPES[0];
/** Pick a training type from the exercises when the user didn't choose one. */
function guessType(exs) {
  if (!exs.length) return 'strength';
  const names = exs.map(e => e.name.toLowerCase()).join(' ');
  if (exs.every(e => e.kind === 'cardio')) {
    if (/run|treadmill/.test(names)) return 'running';
    if (/cycl|bike|spin/.test(names)) return 'cycling';
    if (/swim/.test(names)) return 'swimming';
    if (/walk|hik/.test(names)) return 'walking';
    return 'cardio';
  }
  if (/box|bag|sparr|pad work/.test(names)) return 'boxing';
  if (/yoga|sun salutation/.test(names)) return 'yoga';
  if (exs.every(e => e.kind === 'bodyweight' || e.kind === 'time')) return 'calisthenics';
  return 'strength';
}
const workoutType = w => w.type || guessType(w.exercises || []);
const workoutMinutes = w => Number(w.duration) || sum((w.exercises || []).filter(e => e.kind === 'cardio').flatMap(e => e.sets.map(s => s.min))) || sum((w.exercises || []).filter(e => e.kind === 'time').flatMap(e => e.sets.map(s => (s.sec || 0) / 60)));
const typeOptions = () => TRAINING_TYPES.map(t => ({ value: t.id, label: `${t.emoji}  ${t.label}` }));

const e1rm = (w, r) => (w > 0 && r > 0) ? (r === 1 ? w : w * (1 + r / 30)) : 0;
const workoutVolume = w => sum((w.exercises || []).filter(e => (e.kind || 'strength') === 'strength').flatMap(e => e.sets.map(s => (Number(s.reps) || 0) * (Number(s.weight) || 0))));
const workoutSets = w => sum((w.exercises || []).map(e => e.sets.length));
const workoutsInWeek = (d = new Date()) => { const s = ymd(startOfWeek(d)), e = ymd(addDays(startOfWeek(d), 6)); return db().workouts.filter(w => w.date >= s && w.date <= e); };
const sortedWorkouts = () => [...db().workouts].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
const wu = () => cfg().weightUnit;

function knownExercises() {
  const set = new Set(EXERCISES);
  db().workouts.forEach(w => w.exercises.forEach(e => e.name && set.add(e.name)));
  db().templates.forEach(t => t.exercises.forEach(e => e.name && set.add(e.name)));
  return [...set].sort();
}
function refreshExList() { const dl = $('#exlist'); if (dl) dl.innerHTML = knownExercises().map(n => `<option value="${esc(n)}">`).join(''); }

function lastPerformance(name, excludeId) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  for (const w of sortedWorkouts()) {
    if (w.id === excludeId) continue;
    const ex = w.exercises.find(e => e.name.trim().toLowerCase() === key);
    if (ex && ex.sets.length) return { date: w.date, ex };
  }
  return null;
}
const fmtSec = s => { s = Math.round(s || 0); return s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `${s}s`; };
function setsSummary(ex) {
  if (ex.kind === 'bodyweight') {
    const s = ex.sets.filter(x => x.reps);
    if (!s.length) return '—';
    return s.every(x => x.reps === s[0].reps) ? `${s.length} × ${s[0].reps} reps` : `${s.length} sets · ${sum(s.map(x => x.reps))} reps`;
  }
  if (ex.kind === 'time') {
    const s = ex.sets.filter(x => x.sec);
    if (!s.length) return '—';
    return s.every(x => x.sec === s[0].sec) ? `${s.length} × ${fmtSec(s[0].sec)}` : `${s.length} rounds · ${fmtSec(sum(s.map(x => x.sec)))}`;
  }
  if (ex.kind === 'cardio') {
    const m = sum(ex.sets.map(s => s.min)), d = sum(ex.sets.map(s => s.dist));
    return [m ? fmtDuration(m) : '', d ? `${num(d, 2)} ${cfg().distUnit}` : ''].filter(Boolean).join(' · ') || '—';
  }
  const s = ex.sets.filter(x => x.reps || x.weight);
  if (!s.length) return '—';
  const same = s.every(x => x.reps === s[0].reps && x.weight === s[0].weight);
  if (same) return `${s.length} × ${s[0].reps || 0}${s[0].weight ? ` @ ${num(s[0].weight, 2)} ${wu()}` : ''}`;
  const top = s.reduce((a, b) => (Number(b.weight) || 0) > (Number(a.weight) || 0) ? b : a);
  return `${s.length} sets · top ${top.reps || 0} × ${num(top.weight || 0, 2)} ${wu()}`;
}
function exerciseStats() {
  const map = new Map();
  [...db().workouts].sort((a, b) => a.date.localeCompare(b.date)).forEach(w => w.exercises.forEach(ex => {
    if ((ex.kind || 'strength') !== 'strength' || !ex.name) return;
    const key = ex.name.trim();
    if (!map.has(key)) map.set(key, { name: key, best: 0, bestReps: 0, best1rm: 0, sessions: 0, last: '', history: [] });
    const st = map.get(key);
    st.sessions++; st.last = w.date;
    let day1rm = 0;
    ex.sets.forEach(s => {
      const wt = Number(s.weight) || 0, r = Number(s.reps) || 0;
      if (wt > st.best || (wt === st.best && r > st.bestReps)) { st.best = wt; st.bestReps = r; }
      day1rm = Math.max(day1rm, e1rm(wt, r));
    });
    st.best1rm = Math.max(st.best1rm, day1rm);
    if (day1rm) st.history.push({ date: w.date, v: day1rm });
  }));
  return [...map.values()].sort((a, b) => b.sessions - a.sessions);
}
/** PRs set in a given workout (vs. everything before it). */
function workoutPRs(w) {
  const prs = [];
  w.exercises.forEach(ex => {
    if ((ex.kind || 'strength') !== 'strength') return;
    const key = ex.name.trim().toLowerCase();
    let prev = 0;
    db().workouts.forEach(o => {
      if (o.id === w.id || o.date > w.date || (o.date === w.date && (o.created || 0) >= (w.created || 0))) return;
      o.exercises.forEach(e => { if (e.name.trim().toLowerCase() === key) e.sets.forEach(s => { prev = Math.max(prev, e1rm(Number(s.weight) || 0, Number(s.reps) || 0)); }); });
    });
    const cur = Math.max(0, ...ex.sets.map(s => e1rm(Number(s.weight) || 0, Number(s.reps) || 0)));
    if (cur > 0 && prev > 0 && cur > prev) prs.push(ex.name);
  });
  return prs;
}

/* ---------- Workout editor ---------- */
function blankSet(kind, prev) {
  if (kind === 'cardio') return { min: prev?.min ?? '', dist: prev?.dist ?? '' };
  if (kind === 'time') return { sec: prev?.sec ?? '', done: false };
  if (kind === 'bodyweight') return { reps: prev?.reps ?? '', done: false };
  return { reps: prev?.reps ?? '', weight: prev?.weight ?? '', done: false };
}
const setIsEmpty = s => ['reps', 'weight', 'sec', 'min', 'dist'].every(k => s[k] === '' || s[k] == null || s[k] === 0);
function openWorkoutEditor(w, { template = null, mode = 'workout', type = '' } = {}) {
  const isTpl = mode === 'template';
  const isNew = !w;
  let draft;
  if (w) draft = JSON.parse(JSON.stringify(w));
  else if (template) draft = { name: template.name, type: template.type || '', date: todayStr(), duration: '', rpe: '', cal: '', notes: '', templateId: template.id, exercises: JSON.parse(JSON.stringify(template.exercises)).map(e => ({ ...e, sets: e.sets.map(s => ({ ...s, done: false })) })) };
  else draft = isTpl ? { name: '', type: type || 'strength', notes: '', exercises: [] } : { name: '', type: type || '', date: todayStr(), duration: '', rpe: '', cal: '', notes: '', exercises: [] };
  draft.exercises ||= [];
  draft.type ||= w ? workoutType(w) : '';
  const startedAt = Date.now();
  let dirty = false;
  let rest = { left: 0, timer: null };
  refreshExList();

  const lastHtml = (ex, i) => {
    const last = !isTpl ? lastPerformance(ex.name, w?.id) : null;
    return last ? `<div class="ex-last">${ic('clock', 13)} Last time (${esc(relDay(last.date))}): <b>${esc(setsSummary(last.ex))}</b> <button type="button" class="btn btn-sm btn-ghost" data-wa="copyLast" data-i="${i}">${ic('copy', 13)} Use</button></div>` : '';
  };
  const numIn = (k, i, j, v, label, step = 'any') => `<td><input class="input" type="number" inputmode="decimal" min="0" step="${step}" value="${esc(v ?? '')}" data-k="${k}" data-i="${i}" data-j="${j}" aria-label="${label}"></td>`;
  const exHtml = (ex, i) => {
    const kind = ex.kind || 'strength';
    const cardio = kind === 'cardio';
    const cols = { strength: ['Reps', `Weight (${wu()})`], bodyweight: ['Reps'], time: ['Seconds'], cardio: ['Minutes', `Distance (${cfg().distUnit})`] }[kind];
    const cells = (s, j) => ({
      strength: numIn('reps', i, j, s.reps, 'Reps', '1') + numIn('weight', i, j, s.weight, 'Weight'),
      bodyweight: numIn('reps', i, j, s.reps, 'Reps', '1'),
      time: numIn('sec', i, j, s.sec, 'Seconds', '1'),
      cardio: numIn('min', i, j, s.min, 'Minutes') + numIn('dist', i, j, s.dist, 'Distance'),
    }[kind]);
    return `<div class="ex-block" data-ex="${i}">
      <div class="ex-head">
        <input class="input" list="exlist" placeholder="Exercise name" value="${esc(ex.name)}" data-k="name" data-i="${i}" aria-label="Exercise name">
        <div class="seg">${EX_KINDS.map(k => `<button type="button" class="${kind === k.value ? 'on' : ''}" data-wa="kind" data-i="${i}" data-v="${k.value}">${k.label}</button>`).join('')}</div>
        <button type="button" class="btn-icon sm" data-wa="exUp" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${ic('up', 15)}</button>
        <button type="button" class="btn-icon sm" data-wa="exDown" data-i="${i}" ${i === draft.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">${ic('down', 15)}</button>
        <button type="button" class="btn-icon sm danger" data-wa="exDel" data-i="${i}" aria-label="Remove exercise">${ic('trash', 15)}</button>
      </div>
      <div data-last-slot="${i}">${lastHtml(ex, i)}</div>
      <table class="sets"><thead><tr><th>${kind === 'time' ? 'Round' : cardio ? '#' : 'Set'}</th>${cols.map(c => `<th>${c}</th>`).join('')}${!isTpl && !cardio ? '<th></th>' : ''}<th></th></tr></thead><tbody>
        ${ex.sets.map((s, j) => `<tr class="${s.done ? 'done' : ''}"><td class="n">${j + 1}</td>
          ${cells(s, j)}
          ${!isTpl && !cardio ? `<td style="width:40px"><button type="button" class="set-ok ${s.done ? 'on' : ''}" data-wa="setDone" data-i="${i}" data-j="${j}" aria-label="Set done">${ic('check', 15, 'stroke-width="3"')}</button></td>` : ''}
          <td style="width:36px"><button type="button" class="btn-icon sm danger" data-wa="setDel" data-i="${i}" data-j="${j}" aria-label="Remove set">${ic('x', 14)}</button></td></tr>`).join('')}
      </tbody></table>
      <button type="button" class="btn btn-sm btn-ghost mt-s" data-wa="setAdd" data-i="${i}">${ic('plus', 14)} Add ${kind === 'time' ? 'round' : cardio ? 'entry' : 'set'}</button>
    </div>`;
  };
  const bodyHtml = () => `
    <div class="form-grid mb">
      <label class="field half"><span class="flabel">${isTpl ? 'Routine name' : 'Workout name'}</span><input class="input" data-k="wname" value="${esc(draft.name)}" placeholder="${isTpl ? 'e.g. Push day, Full body A' : 'e.g. Upper body, Leg day, Morning run'}"></label>
      <label class="field half"><span class="flabel">Training type</span><select class="input" data-k="wtype"><option value="" ${!draft.type ? 'selected' : ''}>Auto-detect from exercises</option>${TRAINING_TYPES.map(t => `<option value="${t.id}" ${draft.type === t.id ? 'selected' : ''}>${t.emoji}  ${esc(t.label)}</option>`).join('')}</select></label>
      ${isTpl ? '' : `<label class="field third"><span class="flabel">Date</span><input class="input" type="date" data-k="date" value="${esc(draft.date)}"></label>
      <label class="field third"><span class="flabel">Minutes</span><input class="input" type="number" min="0" data-k="duration" value="${esc(draft.duration)}" placeholder="auto"></label>
      <label class="field third"><span class="flabel">Calories (optional)</span><input class="input" type="number" min="0" data-k="cal" value="${esc(draft.cal ?? '')}" placeholder="kcal"></label>
      <div class="field"><span class="flabel">Intensity (how hard was it?)</span><div class="seg full">${[['', '—'], ...Array.from({ length: 10 }, (_, k) => [k + 1, k + 1])].map(([v, l]) => `<button type="button" class="${String(draft.rpe ?? '') === String(v) ? 'on' : ''}" data-wa="rpe" data-v="${v}">${l}</button>`).join('')}</div><small class="fhint">1 = very easy · 5 = moderate · 10 = all-out</small></div>`}
    </div>
    <div id="exList">${draft.exercises.length ? draft.exercises.map(exHtml).join('') : `<div class="empty sm"><div class="e-ic">${ic('dumbbell', 20)}</div><h4>No exercises yet</h4><p>Add exercises below — or, for a class, match or session (yoga, football, boxing…), just fill in the type and minutes and save.</p></div>`}</div>
    <div class="row wrap mb">
      <input class="input" list="exlist" id="exAddName" placeholder="Add exercise… (e.g. Squat)" style="flex:1;min-width:180px" aria-label="New exercise name">
      <button type="button" class="btn btn-soft" data-wa="exAdd">${ic('plus', 16)} Add exercise</button>
    </div>
    <label class="field"><span class="flabel">Notes</span><textarea class="input" rows="2" data-k="notes" placeholder="How did it feel? Energy, pain, PR attempts…">${esc(draft.notes || '')}</textarea></label>`;
  const restHtml = () => isTpl ? '' : `<div class="rest-timer ${rest.left ? 'run' : ''}" id="restT">${ic('timer', 16)}<b>${rest.left ? `${Math.floor(rest.left / 60)}:${pad(rest.left % 60)}` : 'Rest'}</b>
    ${rest.left ? `<button type="button" class="btn btn-sm btn-ghost" data-wa="restStop">Stop</button>` : [60, 90, 120, 180].map(s => `<button type="button" class="btn btn-sm btn-ghost" data-wa="rest" data-v="${s}">${s < 120 ? s + 's' : s / 60 + 'm'}</button>`).join('')}</div>`;

  const m = openModal({
    title: isTpl ? (isNew ? 'New routine' : 'Edit routine') : (isNew ? 'Log workout' : 'Edit workout'),
    size: 'lg', dismissable: false,
    body: `<div id="woBody">${bodyHtml()}</div>`,
    footer: `${!isNew ? `<button type="button" class="btn btn-ghost danger" data-wa="delete">${ic('trash', 16)} Delete</button>` : ''}
      ${!isTpl && draft.exercises.length ? `<button type="button" class="btn btn-ghost" data-wa="saveTpl">${ic('copy', 16)} Save as routine</button>` : ''}
      <span id="restWrap">${restHtml()}</span><span class="spacer"></span>
      <button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-wa="save">${ic('check', 16)} ${isTpl ? 'Save routine' : 'Save workout'}</button>`,
    onClose: () => clearInterval(rest.timer),
    onMount: (wrap, close, mm) => {
      mm.beforeClose = async () => {
        if (dirty && !(await confirmDialog('Discard your unsaved changes?', { ok: 'Discard', danger: true }))) return;
        close();
      };
      const body = wrap.querySelector('#woBody');
      const rerender = () => { body.innerHTML = bodyHtml(); };
      const rerenderRest = () => { const r = wrap.querySelector('#restWrap'); if (r) r.innerHTML = restHtml(); };
      const syncInput = t => {
        const k = t.dataset.k, i = Number(t.dataset.i), j = Number(t.dataset.j);
        if (!k) return;
        dirty = true;
        if (k === 'wname') draft.name = t.value;
        else if (k === 'date') draft.date = t.value;
        else if (k === 'duration') draft.duration = t.value === '' ? '' : Number(t.value);
        else if (k === 'cal') draft.cal = t.value === '' ? '' : Number(t.value);
        else if (k === 'wtype') draft.type = t.value;
        else if (k === 'notes') draft.notes = t.value;
        else if (k === 'name') draft.exercises[i].name = t.value;
        else { const v = t.value === '' ? '' : Number(t.value); draft.exercises[i].sets[j][k] = v; }
      };
      wrap.addEventListener('input', e => syncInput(e.target));
      // when an exercise name is chosen, show its "last time" hint (and switch to cardio if obvious)
      wrap.addEventListener('change', e => {
        if (e.target.dataset.k !== 'name') return;
        const i = Number(e.target.dataset.i), ex = draft.exercises[i];
        const dk = defaultKind(ex.name);
        if (dk !== (ex.kind || 'strength') && ex.sets.every(setIsEmpty)) { ex.kind = dk; ex.sets = dk === 'cardio' ? [blankSet(dk)] : [blankSet(dk), blankSet(dk), blankSet(dk)]; rerender(); return; }
        const slot = body.querySelector(`[data-last-slot="${i}"]`);
        if (slot) slot.innerHTML = lastHtml(ex, i);
      });
      wrap.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'exAddName') { e.preventDefault(); wrap.querySelector('[data-wa="exAdd"]').click(); }
      });
      const startRest = secs => {
        clearInterval(rest.timer);
        rest.left = secs; rerenderRest();
        rest.timer = setInterval(() => {
          rest.left--;
          if (rest.left <= 0) { clearInterval(rest.timer); rest.left = 0; if (cfg().focusSound) beep(990, .15, 2); toast('Rest over — next set! 💪'); }
          rerenderRest();
        }, 1000);
      };
      wrap.addEventListener('click', async e => {
        const b = e.target.closest('[data-wa]');
        if (!b) return;
        const a = b.dataset.wa, i = Number(b.dataset.i), j = Number(b.dataset.j);
        const ex = draft.exercises[i];
        switch (a) {
          case 'exAdd': {
            const inp = wrap.querySelector('#exAddName');
            const name = inp.value.trim();
            const kind = defaultKind(name);
            const last = !isTpl && name ? lastPerformance(name, w?.id) : null;
            const sets = last && last.ex.kind === kind ? last.ex.sets.map(s => ({ ...blankSet(kind, s) })) : [blankSet(kind), ...(kind === 'cardio' ? [] : [blankSet(kind), blankSet(kind)])];
            draft.exercises.push({ name, kind, sets });
            dirty = true; rerender();
            const blocks = wrap.querySelectorAll('.ex-block');
            const nb = blocks[blocks.length - 1];
            nb?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            (name ? nb?.querySelector('tbody input') : nb?.querySelector('input'))?.focus();
            return;
          }
          case 'rpe': draft.rpe = b.dataset.v === '' ? '' : Number(b.dataset.v); break;
          case 'exDel': draft.exercises.splice(i, 1); break;
          case 'exUp': if (i > 0) [draft.exercises[i - 1], draft.exercises[i]] = [draft.exercises[i], draft.exercises[i - 1]]; break;
          case 'exDown': if (i < draft.exercises.length - 1) [draft.exercises[i + 1], draft.exercises[i]] = [draft.exercises[i], draft.exercises[i + 1]]; break;
          case 'kind': if (ex.kind !== b.dataset.v) { ex.kind = b.dataset.v; ex.sets = [blankSet(ex.kind)]; } break;
          case 'setAdd': ex.sets.push(blankSet(ex.kind, ex.sets[ex.sets.length - 1])); if (ex.sets[ex.sets.length - 1].done !== undefined) ex.sets[ex.sets.length - 1].done = false; break;
          case 'setDel': ex.sets.splice(j, 1); break;
          case 'setDone': {
            ex.sets[j].done = !ex.sets[j].done;
            if (ex.sets[j].done && setIsEmpty(ex.sets[j])) { const last = lastPerformance(ex.name, w?.id); const ls = last?.ex.kind === ex.kind ? last.ex.sets[j] : null; if (ls) Object.assign(ex.sets[j], blankSet(ex.kind, ls), { done: true }); }
            if (ex.sets[j].done && cfg().defaultRest) startRest(cfg().defaultRest);
            break;
          }
          case 'copyLast': { const last = lastPerformance(ex.name, w?.id); if (last) { ex.kind = last.ex.kind; ex.sets = last.ex.sets.map(s => blankSet(ex.kind, s)); } break; }
          case 'rest': startRest(Number(b.dataset.v)); return;
          case 'restStop': clearInterval(rest.timer); rest.left = 0; rerenderRest(); return;
          case 'saveTpl': {
            const name = draft.name || 'My routine';
            update(s => { s.templates.push({ id: uid(), name, type: draft.type || guessType(cleanExercises(draft.exercises)), notes: '', exercises: cleanExercises(draft.exercises).map(e => ({ ...e, sets: e.sets.map(({ done, ...rest }) => rest) })) }); });
            toast(`Saved routine “${name}”`, { type: 'success' });
            return;
          }
          case 'delete': {
            if (!(await confirmDialog(`Delete this ${isTpl ? 'routine' : 'workout'}?`, { ok: 'Delete', danger: true }))) return;
            close();
            withUndo(isTpl ? 'Routine deleted' : 'Workout deleted', s => {
              if (isTpl) s.templates = s.templates.filter(x => x.id !== w.id);
              else s.workouts = s.workouts.filter(x => x.id !== w.id);
            });
            return;
          }
          case 'save': {
            const exercises = cleanExercises(draft.exercises);
            if (!exercises.length && !draft.name.trim() && !draft.type && !draft.duration) { toast('Add an exercise, or pick a training type and minutes', { type: 'error' }); return; }
            if (!isTpl && !draft.date) { toast('Pick a date', { type: 'error' }); return; }
            const type = draft.type || guessType(exercises);
            const out = { ...draft, type, name: draft.name.trim() || (isTpl ? 'Routine' : guessWorkoutName(exercises, type)), exercises };
            if (!isTpl && isNew && (out.duration === '' || out.duration == null) && out.date === todayStr()) {
              const mins = Math.round((Date.now() - startedAt) / 60000);
              if (mins >= 5) out.duration = mins;
            }
            let saved;
            update(s => {
              const coll = isTpl ? s.templates : s.workouts;
              if (isNew) { saved = { id: uid(), created: Date.now(), ...out }; coll.push(saved); }
              else { saved = Object.assign(coll.find(x => x.id === w.id), out); }
            });
            renderNav();
            dirty = false; close();
            if (!isTpl) {
              const prs = workoutPRs(saved);
              toast(prs.length ? `🏆 New PR: ${prs.join(', ')}!` : 'Workout saved — nice work! 💪', { type: 'success', ms: prs.length ? 6000 : 3200 });
            } else toast('Routine saved', { type: 'success' });
            return;
          }
          default: return;
        }
        dirty = true; rerender();
      });
    },
  });
  return m;
}
function cleanExercises(list) {
  return list.map(e => {
    const kind = e.kind || 'strength';
    const conv = s => ({
      cardio: { min: Number(s.min) || 0, dist: Number(s.dist) || 0 },
      time: { sec: Number(s.sec) || 0, done: !!s.done },
      bodyweight: { reps: Number(s.reps) || 0, done: !!s.done },
      strength: { reps: Number(s.reps) || 0, weight: Number(s.weight) || 0, done: !!s.done },
    }[kind]);
    return { name: (e.name || '').trim() || 'Exercise', kind, sets: e.sets.filter(s => !setIsEmpty(s)).map(conv) };
  }).filter(e => e.sets.length || e.name !== 'Exercise');
}
function guessWorkoutName(ex, type) {
  if (type && type !== 'strength') return trainingType(type).label.split(' /')[0];
  if (!ex.length) return 'Workout';
  if (ex.every(e => e.kind === 'cardio')) return ex[0].name;
  const n = ex.map(e => e.name.toLowerCase()).join(' ');
  if (/squat|leg|lunge|deadlift|calf|hip/.test(n) && !/bench|press|row|pull|curl/.test(n)) return 'Leg day';
  if (/bench|press|dip|fly|push|tricep/.test(n) && !/row|pull|curl/.test(n)) return 'Push day';
  if (/row|pull|curl|chin|lat/.test(n) && !/bench|squat/.test(n)) return 'Pull day';
  return 'Full body';
}

function openBodyForm(entry) {
  const isNew = !entry;
  formModal({
    title: isNew ? 'Log body weight' : 'Edit entry',
    values: entry || { date: todayStr(), value: db().bodyweight.length ? [...db().bodyweight].sort((a, b) => b.date.localeCompare(a.date))[0].value : '', fat: '', waist: '' },
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, half: true },
      { key: 'value', label: `Weight (${wu()})`, type: 'number', step: 'any', min: 1, max: 2000, required: true, half: true },
      { key: 'fat', label: 'Body fat % (optional)', type: 'number', step: 'any', min: 1, max: 80, half: true },
      { key: 'waist', label: 'Waist (optional)', type: 'number', step: 'any', min: 1, max: 400, half: true },
    ],
    onSave: v => {
      update(s => {
        if (isNew) {
          const ex = s.bodyweight.find(b => b.date === v.date);
          if (ex) Object.assign(ex, v); else s.bodyweight.push({ id: uid(), ...v });
        } else Object.assign(s.bodyweight.find(b => b.id === entry.id), v);
      });
      toast('Weight logged', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo('Entry deleted', s => { s.bodyweight = s.bodyweight.filter(b => b.id !== entry.id); }),
  });
}

/* ---------- View ---------- */
function workoutCard(w) {
  const prs = workoutPRs(w);
  const vol = workoutVolume(w);
  const t = trainingType(workoutType(w));
  const mins = workoutMinutes(w);
  return `<div class="card wo-card" data-act="woOpen" data-id="${w.id}" style="border-top:3px solid ${t.color}">
    <div class="row between mb-s"><div class="row" style="min-width:0;gap:10px"><span class="habit-em" style="--c:${t.color};width:38px;height:38px;font-size:1.15rem">${t.emoji}</span><div style="min-width:0"><div class="li-title truncate">${esc(w.name || 'Workout')}</div><div class="li-sub">${esc(relDay(w.date))}${mins ? ' · ' + fmtDuration(mins) : ''}</div></div></div>
      ${prs.length ? `<span class="pr-badge">${ic('trophy', 12)} ${prs.length} PR</span>` : ''}</div>
    ${w.exercises.slice(0, 5).map(e => `<div class="wo-ex"><b class="truncate">${esc(e.name)}</b><span class="num">${esc(setsSummary(e))}</span></div>`).join('')}
    ${w.exercises.length > 5 ? `<div class="faint tiny">+${w.exercises.length - 5} more</div>` : ''}
    ${!w.exercises.length && w.notes ? `<p class="faint small truncate">${esc(w.notes)}</p>` : ''}
    <div class="row wrap mt-s" style="gap:12px"><span class="chip c" style="--c:${t.color}">${esc(t.label)}</span>${vol ? `<span class="faint tiny">${ic('activity', 13)} ${num(vol)} ${wu()}</span>` : ''}${workoutSets(w) ? `<span class="faint tiny">${ic('layers', 13)} ${workoutSets(w)} sets</span>` : ''}${w.rpe ? `<span class="faint tiny">${ic('zap', 13)} ${w.rpe}/10</span>` : ''}${w.cal ? `<span class="faint tiny">🔥 ${num(w.cal)} kcal</span>` : ''}</div>
  </div>`;
}
App.views.fitness = {
  title: 'Gym & Fitness',
  render() {
    const tab = App.ui.fitTab || 'log';
    const wk = workoutsInWeek();
    const goal = cfg().workoutGoal || 4;
    let streak = 0, d = startOfWeek(new Date());
    if (workoutsInWeek(d).length >= goal) streak++;
    d = addDays(d, -7);
    while (streak < 520 && workoutsInWeek(d).length >= goal) { streak++; d = addDays(d, -7); }
    const monthN = db().workouts.filter(w => monthKey(w.date) === monthKey(todayStr())).length;
    const head = `<div class="page-head"><div><h2>Gym & Fitness</h2><p>Log it, beat it, repeat.</p></div>
      <div class="actions">
        ${db().templates.length ? `<button class="btn" data-act="woFromTpl">${ic('play', 14)} Start routine</button>` : ''}
        <button class="btn" data-act="woQuick">${ic('zap', 16)} Quick log</button>
        <button class="btn btn-primary" data-act="woNewType">${ic('plus', 16)} Log training</button></div></div>
      <div class="grid g4 mb">
        <div class="card stat-card">${ring(wk.length / goal, { size: 64, sw: 7, font: 14, color: '#f97316', center: `${wk.length}/${goal}` })}<div class="stat"><span class="k">This week</span><span class="v">${plural(wk.length, 'session')}</span><span class="d">goal ${goal}/week</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#ef4444">${ic('flame', 22)}</div><div class="stat"><span class="k">Week streak</span><span class="v">${streak}</span><span class="d">weeks hitting goal</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#8b5cf6">${ic('clock', 22)}</div><div class="stat"><span class="k">Active this week</span><span class="v">${fmtDuration(sum(wk.map(workoutMinutes)))}</span><span class="d">${num(sum(wk.map(workoutVolume)))} ${wu()} lifted</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#22c55e">${ic('layers', 22)}</div><div class="stat"><span class="k">This month</span><span class="v">${monthN}</span><span class="d">${plural(new Set(db().workouts.filter(w => monthKey(w.date) === monthKey(todayStr())).map(workoutType)).size, 'training type')}</span></div></div>
      </div>
      ${tabs('fitTab', [{ value: 'log', label: 'Sessions', icon: 'list' }, { value: 'types', label: 'By type', icon: 'layers' }, { value: 'routines', label: 'Routines', icon: 'copy', count: db().templates.length }, { value: 'progress', label: 'Progress & PRs', icon: 'trophy' }, { value: 'body', label: 'Body', icon: 'scale' }], tab)}`;
    return head + ({ log: fitLog, types: fitTypes, routines: fitRoutines, progress: fitProgress, body: fitBody }[tab] || fitLog)();
  },
};
function fitLog() {
  const all = sortedWorkouts();
  if (!all.length) return `<div class="card">${emptyState('dumbbell', 'No training logged yet', 'Gym, running, yoga, boxing, football, swimming… log any kind of training. Strength sessions get PRs and “last time” hints automatically.', `<button class="btn btn-primary" data-act="woNewType">${ic('plus', 16)} Log your first session</button>`)}</div>`;
  const used = [...new Set(all.map(workoutType))];
  const f = App.ui.fitType || '';
  const ws = f ? all.filter(w => workoutType(w) === f) : all;
  const filter = used.length > 1 ? `<div class="row wrap mb" style="gap:6px"><button class="chip ${!f ? 'on' : ''}" data-act="fitType" data-v="">All types</button>${used.map(id => { const t = trainingType(id); return `<button class="chip ${f === id ? 'on' : ''}" data-act="fitType" data-v="${id}">${t.emoji} ${esc(t.label)}</button>`; }).join('')}</div>` : '';
  if (!ws.length) return filter + `<div class="card">${emptyState('dumbbell', 'Nothing of this type yet', '')}</div>`;
  const groups = new Map();
  ws.forEach(w => { const k = ymd(startOfWeek(parseYmd(w.date))); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(w); });
  const thisWk = ymd(startOfWeek(new Date()));
  return filter + [...groups.entries()].map(([k, list]) => `<div class="group-h" style="padding-top:6px">${k === thisWk ? 'This week' : k === ymd(addDays(startOfWeek(new Date()), -7)) ? 'Last week' : 'Week of ' + fmtDate(k)} <span class="badge">${list.length}</span></div>
    <div class="grid g3 mb">${list.map(workoutCard).join('')}</div>`).join('');
}
function fitTypes() {
  const days = Number(App.ui.fitRange || 30);
  const from = addDaysStr(todayStr(), -(days - 1));
  const list = db().workouts.filter(w => w.date >= from);
  const by = {};
  list.forEach(w => { const t = workoutType(w); by[t] ||= { n: 0, min: 0, cal: 0 }; by[t].n++; by[t].min += workoutMinutes(w); by[t].cal += Number(w.cal) || 0; });
  const rows = Object.entries(by).sort((a, b) => b[1].min - a[1].min || b[1].n - a[1].n);
  const maxMin = Math.max(1, ...rows.map(r => r[1].min));
  const totalMin = sum(rows.map(r => r[1].min));
  const rpeList = list.filter(w => w.rpe);
  return `<div class="row wrap mb"><span class="muted">Your mix of training in the last</span>${seg('fitRange', [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }, { value: 365, label: 'Year' }], days)}</div>
    <div class="grid g4 mb">
      <div class="card stat"><span class="k">Sessions</span><span class="v">${list.length}</span></div>
      <div class="card stat"><span class="k">Active time</span><span class="v">${fmtDuration(totalMin)}</span></div>
      <div class="card stat"><span class="k">Types done</span><span class="v">${rows.length}</span></div>
      <div class="card stat"><span class="k">Avg intensity</span><span class="v">${rpeList.length ? num(sum(rpeList.map(w => w.rpe)) / rpeList.length, 1) + '/10' : '—'}</span></div>
    </div>
    <div class="split">
      <div class="card"><div class="card-title">Time per training type</div>
        ${rows.length ? `<div class="col" style="gap:14px">${rows.map(([id, r]) => { const t = trainingType(id); return `<div class="macro" style="cursor:pointer" data-act="fitTypeGo" data-v="${id}"><div class="row between"><span>${t.emoji} <b>${esc(t.label)}</b></span><span class="num faint small">${plural(r.n, 'session')} · <b style="color:var(--text)">${fmtDuration(r.min)}</b>${r.cal ? ` · ${num(r.cal)} kcal` : ''}</span></div>${bar(r.min / maxMin, t.color)}</div>`; }).join('')}</div>`
          : emptyState('layers', 'No sessions in this period', '', '', true)}</div>
      <div class="card"><div class="card-title">Start a session</div>
        <div class="col" style="gap:6px">${TRAINING_TYPES.map(t => `<button class="habit-btn" style="--c:${t.color}" data-act="woStartType" data-v="${t.id}"><span class="em">${t.emoji}</span><span style="flex:1;font-weight:600">${esc(t.label)}</span>${ic('plus', 15)}</button>`).join('')}</div></div>
    </div>`;
}
function openQuickActivity(defaults = {}) {
  formModal({
    title: 'Quick log a session',
    intro: '<p class="muted small mb">For classes, matches, runs and anything you don’t track set by set.</p>',
    values: { type: defaults.type || 'running', name: '', date: todayStr(), duration: 45, dist: '', rpe: 6, cal: '', notes: '' },
    fields: [
      { key: 'type', label: 'Training type', type: 'select', options: typeOptions },
      { key: 'name', label: 'Name (optional)', placeholder: 'e.g. Evening football, Vinyasa class, 5K run' },
      { key: 'date', label: 'Date', type: 'date', required: true, third: true },
      { key: 'duration', label: 'Minutes', type: 'number', min: 1, max: 1440, required: true, third: true },
      { key: 'dist', label: `Distance (${cfg().distUnit})`, type: 'number', step: 'any', min: 0, third: true, hint: 'optional' },
      { key: 'rpe', label: 'Intensity (1 easy – 10 all-out)', type: 'range', min: 1, max: 10 },
      { key: 'cal', label: 'Calories burned (optional)', type: 'number', min: 0, max: 20000 },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
    ],
    onSave: v => {
      const t = trainingType(v.type);
      const exercises = v.dist ? [{ name: { running: 'Running', cycling: 'Cycling', swimming: 'Swimming', walking: 'Walking' }[v.type] || t.label, kind: 'cardio', sets: [{ min: v.duration, dist: v.dist }] }] : [];
      update(s => { s.workouts.push({ id: uid(), created: Date.now(), type: v.type, name: v.name || t.label.split(' /')[0], date: v.date, duration: v.duration, rpe: v.rpe, cal: v.cal ?? '', notes: v.notes, exercises }); });
      renderNav();
      toast(`${t.emoji} ${fmtDuration(v.duration)} of ${t.label.toLowerCase()} logged!`, { type: 'success' });
    },
  });
}
function fitRoutines() {
  const ts = db().templates;
  return `<div class="row mb"><span class="muted">Routines are reusable workout plans. Start one to pre-fill your sets.</span><span class="spacer"></span><button class="btn" data-act="tplNew">${ic('plus', 16)} New routine</button></div>
  ${ts.length ? `<div class="grid g3">${ts.map(t => `<div class="card">
      <div class="row between mb-s"><div class="li-title">${trainingType(t.type || guessType(t.exercises)).emoji} ${esc(t.name)}</div><button class="btn-icon sm" data-act="tplEdit" data-id="${t.id}" aria-label="Edit routine">${ic('edit', 15)}</button></div>
      ${t.exercises.map(e => `<div class="wo-ex"><b class="truncate">${esc(e.name)}</b><span>${esc(setsSummary(e))}</span></div>`).join('') || '<p class="faint small">No exercises</p>'}
      <div class="row mt"><button class="btn btn-primary btn-block" data-act="tplStart" data-id="${t.id}">${ic('play', 14)} Start</button></div>
      <p class="faint tiny mt-s">${(() => { const n = db().workouts.filter(w => w.templateId === t.id).length; return n ? `Done ${plural(n, 'time')}` : 'Not done yet'; })()}</p>
    </div>`).join('')}</div>`
    : `<div class="card">${emptyState('copy', 'No routines yet', 'Create routines like “Push / Pull / Legs” or “Full body A”, or save any logged workout as a routine.', `<button class="btn btn-primary" data-act="tplNew">${ic('plus', 16)} New routine</button>`)}</div>`}`;
}
function fitProgress() {
  const stats = exerciseStats();
  if (!stats.length) return `<div class="card">${emptyState('trophy', 'No strength data yet', 'Log a few workouts with weights and your PRs and progress charts will appear here.')}</div>`;
  const sel = stats.find(s => s.name === App.ui.fitEx) || stats[0];
  const weeks = 12, wkStart = startOfWeek(new Date());
  const labels = [], vols = [], counts = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = addDays(wkStart, -7 * i);
    labels.push(fmtDate(ymd(s)));
    const list = workoutsInWeek(s);
    vols.push(sum(list.map(workoutVolume))); counts.push(list.length);
  }
  return `<div class="grid g2 mb">
    <div class="card"><div class="card-title">Estimated 1-rep max <span class="spacer"></span>
      <select class="input input-sm" style="max-width:220px" data-change="fitEx" aria-label="Exercise">${stats.map(s => `<option ${s.name === sel.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      ${chartSlot({ type: 'line', points: sel.history.slice(-30).map(h => ({ label: fmtDate(h.date), v: Math.round(h.v * 10) / 10 })), color: '#f97316', fmt: v => num(v) + '', empty: 'Log this exercise a few times to see a trend' })}
      <div class="row mt-s" style="gap:20px"><div class="stat"><span class="k">Best e1RM</span><span class="v" style="font-size:1.2rem">${num(sel.best1rm, 1)} ${wu()}</span></div><div class="stat"><span class="k">Heaviest</span><span class="v" style="font-size:1.2rem">${num(sel.best, 2)} × ${sel.bestReps}</span></div><div class="stat"><span class="k">Sessions</span><span class="v" style="font-size:1.2rem">${sel.sessions}</span></div></div>
    </div>
    <div class="card"><div class="card-title">Weekly volume <span class="card-sub">${wu()} · last 12 weeks</span></div>
      ${chartSlot({ type: 'bar', labels, series: [{ name: 'Volume', color: '#8b5cf6', values: vols }], fmt: v => v >= 1000 ? num(v / 1000, 1) + 'k' : num(v) })}
      <div class="card-title mt" style="margin-bottom:8px">Workouts per week</div>
      ${chartSlot({ type: 'bar', h: 120, labels, series: [{ name: 'Workouts', color: v => v >= (cfg().workoutGoal || 4) ? '#22c55e' : '#f97316', values: counts }], goal: cfg().workoutGoal || 4, fmt: v => num(v) })}
    </div></div>
    <div class="card"><div class="card-title">${ic('trophy', 18)} Personal records</div><div class="table-wrap"><table class="table">
      <thead><tr><th>Exercise</th><th>Heaviest set</th><th>Best e1RM</th><th>Sessions</th><th>Last done</th></tr></thead>
      <tbody>${stats.map(s => `<tr class="click" data-act="fitExPick" data-name="${esc(s.name)}"><td><b>${esc(s.name)}</b></td><td>${num(s.best, 2)} ${wu()} × ${s.bestReps}</td><td>${num(s.best1rm, 1)} ${wu()}</td><td>${s.sessions}</td><td>${esc(relDay(s.last))}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function fitBody() {
  const bw = [...db().bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const goal = cfg().goalWeight;
  const cur = bw[bw.length - 1];
  const monthAgo = bw.filter(b => b.date <= addDaysStr(todayStr(), -30)).pop() || bw[0];
  const change = cur && monthAgo ? cur.value - monthAgo.value : 0;
  return `<div class="grid g4 mb">
    <div class="card stat"><span class="k">Current</span><span class="v">${cur ? num(cur.value, 1) : '—'} <small class="faint" style="font-size:.9rem">${wu()}</small></span><span class="d">${cur ? relDay(cur.date) : 'no entries'}</span></div>
    <div class="card stat"><span class="k">30-day change</span><span class="v ${change < 0 ? 'success-text' : change > 0 ? 'warn-text' : ''}">${cur ? (change > 0 ? '+' : '') + num(change, 1) : '—'}</span><span class="d">${wu()}</span></div>
    <div class="card stat"><span class="k">Goal</span><span class="v">${goal ? num(goal, 1) : '—'}</span><span class="d">${goal && cur ? `${num(Math.abs(cur.value - goal), 1)} ${wu()} to go` : `<a href="#" data-act="setGoalWeight">Set a goal</a>`}</span></div>
    <div class="card stat"><span class="k">Body fat</span><span class="v">${bw.filter(b => b.fat).pop()?.fat ? num(bw.filter(b => b.fat).pop().fat, 1) + '%' : '—'}</span><span class="d">latest</span></div>
  </div>
  <div class="split">
    <div class="card"><div class="card-title">Weight trend<span class="spacer"></span><button class="btn btn-sm" data-act="setGoalWeight">${ic('target', 14)} Goal</button><button class="btn btn-sm btn-primary" data-act="bodyNew">${ic('plus', 14)} Log weight</button></div>
      ${chartSlot({ type: 'line', h: 240, points: bw.slice(-60).map(b => ({ label: fmtDate(b.date), v: b.value })), goal: goal || null, goalLabel: 'Goal', color: '#06b6d4', fmt: v => num(v, 1), empty: 'Log your weight to see a trend' })}</div>
    <div class="card"><div class="card-title">History</div>
      ${bw.length ? `<div class="list" style="max-height:330px;overflow:auto">${[...bw].reverse().map((b, i, arr) => {
        const prev = arr[i + 1]; const df = prev ? b.value - prev.value : 0;
        return `<div class="li click" data-act="bodyEdit" data-id="${b.id}"><div class="grow"><div class="li-title num">${num(b.value, 1)} ${wu()}</div><div class="li-sub">${esc(relDay(b.date))}${b.fat ? ` · ${num(b.fat, 1)}% fat` : ''}</div></div>${prev ? `<span class="small ${df < 0 ? 'success-text' : df > 0 ? 'warn-text' : 'faint'}">${df > 0 ? '+' : ''}${num(df, 1)}</span>` : ''}</div>`;
      }).join('')}</div>` : emptyState('scale', 'No entries yet', '', `<button class="btn btn-primary btn-sm" data-act="bodyNew">Log weight</button>`, true)}</div>
  </div>`;
}

Object.assign(App.actions, {
  fitTab: el => { App.ui.fitTab = el.dataset.val; renderView(); },
  woNew: () => openWorkoutEditor(null),
  woNewType: el => openMenu(el, [
    { label: 'Gym workout (sets & reps)', icon: 'dumbbell', color: '#f97316', onClick: () => openWorkoutEditor(null, { type: 'strength' }) },
    { label: 'Quick log any session', icon: 'zap', color: '#8b5cf6', onClick: () => openQuickActivity() },
    '-',
    ...TRAINING_TYPES.filter(t => t.id !== 'strength').map(t => ({ label: `${t.emoji}  ${t.label}`, onClick: () => App.actions.woStartType({ dataset: { v: t.id } }) })),
  ], { align: 'right' }),
  woQuick: () => openQuickActivity(),
  woStartType: el => {
    const id = el.dataset.v;
    // set-based types open the full editor, everything else the quick form
    if (['strength', 'calisthenics', 'crossfit', 'hiit'].includes(id)) openWorkoutEditor(null, { type: id });
    else openQuickActivity({ type: id });
  },
  fitType: el => { App.ui.fitType = el.dataset.v; renderView(); },
  fitTypeGo: el => { App.ui.fitType = el.dataset.v; App.ui.fitTab = 'log'; renderView(); },
  fitRange: el => { App.ui.fitRange = Number(el.dataset.val); renderView(); },
  woOpen: el => openWorkoutEditor(db().workouts.find(w => w.id === el.dataset.id)),
  woFromTpl: el => openMenu(el, db().templates.map(t => ({ label: t.name, icon: 'play', onClick: () => openWorkoutEditor(null, { template: t }) })), { align: 'right' }),
  tplNew: () => openWorkoutEditor(null, { mode: 'template' }),
  tplEdit: el => openWorkoutEditor(db().templates.find(t => t.id === el.dataset.id), { mode: 'template' }),
  tplStart: el => openWorkoutEditor(null, { template: db().templates.find(t => t.id === el.dataset.id) }),
  fitEx: el => { App.ui.fitEx = el.value; renderView(); },
  fitExPick: el => { App.ui.fitEx = el.dataset.name; renderView(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  bodyNew: () => openBodyForm(null),
  bodyEdit: el => openBodyForm(db().bodyweight.find(b => b.id === el.dataset.id)),
  setGoalWeight: () => formModal({
    title: 'Goal weight', values: { goalWeight: cfg().goalWeight },
    fields: [{ key: 'goalWeight', label: `Goal weight (${wu()})`, type: 'number', step: 'any', min: 1, max: 2000, hint: 'Leave empty to remove the goal.' }],
    onSave: v => update(s => { s.settings.goalWeight = v.goalWeight; }),
  }),
});
