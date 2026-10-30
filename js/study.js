/* ============================================================
   Study — subjects of any kind (school, languages, coding,
   music, certifications…), study sessions by type, topics,
   exams & deadlines with grades.
   ============================================================ */
'use strict';

const STUDY_AREAS = [
  { id: 'school', label: 'School / University', emoji: '🏫' },
  { id: 'language', label: 'Language', emoji: '🗣️' },
  { id: 'programming', label: 'Programming & Tech', emoji: '💻' },
  { id: 'science', label: 'Math & Science', emoji: '🧮' },
  { id: 'music', label: 'Music', emoji: '🎹' },
  { id: 'art', label: 'Art & Design', emoji: '🎨' },
  { id: 'business', label: 'Business & Finance', emoji: '📈' },
  { id: 'cert', label: 'Exam / Certification prep', emoji: '📜' },
  { id: 'course', label: 'Online course', emoji: '🎓' },
  { id: 'reading', label: 'Reading & Self-study', emoji: '📚' },
  { id: 'skill', label: 'Practical skill', emoji: '🛠️' },
  { id: 'other', label: 'Other', emoji: '✨' },
];
const STUDY_KINDS = [
  { id: 'reading', label: 'Reading', emoji: '📖' },
  { id: 'class', label: 'Lecture / Class', emoji: '🏫' },
  { id: 'video', label: 'Video course', emoji: '🎬' },
  { id: 'practice', label: 'Practice / Exercises', emoji: '✏️' },
  { id: 'homework', label: 'Homework / Assignment', emoji: '📝' },
  { id: 'revision', label: 'Revision / Review', emoji: '🔁' },
  { id: 'flashcards', label: 'Flashcards / Memorizing', emoji: '🃏' },
  { id: 'writing', label: 'Writing', emoji: '✍️' },
  { id: 'listening', label: 'Listening', emoji: '🎧' },
  { id: 'speaking', label: 'Speaking / Conversation', emoji: '💬' },
  { id: 'project', label: 'Project / Coding', emoji: '🧩' },
  { id: 'mock', label: 'Mock exam / Past papers', emoji: '🧪' },
  { id: 'tutor', label: 'Tutoring / Lesson', emoji: '👩‍🏫' },
  { id: 'research', label: 'Research', emoji: '🔎' },
  { id: 'instrument', label: 'Instrument practice', emoji: '🎼' },
  { id: 'focus', label: 'Focus timer session', emoji: '⏱️' },
];
const EXAM_KINDS = ['Exam', 'Midterm', 'Final', 'Quiz', 'Test', 'Assignment', 'Project', 'Presentation', 'Essay', 'Certification', 'Interview', 'Recital'];

const studyArea = id => STUDY_AREAS.find(a => a.id === id) || STUDY_AREAS[STUDY_AREAS.length - 1];
const studyKind = id => STUDY_KINDS.find(k => k.id === id) || STUDY_KINDS[3];
const subjectById = id => db().subjects.find(s => s.id === id);
const activeSubjects = () => db().subjects.filter(s => !s.archived);
const sessionsBetween = (from, to, subjectId) => db().studyLog.filter(x => x.date >= from && x.date <= to && (!subjectId || x.subjectId === subjectId));
function studyWeek(subjectId, d = new Date()) {
  const s = ymd(startOfWeek(d)), e = ymd(addDays(startOfWeek(d), 6));
  return sum(sessionsBetween(s, e, subjectId).map(x => x.minutes));
}
function studyStreak() {
  const days = new Set(db().studyLog.map(x => x.date));
  let d = todayStr(), n = 0;
  if (!days.has(d)) d = addDaysStr(d, -1);
  while (days.has(d) && n < 3650) { n++; d = addDaysStr(d, -1); }
  return n;
}
const upcomingExams = () => db().exams.filter(x => !x.done && x.date >= todayStr()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
const examPct = x => x.score != null && x.score !== '' && Number(x.maxScore) > 0 ? Number(x.score) / Number(x.maxScore) : null;
const subjectOptions = (withNone = false) => [...(withNone ? [{ value: '', label: '— No subject —' }] : []), ...activeSubjects().map(s => ({ value: s.id, label: `${s.emoji} ${s.name}` }))];
const hm = min => fmtDuration(min);

function logStudy(entry) {
  const e = { id: uid(), created: Date.now(), date: todayStr(), minutes: 25, kind: 'practice', notes: '', quality: 0, ...entry };
  db().studyLog.push(e);
  save();
  return e;
}

function openSubjectForm(s) {
  const isNew = !s;
  formModal({
    title: isNew ? 'New subject' : 'Edit subject',
    values: s ? { ...s, weeklyGoalH: (s.weeklyGoal || 0) / 60 } : { name: '', emoji: '📘', color: PALETTE[Math.floor(Math.random() * 12)], area: 'school', weeklyGoalH: 3, level: '', teacher: '', topics: [], notes: '' },
    fields: [
      { key: 'name', label: 'Subject', required: true, placeholder: 'e.g. Calculus II, English, Python, Piano, IELTS', autofocus: true },
      { key: 'area', label: 'Type of study', type: 'select', options: STUDY_AREAS.map(a => ({ value: a.id, label: `${a.emoji}  ${a.label}` })), half: true },
      { key: 'weeklyGoalH', label: 'Weekly goal (hours)', type: 'number', step: 0.5, min: 0, max: 100, half: true },
      { key: 'level', label: 'Level / grade (optional)', placeholder: 'e.g. B1, Year 2, Grade 5', half: true },
      { key: 'teacher', label: 'Teacher / course / platform', placeholder: 'e.g. Prof. Hakobyan, Coursera', half: true },
      { key: 'emoji', label: 'Icon', type: 'emoji' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'topics', label: 'Topics / chapters / units', type: 'checklist', hint: 'Tick them off as you master them.' },
      { key: 'notes', label: 'Notes, links, resources', type: 'textarea', rows: 3 },
    ],
    onMount: form => {
      const em = form.querySelector('[name=emoji]'), area = form.querySelector('[name=area]');
      area.addEventListener('change', () => { if (isNew && ['📘', ...STUDY_AREAS.map(a => a.emoji)].includes(em.value)) em.value = studyArea(area.value).emoji; });
    },
    onSave: v => {
      v.weeklyGoal = Math.round((v.weeklyGoalH || 0) * 60); delete v.weeklyGoalH;
      if (!v.emoji) v.emoji = studyArea(v.area).emoji;
      update(st => { if (isNew) st.subjects.push({ id: uid(), created: todayStr(), archived: false, ...v }); else Object.assign(st.subjects.find(x => x.id === s.id), v); });
      toast(isNew ? `Added ${v.name} 📚` : 'Subject saved', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo(`Deleted ${s.name} (its sessions are kept)`, st => { st.subjects = st.subjects.filter(x => x.id !== s.id); }),
    extraFoot: isNew ? '' : `<button type="button" class="btn btn-ghost" data-close onclick="App.actions.subjArchive({dataset:{id:'${s.id}'}})">${ic('archive', 16)} ${s.archived ? 'Restore' : 'Archive'}</button>`,
  });
}
function openStudyForm(entry, defaults = {}) {
  const isNew = !entry;
  if (!activeSubjects().length && isNew) { toast('Add a subject first'); openSubjectForm(null); return; }
  formModal({
    title: isNew ? 'Log study session' : 'Edit study session',
    values: entry || { subjectId: defaults.subjectId || App.ui.lastSubject || activeSubjects()[0].id, kind: defaults.kind || App.ui.lastStudyKind || 'practice', date: todayStr(), minutes: 45, quality: 3, notes: '' },
    fields: [
      { key: 'subjectId', label: 'Subject', type: 'select', options: () => subjectOptions(), required: true },
      { key: 'kind', label: 'What kind of studying?', type: 'select', options: STUDY_KINDS.map(k => ({ value: k.id, label: `${k.emoji}  ${k.label}` })) },
      { key: 'date', label: 'Date', type: 'date', required: true, half: true },
      { key: 'minutes', label: 'Minutes', type: 'number', min: 1, max: 1440, required: true, half: true },
      { key: 'quality', label: 'Focus / quality', type: 'seg', options: [{ value: 1, label: '😵' }, { value: 2, label: '😕' }, { value: 3, label: '😐' }, { value: 4, label: '🙂' }, { value: 5, label: '🧠' }] },
      { key: 'notes', label: 'What did you cover?', type: 'textarea', rows: 3, placeholder: 'Chapter 4, 30 new words, past paper 2023…' },
    ],
    onSave: v => {
      v.quality = Number(v.quality) || 0;
      App.ui.lastSubject = v.subjectId; App.ui.lastStudyKind = v.kind;
      update(st => { if (isNew) st.studyLog.push({ id: uid(), created: Date.now(), ...v }); else Object.assign(st.studyLog.find(x => x.id === entry.id), v); });
      const sub = subjectById(v.subjectId);
      toast(isNew ? `${studyKind(v.kind).emoji} ${hm(v.minutes)} of ${sub?.name || 'study'} logged` : 'Session saved', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo('Session deleted', st => { st.studyLog = st.studyLog.filter(x => x.id !== entry.id); }),
  });
}
function openExamForm(x, defaults = {}) {
  const isNew = !x;
  formModal({
    title: isNew ? 'New exam or deadline' : 'Edit exam / deadline',
    values: x || { title: '', kind: 'Exam', subjectId: defaults.subjectId || activeSubjects()[0]?.id || '', date: addDaysStr(todayStr(), 7), time: '', location: '', score: '', maxScore: 100, done: false, notes: '' },
    fields: [
      { key: 'title', label: 'Title', required: true, placeholder: 'e.g. Midterm, Essay on Hamlet, IELTS Speaking', autofocus: true },
      { key: 'kind', label: 'Type', type: 'select', options: EXAM_KINDS, half: true },
      { key: 'subjectId', label: 'Subject', type: 'select', options: () => subjectOptions(true), half: true },
      { key: 'date', label: 'Date', type: 'date', required: true, third: true },
      { key: 'time', label: 'Time (optional)', type: 'time', third: true },
      { key: 'location', label: 'Room / link', third: true },
      { key: 'done', label: 'Finished / submitted', type: 'checkbox' },
      { key: 'score', label: 'Score', type: 'number', step: 'any', min: 0, half: true, showIf: v => v.done },
      { key: 'maxScore', label: 'Out of', type: 'number', step: 'any', min: 0.01, half: true, showIf: v => v.done },
      { key: 'notes', label: 'Notes / what to study', type: 'textarea', rows: 2 },
    ],
    onSave: v => {
      update(st => { if (isNew) st.exams.push({ id: uid(), created: Date.now(), ...v }); else Object.assign(st.exams.find(y => y.id === x.id), v); });
      toast(isNew ? `${v.kind} added — ${relDay(v.date)}` : 'Saved', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo('Deleted', st => { st.exams = st.exams.filter(y => y.id !== x.id); }),
  });
}

/* ---------- View ---------- */
function examRow(x) {
  const sub = subjectById(x.subjectId);
  const left = dayDiff(todayStr(), x.date);
  const pct = examPct(x);
  const when = x.done ? (pct != null ? `<b class="${pct >= .5 ? 'success-text' : 'danger-text'}">${num(x.score, 1)}/${num(x.maxScore, 1)} · ${Math.round(pct * 100)}%</b>` : '<span class="chip">done</span>')
    : left < 0 ? `<span class="danger-text small">${-left}d overdue</span>` : left === 0 ? '<span class="chip c" style="--c:var(--danger)">Today</span>' : `<span class="chip c" style="--c:${left <= 3 ? 'var(--danger)' : left <= 7 ? 'var(--warn)' : 'var(--info)'}">in ${plural(left, 'day')}</span>`;
  return `<div class="li click" data-act="examEdit" data-id="${x.id}"><span class="habit-em" style="--c:${sub?.color || '#8b5cf6'};width:38px;height:38px;font-size:1.1rem">${esc(sub?.emoji || '🎓')}</span>
    <div class="grow"><div class="li-title truncate">${esc(x.title)}</div><div class="li-sub">${esc(x.kind)}${sub ? ' · ' + esc(sub.name) : ''} · ${esc(relDay(x.date))}${x.time ? ' ' + fmtTime(x.time) : ''}${x.location ? ' · ' + esc(x.location) : ''}</div></div>${when}</div>`;
}
function sessionRow(x) {
  const sub = subjectById(x.subjectId), k = studyKind(x.kind);
  return `<div class="li click" data-act="studyEdit" data-id="${x.id}"><span style="font-size:1.25rem;width:28px;text-align:center">${k.emoji}</span>
    <div class="grow"><div class="li-title truncate">${esc(sub?.name || 'Deleted subject')} <span class="faint small" style="font-weight:500">· ${esc(k.label)}</span></div><div class="li-sub truncate">${esc(x.notes || relDay(x.date))}</div></div>
    ${x.quality ? `<span title="Focus">${['😵', '😕', '😐', '🙂', '🧠'][x.quality - 1]}</span>` : ''}<b class="num">${hm(x.minutes)}</b></div>`;
}
function subjectCard(s) {
  const wk = studyWeek(s.id), goal = s.weeklyGoal || 0;
  const total = sum(db().studyLog.filter(x => x.subjectId === s.id).map(x => x.minutes));
  const topics = s.topics || [], tDone = topics.filter(t => t.done).length;
  const next = upcomingExams().find(x => x.subjectId === s.id);
  const open = App.ui.subjOpen === s.id;
  return `<div class="card goal-card" style="--c:${s.color}">
    <div class="row between" style="align-items:flex-start"><div class="row" style="min-width:0;gap:12px"><span class="habit-em" style="--c:${s.color}">${esc(s.emoji)}</span><div style="min-width:0"><h4 class="truncate">${esc(s.name)}</h4><div class="li-sub">${esc(studyArea(s.area).label)}${s.level ? ' · ' + esc(s.level) : ''}${s.teacher ? ' · ' + esc(s.teacher) : ''}</div></div></div>
      <button class="btn-icon sm" data-act="subjEdit" data-id="${s.id}" aria-label="Edit subject">${ic('edit', 15)}</button></div>
    <div><div class="row between small mb-s" style="margin-bottom:5px"><span class="faint">This week</span><span class="num"><b>${hm(wk)}</b>${goal ? ` / ${hm(goal)}` : ''}</span></div>${goal ? bar(wk / goal, s.color) : ''}</div>
    ${topics.length ? `<div><div class="row between small" style="margin-bottom:5px"><span class="faint">Topics</span><span class="num"><b>${tDone}</b> / ${topics.length}</span></div>${bar(tDone / topics.length, s.color, 'thin')}
      <button class="btn btn-sm btn-ghost mt-s" data-act="subjOpen" data-id="${s.id}">${ic(open ? 'up' : 'down', 14)} ${open ? 'Hide' : 'Show'} topics</button>
      ${open ? `<div class="ms-list mt-s">${topics.map(t => `<div class="ms ${t.done ? 'done' : ''}" data-act="topicToggle" data-id="${s.id}" data-tid="${t.id}"><span class="check sm ${t.done ? 'on' : ''}">${ic('check', 11, 'stroke-width="3"')}</span><span>${esc(t.title)}</span></div>`).join('')}</div>` : ''}</div>` : ''}
    ${next ? `<div class="small"><span class="faint">Next:</span> <b>${esc(next.title)}</b> · ${esc(relDay(next.date))}</div>` : ''}
    <div class="row wrap" style="gap:8px"><span class="faint small">${hm(total)} total</span><span class="spacer"></span>
      ${moduleOn('focus') ? `<button class="btn btn-sm btn-ghost" data-act="subjFocus" data-id="${s.id}" title="Start a focus timer for this subject">${ic('timer', 14)} Focus</button>` : ''}
      <button class="btn btn-sm btn-soft" data-act="studyNew" data-subject="${s.id}">${ic('plus', 14)} Log</button></div>
  </div>`;
}

App.views.study = {
  title: 'Study',
  render() {
    const tab = App.ui.studyTab || 'overview';
    const T = todayStr();
    const subs = activeSubjects();
    const weekMin = studyWeek();
    const goal = sum(subs.map(s => s.weeklyGoal || 0)) || cfg().studyGoalMin || 600;
    const todayMin = sum(sessionsBetween(T, T).map(x => x.minutes));
    const next = upcomingExams()[0];
    const head = `<div class="page-head"><div><h2>Study</h2><p>Learn a little every day.</p></div>
      <div class="actions">
        <button class="btn" data-act="examNew">${ic('flag', 16)} Exam / deadline</button>
        <button class="btn" data-act="subjNew">${ic('plus', 16)} Subject</button>
        <button class="btn btn-primary" data-act="studyNew">${ic('plus', 16)} Log study</button></div></div>
      <div class="grid g4 mb">
        <div class="card stat-card">${ring(weekMin / goal, { size: 64, sw: 7, font: 13, color: '#8b5cf6' })}<div class="stat"><span class="k">This week</span><span class="v">${hm(weekMin)}</span><span class="d">goal ${hm(goal)}</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#f97316">${ic('flame', 22)}</div><div class="stat"><span class="k">Study streak</span><span class="v">${plural(studyStreak(), 'day')}</span><span class="d">${todayMin ? hm(todayMin) + ' today' : 'nothing yet today'}</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#06b6d4">${ic('cap', 22)}</div><div class="stat"><span class="k">Subjects</span><span class="v">${subs.length}</span><span class="d">${hm(sum(db().studyLog.map(x => x.minutes)))} all time</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#ef4444">${ic('flag', 22)}</div><div class="stat" style="min-width:0"><span class="k">Next deadline</span><span class="v truncate" style="font-size:1.1rem">${next ? esc(next.title) : '—'}</span><span class="d">${next ? esc(relDay(next.date)) + (dayDiff(T, next.date) > 1 ? ` · ${dayDiff(T, next.date)} days` : '') : 'nothing coming up'}</span></div></div>
      </div>
      ${tabs('studyTab', [{ value: 'overview', label: 'Overview', icon: 'grid' }, { value: 'subjects', label: 'Subjects', icon: 'cap', count: subs.length }, { value: 'sessions', label: 'Sessions', icon: 'list' }, { value: 'exams', label: 'Exams & deadlines', icon: 'flag', count: upcomingExams().length }], tab)}`;
    if (!db().subjects.length) return head + `<div class="card">${emptyState('cap', 'What are you learning?', 'Add subjects of any kind — university courses, languages, programming, music, driving theory, certifications — then log study sessions by type (reading, practice, flashcards, lectures…).', `<button class="btn btn-primary" data-act="subjNew">${ic('plus', 16)} Add your first subject</button>`)}
      <div class="row wrap center" style="justify-content:center;gap:6px;margin-top:-8px">${STUDY_AREAS.slice(0, 10).map(a => `<button class="chip" data-act="subjNewArea" data-area="${a.id}">${a.emoji} ${esc(a.label)}</button>`).join('')}</div></div>`;
    return head + ({ overview: studyOverview, subjects: studySubjects, sessions: studySessions, exams: studyExams }[tab] || studyOverview)();
  },
};
function studyOverview() {
  const T = todayStr();
  const days = Array.from({ length: 14 }, (_, i) => addDaysStr(T, i - 13));
  const last30 = sessionsBetween(addDaysStr(T, -29), T);
  const byKind = {}, bySub = {};
  last30.forEach(x => { byKind[x.kind] = (byKind[x.kind] || 0) + x.minutes; bySub[x.subjectId] = (bySub[x.subjectId] || 0) + x.minutes; });
  const kinds = Object.entries(byKind).sort((a, b) => b[1] - a[1]);
  const subs = Object.entries(bySub).sort((a, b) => b[1] - a[1]);
  const mk = Math.max(1, ...kinds.map(k => k[1])), ms = Math.max(1, ...subs.map(k => k[1]));
  const recent = [...db().studyLog].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0)).slice(0, 6);
  const ex = upcomingExams().slice(0, 5);
  return `<div class="grid g2 mb">
    <div class="card"><div class="card-title">Study time <span class="card-sub">last 14 days</span></div>
      ${chartSlot({ type: 'bar', h: 200, labels: days.map(d => fmtDate(d)), series: [{ name: 'Minutes', color: '#8b5cf6', values: days.map(d => sum(sessionsBetween(d, d).map(x => x.minutes))) }], fmt: v => v >= 60 ? num(v / 60, 1) + 'h' : num(v) + 'm' })}</div>
    <div class="card"><div class="card-title">Upcoming exams & deadlines <span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="studyTab" data-val="exams">All</button></div>
      ${ex.length ? `<div class="list">${ex.map(examRow).join('')}</div>` : emptyState('flag', 'Nothing coming up', 'Add exams, assignments and other deadlines to get a countdown.', `<button class="btn btn-sm btn-primary" data-act="examNew">Add one</button>`, true)}</div>
  </div>
  <div class="grid g3">
    <div class="card"><div class="card-title">By type of studying <span class="card-sub">30 days</span></div>
      ${kinds.length ? `<div class="col" style="gap:10px">${kinds.map(([k, v]) => `<div class="macro"><div class="row between small"><span>${studyKind(k).emoji} ${esc(studyKind(k).label)}</span><b class="num">${hm(v)}</b></div>${bar(v / mk, '#8b5cf6', 'thin')}</div>`).join('')}</div>` : '<p class="faint small">No sessions yet.</p>'}</div>
    <div class="card"><div class="card-title">By subject <span class="card-sub">30 days</span></div>
      ${subs.length ? `<div class="col" style="gap:10px">${subs.map(([id, v]) => { const s = subjectById(id); return `<div class="macro"><div class="row between small"><span class="truncate">${esc(s?.emoji || '•')} ${esc(s?.name || 'Deleted')}</span><b class="num">${hm(v)}</b></div>${bar(v / ms, s?.color || '#64748b', 'thin')}</div>`; }).join('')}</div>` : '<p class="faint small">No sessions yet.</p>'}</div>
    <div class="card"><div class="card-title">Recent sessions <span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="studyTab" data-val="sessions">All</button></div>
      ${recent.length ? `<div class="list">${recent.map(sessionRow).join('')}</div>` : `<p class="faint small">Log your first session.</p>`}</div>
  </div>`;
}
function studySubjects() {
  const arch = App.ui.subjArch;
  const list = db().subjects.filter(s => arch ? s.archived : !s.archived);
  const areas = [...new Set(list.map(s => s.area))];
  const af = App.ui.subjArea || '';
  const shown = af ? list.filter(s => s.area === af) : list;
  return `<div class="row wrap mb" style="gap:6px">${areas.length > 1 ? `<button class="chip ${!af ? 'on' : ''}" data-act="subjArea" data-area="">All</button>${areas.map(a => `<button class="chip ${af === a ? 'on' : ''}" data-act="subjArea" data-area="${a}">${studyArea(a).emoji} ${esc(studyArea(a).label)}</button>`).join('')}` : ''}<span class="spacer"></span><button class="btn btn-sm ${arch ? 'btn-soft' : 'btn-ghost'}" data-act="subjArchToggle">${ic('archive', 14)} ${arch ? 'Showing archived' : 'Archived'}</button></div>
    ${shown.length ? `<div class="grid g3">${shown.map(subjectCard).join('')}</div>` : `<div class="card">${emptyState('cap', arch ? 'No archived subjects' : 'No subjects here', '')}</div>`}`;
}
function studySessions() {
  const ui = App.ui;
  let list = [...db().studyLog];
  if (ui.studySub) list = list.filter(x => x.subjectId === ui.studySub);
  if (ui.studyKindF) list = list.filter(x => x.kind === ui.studyKindF);
  list.sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  const groups = new Map();
  list.slice(0, 300).forEach(x => { if (!groups.has(x.date)) groups.set(x.date, []); groups.get(x.date).push(x); });
  return `<div class="row wrap mb">
      <select class="input" style="max-width:220px" data-change="studySubF" aria-label="Subject"><option value="">All subjects</option>${db().subjects.map(s => `<option value="${s.id}" ${ui.studySub === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`).join('')}</select>
      <select class="input" style="max-width:240px" data-change="studyKindF" aria-label="Type"><option value="">All types of study</option>${STUDY_KINDS.map(k => `<option value="${k.id}" ${ui.studyKindF === k.id ? 'selected' : ''}>${k.emoji} ${esc(k.label)}</option>`).join('')}</select>
      <span class="spacer"></span><span class="faint small">${plural(list.length, 'session')} · ${hm(sum(list.map(x => x.minutes)))}</span></div>
    <div class="card">${list.length ? [...groups.entries()].map(([d, l]) => `<div class="group-h">${esc(relDay(d))}<span class="spacer"></span><span class="num">${hm(sum(l.map(x => x.minutes)))}</span></div><div class="list">${l.map(sessionRow).join('')}</div>`).join('')
      : emptyState('list', 'No sessions', ui.studySub || ui.studyKindF ? 'Try clearing the filters.' : 'Log a study session to see it here.')}</div>`;
}
function studyExams() {
  const up = upcomingExams();
  const past = db().exams.filter(x => x.done || x.date < todayStr()).sort((a, b) => b.date.localeCompare(a.date));
  const graded = past.filter(x => examPct(x) != null);
  const avg = graded.length ? sum(graded.map(examPct)) / graded.length : null;
  const pts = [...graded].reverse().slice(-20).map(x => ({ label: fmtDate(x.date), v: Math.round(examPct(x) * 100), tip: `${x.title}: ${Math.round(examPct(x) * 100)}%` }));
  return `<div class="split">
    <div class="col" style="gap:var(--gap)">
      <div class="card"><div class="card-title">Coming up <span class="spacer"></span><button class="btn btn-sm btn-primary" data-act="examNew">${ic('plus', 14)} Add</button></div>
        ${up.length ? `<div class="list">${up.map(examRow).join('')}</div>` : emptyState('flag', 'No upcoming exams or deadlines', '', '', true)}</div>
      <div class="card"><div class="card-title">Past & results</div>
        ${past.length ? `<div class="list">${past.map(examRow).join('')}</div>` : '<p class="faint small">Finished exams and grades show here. Mark one as finished and add your score.</p>'}</div>
    </div>
    <div class="col" style="gap:var(--gap)">
      <div class="card stat"><span class="k">Average result</span><span class="v">${avg != null ? Math.round(avg * 100) + '%' : '—'}</span><span class="d">${plural(graded.length, 'graded result')}</span></div>
      <div class="card"><div class="card-title">Results trend</div>${chartSlot({ type: 'line', h: 170, points: pts, yMin: 0, yMax: 100, color: '#22c55e', fmt: v => Math.round(v) + '%', empty: 'Add scores to finished exams' })}</div>
    </div>
  </div>`;
}

Object.assign(App.actions, {
  studyTab: el => { App.ui.studyTab = el.dataset.val; renderView(); },
  studyNew: el => openStudyForm(null, { subjectId: el?.dataset?.subject }),
  studyEdit: el => openStudyForm(db().studyLog.find(x => x.id === el.dataset.id)),
  subjNew: () => openSubjectForm(null),
  subjNewArea: el => { openSubjectForm(null); setTimeout(() => { const s = $('.modal-back:last-child [name=area]'); if (s) { s.value = el.dataset.area; s.dispatchEvent(new Event('change', { bubbles: true })); } }, 30); },
  subjEdit: el => openSubjectForm(db().subjects.find(s => s.id === el.dataset.id)),
  subjOpen: el => { App.ui.subjOpen = App.ui.subjOpen === el.dataset.id ? null : el.dataset.id; renderView(); },
  subjArchive: el => update(s => { const x = s.subjects.find(y => y.id === el.dataset.id); x.archived = !x.archived; toast(x.archived ? 'Subject archived' : 'Subject restored'); }),
  subjArchToggle: () => { App.ui.subjArch = !App.ui.subjArch; renderView(); },
  subjArea: el => { App.ui.subjArea = el.dataset.area; renderView(); },
  subjFocus: el => { Focus.subjectId = el.dataset.id; if (Focus.mode !== 'focus') focusSetMode('focus'); focusStart(); focusPersist(); go('focus'); toast(`Focus timer started for ${subjectById(el.dataset.id)?.name}`); },
  topicToggle: el => update(s => { const t = s.subjects.find(x => x.id === el.dataset.id)?.topics?.find(x => x.id === el.dataset.tid); if (t) t.done = !t.done; }),
  examNew: () => openExamForm(null),
  examEdit: el => openExamForm(db().exams.find(x => x.id === el.dataset.id)),
  studySubF: el => { App.ui.studySub = el.value; renderView(); },
  studyKindF: el => { App.ui.studyKindF = el.value; renderView(); },
});
