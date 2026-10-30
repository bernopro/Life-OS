/* ============================================================
   Dashboard — customisable widget grid (show/hide, reorder,
   resize). Each widget reads from its module.
   ============================================================ */
'use strict';

const QUOTES = [
  ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant'],
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['Small daily improvements over time lead to stunning results.', 'Robin Sharma'],
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
  ['Discipline is choosing between what you want now and what you want most.', 'Abraham Lincoln (attributed)'],
  ['It always seems impossible until it’s done.', 'Nelson Mandela'],
  ['Take care of your body. It’s the only place you have to live.', 'Jim Rohn'],
  ['Action is the foundational key to all success.', 'Pablo Picasso'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Proverb'],
  ['Done is better than perfect.', 'Sheryl Sandberg'],
  ['Motivation gets you going, but discipline keeps you growing.', 'John C. Maxwell'],
  ['What you do every day matters more than what you do once in a while.', 'Gretchen Rubin'],
  ['A year from now you may wish you had started today.', 'Karen Lamb'],
  ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
  ['Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ['The journey of a thousand miles begins with one step.', 'Lao Tzu'],
  ['Don’t count the days, make the days count.', 'Muhammad Ali'],
];
function greeting() {
  const h = new Date().getHours();
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
  return cfg().name ? `${g}, ${cfg().name}` : g;
}
const wLink = (route, label = 'Open') => moduleOn(route) ? `<a class="w-link" href="#/${route}">${label}${ic('right', 14)}</a>` : '';

const W = {
  today() {
    const T = todayStr();
    const now = new Date();
    const hs = moduleOn('habits') ? habitsForDay(T) : [];
    const stats = [
      moduleOn('tasks') && { b: tasksDueToday().length, s: 'tasks due', r: 'tasks' },
      moduleOn('calendar') && { b: eventsOn(T).length, s: 'events today', r: 'calendar' },
      moduleOn('habits') && { b: `${hs.filter(h => habitDone(h, T)).length}/${hs.length}`, s: 'habits done', r: 'habits' },
      moduleOn('health') && { b: `${num(waterOn(T), 1)}/${cfg().waterGoal}`, s: 'glasses water', r: 'health' },
      moduleOn('fitness') && { b: `${workoutsInWeek().length}/${cfg().workoutGoal}`, s: 'workouts / wk', r: 'fitness' },
      moduleOn('study') && db().subjects.length && { b: hm(studyWeek()), s: 'studied this wk', r: 'study' },
      moduleOn('focus') && { b: fmtDuration(db().focusLog[T]?.minutes || 0), s: 'focused today', r: 'focus' },
    ].filter(Boolean).slice(0, 6);
    return {
      cls: 'hero', head: false,
      body: `<div class="row between" style="align-items:flex-start;position:relative;z-index:1"><div><div class="hero-time" id="heroClock">${esc(fmtTime(minToTime(now.getHours() * 60 + now.getMinutes())))}</div>
        <div class="hero-greet">${esc(greeting())} 👋</div><div class="hero-date">${esc(fmtLong(T))}</div></div>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.16);border:0;color:#fff" data-act="dashEdit">${ic('grid', 15)} Customize</button></div>
        ${stats.length ? `<div class="hero-stats">${stats.map(s => `<a class="hero-stat" href="#/${s.r}"><b>${s.b}</b><span>${esc(s.s)}</span></a>`).join('')}</div>` : ''}`,
    };
  },
  agenda() {
    const T = todayStr(), tm = addDaysStr(T, 1);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const day = (ds, label) => {
      const items = calItemsOn(ds, { events: true, tasks: false, workouts: false, bills: true });
      return `<div class="group-h">${label}</div>${items.length ? items.map(it => {
        const past = ds === T && !it.allDay && it.end && timeToMin(it.end) < nowMin;
        return `<div class="mini-ev" style="--c:${it.color};${past ? 'opacity:.5' : ''}" data-act="calOpen" data-kind="${it.kind}" data-id="${it.id}" data-date="${ds}"><span class="bar-v"></span><div style="min-width:0"><div class="ttl truncate" style="font-weight:600">${esc(it.title)}</div><div class="t">${esc(itemTimeLabel(it))}${it.ev?.location ? ' · ' + esc(it.ev.location) : ''}</div></div></div>`;
      }).join('') : `<p class="faint small">Nothing scheduled</p>`}`;
    };
    return { link: wLink('calendar'), body: `${day(T, 'Today')}${day(tm, 'Tomorrow')}<div class="mt-s"><button class="btn btn-sm btn-ghost" data-act="calNew" data-date="${T}">${ic('plus', 14)} Add event</button></div>` };
  },
  tasks() {
    const T = todayStr();
    let list = sortTasks(openTasks().filter(t => t.due && t.due <= T), 'due');
    const upcoming = list.length < 3 ? sortTasks(openTasks().filter(t => t.due > T), 'due').slice(0, 3) : [];
    const rows = list.slice(0, 7).map(t => taskRow(t, { compact: true })).join('');
    return {
      link: wLink('tasks'),
      body: `<div class="quick-add mb-s" style="box-shadow:none;padding:2px 4px 2px 12px">${ic('plus', 16, 'style="color:var(--text-3)"')}<input id="dashTask" placeholder="Add a task for today…" data-enter="dashAddTask" aria-label="Add task"></div>
        ${rows || (upcoming.length ? '' : `<div class="empty sm"><div class="e-ic">${ic('check', 20)}</div><h4>All clear</h4><p>Nothing due today.</p></div>`)}
        ${list.length > 7 ? `<a class="faint small" href="#/tasks">+${list.length - 7} more</a>` : ''}
        ${upcoming.length ? `<div class="group-h">Coming up</div>${upcoming.map(t => taskRow(t, { compact: true })).join('')}` : ''}`,
    };
  },
  habits() {
    const T = todayStr();
    const hs = habitsForDay(T);
    if (!activeHabits().length) return { link: wLink('habits'), body: emptyState('flame', 'No habits yet', '', `<button class="btn btn-sm btn-primary" data-act="habitNew">New habit</button>`, true) };
    if (!hs.length) return { link: wLink('habits'), body: `<p class="faint small">No habits scheduled today. Rest day! 😌</p>` };
    const done = hs.filter(h => habitDone(h, T)).length;
    return {
      link: wLink('habits'),
      body: `<div class="row mb-s"><div style="flex:1">${bar(done / hs.length, '#22c55e')}</div><span class="small num faint">${done}/${hs.length}</span></div>
      <div class="col" style="gap:6px">${hs.map(h => {
        const d = habitDone(h, T), st = habitStreak(h);
        return `<button class="habit-btn ${d ? 'done' : ''}" style="--c:${h.color}" data-act="habitTap" data-id="${h.id}" data-date="${T}"><span class="em">${esc(h.emoji)}</span><span style="min-width:0;flex:1"><span class="truncate" style="display:block;font-weight:600">${esc(h.name)}</span><span class="faint tiny">${h.type === 'count' ? `${habitVal(h, T)}/${habitGoal(h)} ${esc(h.unit || '')} · ` : ''}${st.n ? `🔥 ${st.n} ${st.unit}` : 'Start a streak'}</span></span><span class="hb-check">${ic('check', 14, 'stroke-width="3"')}</span></button>`;
      }).join('')}</div>`,
    };
  },
  fitness() {
    const wk = workoutsInWeek(), goal = cfg().workoutGoal || 4;
    const last = sortedWorkouts()[0];
    const start = startOfWeek(new Date());
    const dots = Array.from({ length: 7 }, (_, i) => { const ds = ymd(addDays(start, i)); const did = db().workouts.some(w => w.date === ds); return `<div class="ws-day"><small>${esc(parseYmd(ds).toLocaleDateString(undefined, { weekday: 'narrow' }))}</small><span class="ws-btn ${did ? 'done' : ''} ${ds === todayStr() ? 'tdy' : ''}" style="--c:#f97316;width:30px;height:30px;pointer-events:none">${did ? ic('check', 13, 'stroke-width="3"') : ''}</span></div>`; }).join('');
    return {
      link: wLink('fitness'),
      body: `<div class="row between mb-s"><div class="stat"><span class="v">${wk.length}<span class="faint" style="font-size:1rem">/${goal}</span></span><span class="d">workouts this week</span></div>${ring(wk.length / goal, { size: 54, sw: 6, color: '#f97316', font: 12 })}</div>
      <div class="week-strip mb-s" style="justify-content:space-between">${dots}</div>
      ${last ? `<div class="li click" data-act="woOpen" data-id="${last.id}" style="border:0"><div class="grow"><div class="li-sub">Last workout · ${esc(relDay(last.date))}</div><div class="li-title truncate">${esc(last.name)}</div></div><span class="faint small">${workoutSets(last)} sets</span></div>` : ''}
      <div class="row wrap mt-s"><button class="btn btn-sm btn-primary" data-act="woNew">${ic('plus', 14)} Log workout</button>${db().templates.slice(0, 2).map(t => `<button class="btn btn-sm" data-act="tplStart" data-id="${t.id}">${ic('play', 12)} ${esc(t.name)}</button>`).join('')}</div>`,
    };
  },
  study() {
    const subs = activeSubjects();
    if (!subs.length) return { link: wLink('study'), body: emptyState('cap', 'Nothing to study yet', '', `<button class="btn btn-sm btn-primary" data-act="subjNew">Add a subject</button>`, true) };
    const wk = studyWeek(), goal = sum(subs.map(s => s.weeklyGoal || 0)) || cfg().studyGoalMin || 600;
    const today = sum(sessionsBetween(todayStr(), todayStr()).map(x => x.minutes));
    const next = upcomingExams().slice(0, 2);
    return {
      link: wLink('study'),
      body: `<div class="row between mb-s"><div class="stat"><span class="v">${hm(wk)}<span class="faint" style="font-size:.95rem"> / ${hm(goal)}</span></span><span class="d">this week · ${today ? hm(today) + ' today' : 'none today'}${studyStreak() > 1 ? ` · 🔥 ${studyStreak()}d` : ''}</span></div>${ring(wk / goal, { size: 54, sw: 6, color: '#8b5cf6', font: 12 })}</div>
        <div class="col" style="gap:6px">${subs.slice(0, 4).map(s => { const m = studyWeek(s.id); return `<div><div class="row between tiny"><span class="truncate">${esc(s.emoji)} ${esc(s.name)}</span><span class="faint num">${hm(m)}${s.weeklyGoal ? ' / ' + hm(s.weeklyGoal) : ''}</span></div>${bar(s.weeklyGoal ? m / s.weeklyGoal : (m ? 1 : 0), s.color, 'thin')}</div>`; }).join('')}</div>
        ${next.length ? `<div class="mt-s small">${next.map(x => `<div class="truncate">${ic('flag', 13)} <b>${esc(x.title)}</b> <span class="faint">· ${esc(relDay(x.date))}</span></div>`).join('')}</div>` : ''}
        <div class="row mt"><button class="btn btn-sm btn-primary" data-act="studyNew">${ic('plus', 14)} Log study</button></div>`,
    };
  },
  water() {
    const T = todayStr(), v = waterOn(T), g = cfg().waterGoal || 8;
    return {
      link: wLink('health', 'History'),
      body: `<div class="row between mb"><div class="stat"><span class="v">${num(v, 1)}<span class="faint" style="font-size:1rem"> / ${g}</span></span><span class="d">glasses · ${num(v * cfg().glassMl / 1000, 2)} L</span></div>${ring(v / g, { size: 58, sw: 6, color: '#3b82f6', font: 12 })}</div>
        <div class="glasses mb">${Array.from({ length: Math.max(g, Math.ceil(v)) }, (_, i) => `<button class="glass ${i < v ? 'full' : ''}" data-act="waterSet" data-v="${i + 1}" aria-label="Set ${i + 1} glasses"></button>`).join('')}</div>
        <div class="row"><button class="btn btn-sm btn-primary" data-act="waterAdd" data-v="1">${ic('plus', 14)} Glass</button><button class="btn btn-sm" data-act="waterAdd" data-v="-1" ${v <= 0 ? 'disabled' : ''}>${ic('minus', 14)}</button></div>`,
    };
  },
  nutrition() {
    const T = todayStr(), t = dayNutrition(T), s = cfg();
    return {
      link: wLink('health', 'Log'),
      body: `<div class="row" style="gap:18px">${ring(t.cal / s.calorieGoal, { size: 96, sw: 9, color: t.cal > s.calorieGoal ? 'var(--danger)' : '#22c55e', center: num(t.cal), sub: `of ${num(s.calorieGoal)}`, font: 18 })}
        <div class="col" style="flex:1;gap:8px;min-width:0">${[['P', t.p, s.proteinGoal, '#ef4444'], ['C', t.c, s.carbGoal, '#f59e0b'], ['F', t.f, s.fatGoal, '#3b82f6']].map(([l, v, g, c]) => `<div><div class="row between tiny"><b>${l}</b><span class="faint num">${num(v)}/${num(g)}g</span></div>${bar(v / g, c, 'thin cap')}</div>`).join('')}</div></div>
        <div class="row mt"><button class="btn btn-sm btn-primary" data-act="foodNew">${ic('plus', 14)} Add food</button><span class="faint small">${num(Math.max(0, s.calorieGoal - t.cal))} kcal left</span></div>`,
    };
  },
  mood() {
    const T = todayStr(), e = jEntry(T);
    const week = Array.from({ length: 7 }, (_, i) => { const d = addDaysStr(T, i - 6); const m = MOODS.find(x => x.v === jEntry(d)?.mood); return `<div class="ws-day"><small>${esc(parseYmd(d).toLocaleDateString(undefined, { weekday: 'narrow' }))}</small><span style="font-size:1.15rem;height:26px">${m ? m.e : '·'}</span></div>`; }).join('');
    return {
      link: wLink('journal', 'Journal'),
      body: `<div class="mood-row mb">${MOODS.map(m => `<button class="mood-btn ${e?.mood === m.v ? 'on' : ''}" style="--c:${m.c}" data-act="dashMood" data-v="${m.v}" aria-label="${m.l}">${m.e}<small>${m.l}</small></button>`).join('')}</div>
        <div class="row between" style="padding:0 4px">${week}</div>
        <a class="btn btn-sm btn-ghost mt-s" href="#/journal">${ic('edit', 14)} ${e?.text ? 'Continue journaling' : 'Write about today'}</a>`,
    };
  },
  finance() {
    const mk = monthKey(todayStr()), t = monthTotals(mk);
    const budget = budgetTotal();
    const top = Object.entries(t.byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const unpaid = db().bills.filter(b => { const d = billDueDate(b, mk); return d && !billPaid(b, mk) && d <= addDaysStr(todayStr(), 7); });
    return {
      link: wLink('finance'),
      body: `<div class="row between mb-s"><div class="stat"><span class="k">Spent in ${esc(monthLabel(mk, false).split(' ')[0])}</span><span class="v">${fmtMoney(t.expense, { short: true })}</span>${budget ? `<span class="d">of ${fmtMoney(budget, { short: true })} budget</span>` : ''}</div>
        <div class="stat" style="text-align:right"><span class="k">Net</span><span class="v ${t.net < 0 ? 'danger-text' : 'success-text'}" style="font-size:1.15rem">${fmtMoney(t.net, { sign: true, short: true })}</span></div></div>
        ${budget ? bar(t.expense / budget, '', 'cap') : ''}
        <div class="col mt-s" style="gap:6px">${top.map(([c, v]) => `<div class="row between small"><span class="truncate"><span class="dot" style="--c:${catColor(c)}"></span> ${esc(c)}</span><b class="num">${fmtMoney(v)}</b></div>`).join('')}</div>
        ${unpaid.length ? `<div class="mt-s small warn-text">${ic('bell', 14)} ${plural(unpaid.length, 'bill')} due soon: ${unpaid.map(b => esc(b.name)).join(', ')}</div>` : ''}
        <div class="row wrap mt"><button class="btn btn-sm btn-primary" data-act="txNew" data-type="expense">${ic('plus', 14)} Expense</button><button class="btn btn-sm" data-act="txNew" data-type="income">${ic('plus', 14)} Income</button><span class="spacer"></span>${curList().filter(c => c.on || c.code === dispCur()).length > 1 ? curList().filter(c => c.on || c.code === dispCur()).map(c => `<button class="chip ${c.code === dispCur() ? 'on' : ''}" data-act="setDispCur" data-val="${c.code}" title="Show in ${c.code}">${esc(c.symbol)}</button>`).join('') : ''}</div>`,
    };
  },
  goals() {
    const gs = db().goals.filter(g => !g.done).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).slice(0, 4);
    return {
      link: wLink('goals'),
      body: gs.length ? `<div class="col" style="gap:14px">${gs.map(g => { const p = goalPct(g), pace = goalPace(g); return `<div style="cursor:pointer" data-act="goTo" data-route="goals"><div class="row between small mb-s" style="margin-bottom:5px"><b class="truncate">${esc(g.title)}</b><span class="num faint">${Math.round(p * 100)}%</span></div>${bar(p, g.color)}${pace ? `<div class="tiny mt-s ${pace.left < 0 ? 'danger-text' : 'faint'}" style="margin-top:4px">${pace.left < 0 ? 'Overdue' : plural(pace.left, 'day') + ' left'}${pace.left >= 0 ? (pace.onTrack ? ' · on track' : ' · behind') : ''}</div>` : ''}</div>`; }).join('')}</div>`
        : emptyState('target', 'No active goals', '', `<button class="btn btn-sm btn-primary" data-act="goalNew">New goal</button>`, true),
    };
  },
  sleep() {
    const list = sortedSleep(), goal = cfg().sleepGoal || 8;
    const last = list[0];
    const pts = Array.from({ length: 7 }, (_, i) => { const d = addDaysStr(todayStr(), i - 6); const e = db().sleep.find(x => x.date === d); return { label: parseYmd(d).toLocaleDateString(undefined, { weekday: 'narrow' }), v: e ? Math.round(sleepHours(e) * 10) / 10 : 0 }; });
    return {
      link: wLink('health', 'History'),
      body: `<div class="row between mb-s"><div class="stat"><span class="k">${last ? esc(relDay(last.date)) : 'Last night'}</span><span class="v">${last ? fmtDuration(sleepHours(last) * 60) : '—'}</span>${last ? `<span class="d">${fmtTime(last.bed)} → ${fmtTime(last.wake)}</span>` : ''}</div>${last ? `<span style="font-size:1.8rem">${['😫', '😕', '😐', '🙂', '🤩'][(last.quality || 3) - 1]}</span>` : ''}</div>
        ${chartSlot({ type: 'bar', h: 100, labels: pts.map(p => p.label), series: [{ name: 'Hours', values: pts.map(p => p.v), color: v => v >= goal ? '#8b5cf6' : '#c4b5fd' }], goal, fmt: v => num(v) + 'h' })}
        <div class="row mt-s"><button class="btn btn-sm btn-primary" data-act="sleepNew">${ic('plus', 14)} Log sleep</button></div>`,
    };
  },
  focus() {
    const T = todayStr(), log = db().focusLog[T] || { sessions: 0, minutes: 0 };
    return {
      link: wLink('focus'),
      body: `<div class="row" style="gap:18px;justify-content:center">${focusDial('small')}<div class="col" style="gap:10px;align-items:flex-start">
        <button class="btn btn-primary" data-act="focusToggle" data-focus-toggle data-size="16">${ic(Focus.running ? 'pause' : 'play', 16)}</button>
        <button class="btn btn-sm btn-ghost" data-act="focusReset">${ic('reset', 14)} Reset</button>
        <span class="faint small">${log.sessions} today · ${fmtDuration(log.minutes)}</span></div></div>`,
    };
  },
  notes() {
    const ns = db().notes.filter(n => n.pinned).slice(0, 3);
    return {
      link: wLink('notes'),
      body: ns.length ? `<div class="col" style="gap:10px">${ns.map(n => `<div class="li click" data-act="noteEdit" data-id="${n.id}" style="border-left:3px solid ${n.color};padding-left:10px;margin-left:0"><div class="grow"><div class="li-title truncate">${esc(n.title || 'Untitled')}</div><div class="li-sub truncate">${esc((n.body || '').replace(/[#*\[\]`>-]/g, '').slice(0, 80))}</div></div></div>`).join('')}</div>`
        : `<p class="faint small">Pin notes to see them here.</p><button class="btn btn-sm mt-s" data-act="noteNew">${ic('plus', 14)} New note</button>`,
    };
  },
  weekchart() {
    const days = Array.from({ length: 7 }, (_, i) => addDaysStr(todayStr(), i - 6));
    const labels = days.map(d => parseYmd(d).toLocaleDateString(undefined, { weekday: 'short' }));
    const series = [];
    if (moduleOn('tasks')) series.push({ name: 'Tasks done', color: '#6366f1', values: days.map(d => db().tasks.filter(t => t.done && t.doneAt && ymd(new Date(t.doneAt)) === d).length) });
    if (moduleOn('habits')) series.push({ name: 'Habits done', color: '#22c55e', values: days.map(d => activeHabits().filter(h => habitDone(h, d)).length) });
    if (moduleOn('fitness')) series.push({ name: 'Workouts', color: '#f97316', values: days.map(d => db().workouts.filter(w => w.date === d).length) });
    if (moduleOn('study')) series.push({ name: 'Study hours', color: '#8b5cf6', values: days.map(d => Math.round(sum(sessionsBetween(d, d).map(x => x.minutes)) / 6) / 10) });
    return {
      body: `<div class="legend mb-s">${series.map(s => `<span><span class="dot" style="--c:${s.color}"></span>${s.name}</span>`).join('')}</div>${chartSlot({ type: 'bar', h: 170, labels, series, fmt: v => num(v) })}`,
    };
  },
  quote() {
    const day = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
    const [q, a] = QUOTES[(day + (App.ui.quoteShift || 0)) % QUOTES.length];
    return { link: `<button class="w-link" data-act="quoteNext" aria-label="Next quote">${ic('reset', 14)}</button>`, body: `<div class="quote">“${esc(q)}”</div><div class="quote-by">— ${esc(a)}</div>` };
  },
};
const widgetModule = id => WIDGETS.find(w => w.id === id)?.module || 'dashboard';

App.views.dashboard = {
  title: 'Dashboard',
  render() {
    const editing = App.ui.dashEdit;
    const ws = cfg().widgets.filter(w => WIDGETS.some(x => x.id === w.id) && moduleOn(widgetModule(w.id)));
    const visible = ws.filter(w => w.on), hidden = ws.filter(w => !w.on);
    const cards = visible.map((w, idx) => {
      const def = WIDGETS.find(x => x.id === w.id);
      let out;
      try { out = W[w.id](); } catch (e) { console.error(e); out = { body: '<p class="faint small">This widget hit a snag.</p>' }; }
      const ctrl = editing ? `<div class="w-ctrl">
        <button class="btn-icon sm" data-act="wMove" data-id="${w.id}" data-d="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Move earlier">${ic('left', 15)}</button>
        <button class="btn-icon sm" data-act="wMove" data-id="${w.id}" data-d="1" ${idx === visible.length - 1 ? 'disabled' : ''} aria-label="Move later">${ic('right', 15)}</button>
        <button class="btn-icon sm" data-act="wSize" data-id="${w.id}" aria-label="Change size" title="Size: ${['', 'normal', 'wide', 'full width'][w.size]}">${ic(w.size === 3 ? 'shrink' : 'expand', 15)}</button>
        <button class="btn-icon sm danger" data-act="wHide" data-id="${w.id}" aria-label="Hide widget">${ic('eyeoff', 15)}</button></div>` : (out.link || '');
      const headHtml = out.head === false && !editing ? '' : `<header class="w-head"><span class="w-title">${ic(def.icon, 17)} ${esc(def.label)}</span>${ctrl}</header>`;
      return `<section class="card widget ${out.cls || ''} ${w.size === 2 ? 'w2' : w.size === 3 ? 'w3' : ''}" data-w="${w.id}">${headHtml}<div class="w-body">${out.body}</div></section>`;
    }).join('');
    return `<div class="dash-wrap ${editing ? 'dash-editing' : ''}">
      ${editing ? `<div class="tray"><b>${ic('grid', 16)} Customize dashboard</b><span class="faint small">Move, resize or hide widgets. Hidden:</span>
        ${hidden.length ? hidden.map(w => { const d = WIDGETS.find(x => x.id === w.id); return `<button class="chip" data-act="wShow" data-id="${w.id}">${ic('plus', 12)} ${esc(d.label)}</button>`; }).join('') : '<span class="faint small">none</span>'}
        <span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="wReset">Reset layout</button><button class="btn btn-sm btn-primary" data-act="dashEdit">${ic('check', 14)} Done</button></div>` : ''}
      ${visible.length ? `<div class="dash-grid">${cards}</div>` : `<div class="card">${emptyState('grid', 'Your dashboard is empty', 'Add some widgets to see your day at a glance.', `<button class="btn btn-primary" data-act="${editing ? 'wShowAll' : 'dashEdit'}">${editing ? 'Show all widgets' : 'Customize'}</button>`)}</div>`}
    </div>`;
  },
};

Object.assign(App.actions, {
  dashEdit: () => { App.ui.dashEdit = !App.ui.dashEdit; renderView(); },
  dashAddTask: el => { const v = el.value.trim(); if (!v) return; const t = addTaskQuick(v, { due: todayStr() }); if (t) { toast(`Added “${t.title}”`, { type: 'success' }); setTimeout(() => $('#dashTask')?.focus(), 0); } },
  dashMood: el => { setMood(todayStr(), Number(el.dataset.v)); },
  quoteNext: () => { App.ui.quoteShift = (App.ui.quoteShift || 0) + 1; renderView(); },
  wMove: el => update(s => {
    const list = s.settings.widgets;
    const vis = list.filter(w => w.on && moduleOn(widgetModule(w.id)));
    const i = vis.findIndex(w => w.id === el.dataset.id), j = i + Number(el.dataset.d);
    if (j < 0 || j >= vis.length) return;
    const a = list.indexOf(vis[i]), b = list.indexOf(vis[j]);
    [list[a], list[b]] = [list[b], list[a]];
  }),
  wSize: el => update(s => { const w = s.settings.widgets.find(x => x.id === el.dataset.id); w.size = w.size >= 3 ? 1 : w.size + 1; }),
  wHide: el => update(s => { s.settings.widgets.find(x => x.id === el.dataset.id).on = false; }),
  wShow: el => update(s => { s.settings.widgets.find(x => x.id === el.dataset.id).on = true; }),
  wShowAll: () => update(s => { s.settings.widgets.forEach(w => { w.on = true; }); }),
  wReset: () => update(s => { s.settings.widgets = defaultState().settings.widgets; }),
  goTo: el => { if (el.dataset.sec) App.ui.setSec = el.dataset.sec; if (el.dataset.fin) App.ui.finTab = el.dataset.fin; go(el.dataset.route); },
});
