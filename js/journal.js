/* ============================================================
   Journal — daily entry, mood, energy, tags, gratitude,
   writing prompts, mood calendar.
   ============================================================ */
'use strict';

const MOODS = [
  { v: 1, e: '😞', l: 'Awful', c: '#ef4444' },
  { v: 2, e: '😕', l: 'Bad', c: '#f97316' },
  { v: 3, e: '😐', l: 'Okay', c: '#eab308' },
  { v: 4, e: '🙂', l: 'Good', c: '#84cc16' },
  { v: 5, e: '😄', l: 'Great', c: '#22c55e' },
];
const PROMPTS = [
  'What made you smile today?', 'What’s one thing you learned today?', 'What drained your energy, and what gave it back?',
  'What would make tomorrow great?', 'Describe a small win from today.', 'What are you worried about, and what can you control?',
  'Who did you appreciate today, and why?', 'What would you tell yourself from a year ago?', 'What did you avoid today?',
  'Where did you spend most of your attention?', 'What are you looking forward to this week?', 'What’s something you want to let go of?',
  'How did you take care of your body today?', 'What surprised you today?', 'If today had a title, what would it be?',
];
const jEntry = ds => db().journal[ds] || null;
function setMood(ds, v) {
  update(s => {
    const e = s.journal[ds] ||= { mood: 0, energy: 0, text: '', grat: ['', '', ''], tags: [] };
    e.mood = e.mood === v ? 0 : v;
    cleanJournal(s, ds);
  });
}
function cleanJournal(s, ds) {
  const e = s.journal[ds];
  if (e && !e.mood && !e.energy && !(e.text || '').trim() && !(e.grat || []).some(g => g && g.trim()) && !(e.tags || []).length) delete s.journal[ds];
}
let jSaveT;
function jWrite(ds, mut) {
  const s = db();
  const e = s.journal[ds] ||= { mood: 0, energy: 0, text: '', grat: ['', '', ''], tags: [] };
  mut(e);
  e.updated = Date.now();
  cleanJournal(s, ds);
  clearTimeout(jSaveT);
  jSaveT = setTimeout(() => { save(); const st = $('#jSaved'); if (st) st.textContent = 'Saved ✓'; }, 400);
  const st = $('#jSaved'); if (st) st.textContent = 'Saving…';
}
function moodChip(m) { const x = MOODS.find(y => y.v === m); return x ? `<span title="${x.l}">${x.e}</span>` : ''; }

App.views.journal = {
  title: 'Journal',
  render() {
    App.ui.jDate ||= todayStr();
    const ds = App.ui.jDate;
    const e = jEntry(ds) || { mood: 0, energy: 0, text: '', grat: ['', '', ''], tags: [] };
    const words = (e.text || '').trim().split(/\s+/).filter(Boolean).length;
    const prompt = App.ui.jPrompt;
    const tags = cfg().journalTags;
    // mood calendar for the month of ds
    const mk = monthKey(ds), first = parseYmd(mk + '-01');
    const lead = (first.getDay() - cfg().weekStart + 7) % 7;
    let pix = weekdayNames('narrow').map(w => `<i class="blank" style="font-weight:700">${esc(w.name)}</i>`).join('') + '<i class="blank"></i>'.repeat(lead);
    for (let d = 1; d <= daysInMonth(mk); d++) {
      const dd = `${mk}-${pad(d)}`, je = jEntry(dd), m = MOODS.find(x => x.v === je?.mood);
      pix += `<i class="${m ? 'has' : ''} ${dd === ds ? 'sel' : ''}" style="${m ? `background:${m.c}` : ''}" data-act="jPick" data-date="${dd}" title="${fmtDate(dd)}${m ? ' · ' + m.l : ''}">${d}</i>`;
    }
    const pts = Array.from({ length: 30 }, (_, i) => { const d = addDaysStr(todayStr(), i - 29); return { label: fmtDate(d), v: jEntry(d)?.mood || null }; });
    const q = (App.ui.jQ || '').toLowerCase();
    const entries = Object.entries(db().journal).filter(([d, x]) => !q || `${x.text} ${(x.grat || []).join(' ')} ${(x.tags || []).join(' ')}`.toLowerCase().includes(q)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
    const streak = (() => { let n = 0, d = todayStr(); if (!jEntry(d)) d = addDaysStr(d, -1); while (jEntry(d) && n < 3650) { n++; d = addDaysStr(d, -1); } return n; })();

    return `<div class="page-head"><div><h2>Journal</h2><p>${streak ? `🔥 ${plural(streak, 'day')} in a row · ` : ''}${plural(Object.keys(db().journal).length, 'entry', 'entries')}</p></div>
      <div class="actions">${dateNav('jDay', ds)}</div></div>
    <div class="split">
      <div class="col" style="gap:var(--gap)">
        <div class="card"><div class="card-title">How are you feeling?</div>
          <div class="mood-row">${MOODS.map(m => `<button class="mood-btn ${e.mood === m.v ? 'on' : ''}" style="--c:${m.c}" data-act="jMood" data-v="${m.v}">${m.e}<small>${m.l}</small></button>`).join('')}</div>
          <div class="row wrap mt" style="gap:14px"><span class="flabel">Energy</span>${seg('jEnergy', [1, 2, 3, 4, 5].map(v => ({ value: v, label: '⚡'.repeat(1) + v })), e.energy || '')}</div>
          <div class="row wrap mt-s" style="gap:6px">${tags.map(t => `<button class="chip ${(e.tags || []).includes(t) ? 'on' : ''}" data-act="jTag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}<button class="chip" data-act="jTagsEdit" aria-label="Edit tags">${ic('edit', 12)}</button></div>
        </div>
        <div class="card">
          <div class="row mb-s"><b>${esc(fmtLong(ds))}</b><span class="spacer"></span><span class="faint tiny" id="jSaved">${e.updated ? 'Saved ✓' : ''}</span><span class="faint tiny">· ${plural(words, 'word')}</span></div>
          ${prompt ? `<div class="prompt-box mb-s">${ic('sparkles', 16)} <span style="flex:1">${esc(prompt)}</span><button class="btn-icon sm" data-act="jPrompt" aria-label="Another prompt">${ic('reset', 15)}</button></div>` : ''}
          <textarea class="input journal-text" id="jText" data-input="jText" placeholder="${esc(prompt || 'Write about your day… anything goes.')}">${esc(e.text || '')}</textarea>
          <div class="row mt-s"><button class="btn btn-sm btn-ghost" data-act="jPrompt">${ic('sparkles', 14)} ${prompt ? 'New prompt' : 'Give me a prompt'}</button></div>
        </div>
        <div class="card"><div class="card-title">🙏 Three things I’m grateful for</div>
          <div class="col">${[0, 1, 2].map(i => `<input class="input" id="jg${i}" data-input="jGrat" data-i="${i}" placeholder="${['Something small…', 'Someone…', 'A moment…'][i]}" value="${esc((e.grat || [])[i] || '')}">`).join('')}</div></div>
      </div>
      <div class="col" style="gap:var(--gap)">
        <div class="card"><div class="card-title">Mood calendar <span class="card-sub">${esc(monthLabel(mk))}</span></div><div class="pixels">${pix}</div>
          <div class="legend mt-s">${MOODS.map(m => `<span><span class="dot" style="--c:${m.c}"></span>${m.l}</span>`).join('')}</div></div>
        <div class="card"><div class="card-title">Mood trend <span class="card-sub">30 days</span></div>${chartSlot({ type: 'line', h: 150, points: pts, yMin: 0.5, yMax: 5.5, color: '#84cc16', fmt: v => (MOODS.find(m => m.v === Math.round(v)) || {}).e || '', empty: 'Pick a mood to start tracking' })}</div>
        <div class="card"><div class="card-title">Entries</div>
          <input class="input input-sm mb-s" id="jQ" placeholder="Search entries" data-input="jQ" value="${esc(App.ui.jQ || '')}">
          ${entries.length ? `<div class="list" style="max-height:360px;overflow:auto">${entries.map(([d, x]) => `<div class="li click" data-act="jPick" data-date="${d}"><span style="font-size:1.25rem;width:26px;text-align:center">${moodChip(x.mood) || '📝'}</span><div class="grow"><div class="li-title">${esc(relDay(d))}</div><div class="li-sub truncate">${esc((x.text || (x.grat || []).filter(Boolean).join(', ') || (x.tags || []).join(', ') || '—').slice(0, 90))}</div></div></div>`).join('')}</div>`
            : '<p class="faint small">No entries yet.</p>'}</div>
      </div>
    </div>`;
  },
};

Object.assign(App.actions, {
  jDay: el => { const d = Number(el.dataset.d); App.ui.jDate = d === 0 ? todayStr() : addDaysStr(App.ui.jDate, d); App.ui.jPrompt = null; renderView(); },
  jDayPick: el => { if (el.value) { App.ui.jDate = el.value; renderView(); } },
  jPick: el => { App.ui.jDate = el.dataset.date; App.ui.jPrompt = null; renderView(); },
  jMood: el => setMood(App.ui.jDate || todayStr(), Number(el.dataset.v)),
  jEnergy: el => update(s => { const ds = App.ui.jDate; const e = s.journal[ds] ||= { mood: 0, energy: 0, text: '', grat: ['', '', ''], tags: [] }; const v = Number(el.dataset.val); e.energy = e.energy === v ? 0 : v; cleanJournal(s, ds); }),
  jTag: el => update(s => { const ds = App.ui.jDate; const e = s.journal[ds] ||= { mood: 0, energy: 0, text: '', grat: ['', '', ''], tags: [] }; e.tags ||= []; const t = el.dataset.tag; e.tags = e.tags.includes(t) ? e.tags.filter(x => x !== t) : [...e.tags, t]; cleanJournal(s, ds); }),
  jText: el => jWrite(App.ui.jDate, e => { e.text = el.value; }),
  jGrat: el => jWrite(App.ui.jDate, e => { e.grat ||= ['', '', '']; e.grat[Number(el.dataset.i)] = el.value; }),
  jPrompt: () => { let p; do { p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]; } while (p === App.ui.jPrompt && PROMPTS.length > 1); App.ui.jPrompt = p; renderView(); $('#jText')?.focus(); },
  jQ: el => { App.ui.jQ = el.value; renderView(); },
  jTagsEdit: () => formModal({
    title: 'Journal tags', values: { tags: cfg().journalTags.join(', ') },
    fields: [{ key: 'tags', label: 'Tags (comma separated)', type: 'textarea', rows: 3 }],
    onSave: v => update(s => { const t = [...new Set(v.tags.split(',').map(x => x.trim()).filter(Boolean))]; s.settings.journalTags = t.length ? t : s.settings.journalTags; }),
  }),
});
