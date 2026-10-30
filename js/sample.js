/* ============================================================
   Realistic sample data so every screen can be explored.
   ============================================================ */
'use strict';

function buildSample(keepSettings) {
  const s = defaultState();
  if (keepSettings) s.settings = { ...keepSettings };
  const T = todayStr();
  const D = n => addDaysStr(T, n);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.round(rnd(a, b));
  const ago = n => Date.now() - n * 864e5;
  s.created = D(-90);

  // Calendar
  s.events = [
    { id: uid(), title: 'Team stand-up', date: D(-30), allDay: false, start: '09:30', end: '09:45', repeat: 'weekdays', color: '#3b82f6', location: 'Zoom', notes: '', skip: [] },
    { id: uid(), title: 'Dentist', date: D(2), allDay: false, start: '14:00', end: '15:00', repeat: 'none', color: '#ec4899', location: 'Smile Clinic', notes: 'Bring insurance card', skip: [] },
    { id: uid(), title: 'Dinner with Sam', date: D(0), allDay: false, start: '19:00', end: '21:00', repeat: 'none', color: '#f97316', location: 'Luigi’s', notes: '', skip: [] },
    { id: uid(), title: 'Yoga class', date: D(-14), allDay: false, start: '18:00', end: '19:00', repeat: 'weekly', color: '#22c55e', location: 'Studio 5', notes: '', skip: [] },
    { id: uid(), title: 'Mom’s birthday 🎂', date: D(9), allDay: true, start: '', end: '', repeat: 'yearly', color: '#d946ef', location: '', notes: 'Buy flowers', skip: [] },
    { id: uid(), title: 'Project deadline', date: D(5), allDay: true, start: '', end: '', repeat: 'none', color: '#ef4444', location: '', notes: '', skip: [] },
    { id: uid(), title: '1:1 with manager', date: D(-6), allDay: false, start: '11:00', end: '11:30', repeat: 'biweekly', color: '#8b5cf6', location: '', notes: '', skip: [] },
    { id: uid(), title: 'Weekend hike', date: D(4), allDay: false, start: '08:00', end: '12:00', repeat: 'none', color: '#14b8a6', location: 'Blue Ridge trail', notes: '', skip: [] },
  ];

  // Tasks
  const task = (title, extra) => ({ id: uid(), title, notes: '', priority: 0, done: false, doneAt: null, list: 'inbox', due: '', dueTime: '', repeat: 'none', subtasks: [], created: ago(ri(1, 10)), ...extra });
  s.tasks = [
    task('Pay rent', { list: 'personal', due: D(0), priority: 3, repeat: 'monthly' }),
    task('Finish quarterly report', { list: 'work', due: D(0), priority: 3, subtasks: [{ id: uid(), title: 'Collect numbers', done: true }, { id: uid(), title: 'Write summary', done: false }, { id: uid(), title: 'Send to manager', done: false }] }),
    task('Reply to Alex’s email', { list: 'work', due: D(-1), priority: 2 }),
    task('Buy groceries', { list: 'errands', due: D(0), notes: 'Eggs, spinach, oats, chicken, rice, bananas' }),
    task('Book flights for December', { list: 'personal', due: D(3), priority: 2 }),
    task('Call the bank', { list: 'errands', due: D(1) }),
    task('Water the plants', { list: 'personal', due: D(1), repeat: 'weekly' }),
    task('Read “Atomic Habits” ch. 5', { list: 'personal', due: D(2), priority: 1 }),
    task('Plan next sprint', { list: 'work', due: D(4) }),
    task('Clean out the garage', { list: 'personal' }),
    task('Learn basic Spanish phrases', { list: 'inbox' }),
    task('Renew passport', { list: 'errands', due: D(12), priority: 2 }),
    task('Send birthday card to Mom', { list: 'personal', due: D(7) }),
    task('Update resume', { list: 'work', done: true, doneAt: ago(1) }),
    task('Order new running shoes', { list: 'errands', done: true, doneAt: ago(2) }),
    task('Fix the leaky tap', { list: 'personal', done: true, doneAt: ago(0.2) }),
  ];

  // Habits with history
  const habit = (name, emoji, color, extra, rate) => {
    const h = { id: uid(), name, emoji, color, type: 'check', goal: 1, unit: '', schedule: 'daily', days: [1, 2, 3, 4, 5], perWeek: 3, notes: '', archived: false, created: D(-120), log: {}, ...extra };
    for (let i = 1; i <= 120; i++) {
      const ds = D(-i);
      if (!habitScheduled(h, ds)) continue;
      const streakBoost = i < 12 ? 0.25 : 0;
      if (Math.random() < rate + streakBoost) h.log[ds] = h.type === 'count' ? (Math.random() < 0.8 ? h.goal : ri(1, h.goal - 1)) : 1;
    }
    return h;
  };
  s.habits = [
    habit('Meditate 10 minutes', '🧘', '#8b5cf6', {}, 0.75),
    habit('Read 20 pages', '📚', '#f59e0b', {}, 0.7),
    habit('Drink 8 glasses of water', '💧', '#3b82f6', { type: 'count', goal: 8, unit: 'glasses' }, 0.65),
    habit('Gym session', '💪', '#ef4444', { schedule: 'weekly', perWeek: 4 }, 0.55),
    habit('No phone after 10pm', '📵', '#14b8a6', { schedule: 'days', days: [0, 1, 2, 3, 4] }, 0.6),
    habit('Journal', '✍️', '#ec4899', {}, 0.6),
  ];
  s.habits[0].log[T] = 1;
  s.habits[2].log[T] = 3;

  // Workouts
  const W = (n, kg) => ({ reps: n, weight: kg, done: true });
  const routines = [
    { name: 'Push day', ex: [['Bench Press', 60, 8], ['Overhead Press', 37.5, 8], ['Incline Bench Press', 45, 10], ['Lateral Raise', 8, 15], ['Tricep Pushdown', 25, 12]] },
    { name: 'Pull day', ex: [['Deadlift', 100, 5], ['Pull-up', 0, 8], ['Barbell Row', 55, 8], ['Face Pull', 20, 15], ['Bicep Curl', 12, 12]] },
    { name: 'Leg day', ex: [['Squat', 80, 6], ['Romanian Deadlift', 70, 10], ['Leg Press', 140, 12], ['Leg Curl', 35, 12], ['Calf Raise', 60, 15]] },
  ];
  s.templates = routines.map(r => ({ id: uid(), name: r.name, type: 'strength', notes: '', exercises: r.ex.map(([name, kg, reps]) => ({ name, kind: 'strength', sets: [0, 1, 2].map(() => ({ reps, weight: kg })) })) }));
  s.templates.push({ id: uid(), name: 'Home calisthenics', type: 'calisthenics', notes: '', exercises: [
    { name: 'Push-up', kind: 'bodyweight', sets: [{ reps: 20 }, { reps: 20 }, { reps: 15 }] },
    { name: 'Pull-up', kind: 'bodyweight', sets: [{ reps: 8 }, { reps: 8 }, { reps: 6 }] },
    { name: 'Air Squat', kind: 'bodyweight', sets: [{ reps: 30 }, { reps: 30 }] },
    { name: 'Plank', kind: 'time', sets: [{ sec: 60 }, { sec: 60 }] },
  ] });
  s.workouts = [];
  let k = 0;
  const session = (ds, i, type, name, mins, extra = {}) => s.workouts.push({ id: uid(), type, name, date: ds, duration: mins, rpe: ri(4, 8), cal: '', notes: '', created: ago(i), exercises: [], ...extra });
  for (let i = 56; i >= 1; i--) {
    const ds = D(-i);
    const dow = parseYmd(ds).getDay();
    if (dow === 3 && Math.random() < 0.8) { session(ds, i, 'yoga', 'Vinyasa yoga class', 60, { rpe: 4, notes: 'Felt great for the back' }); continue; }
    if (dow === 5 && Math.random() < 0.6) { session(ds, i, 'boxing', 'Boxing class', ri(50, 70), { rpe: ri(7, 9), exercises: [{ name: 'Shadow Boxing', kind: 'time', sets: [{ sec: 180 }, { sec: 180 }, { sec: 180 }] }, { name: 'Heavy Bag', kind: 'time', sets: [{ sec: 180 }, { sec: 180 }, { sec: 180 }, { sec: 180 }] }] }); continue; }
    if (dow === 0 && Math.random() < 0.5) { session(ds, i, Math.random() < 0.5 ? 'sports' : 'swimming', Math.random() < 0.5 ? 'Football with friends' : 'Pool laps', ri(45, 90)); continue; }
    if (![1, 2, 4, 6].includes(dow) || Math.random() < 0.15) continue;
    if (dow === 6 && Math.random() < 0.5) {
      s.workouts.push({ id: uid(), type: 'running', name: 'Morning run', date: ds, duration: ri(25, 45), rpe: ri(5, 7), notes: '', created: ago(i), exercises: [{ name: 'Running', kind: 'cardio', sets: [{ min: ri(25, 45), dist: Math.round(rnd(4, 8) * 10) / 10 }] }] });
      continue;
    }
    const r = routines[k++ % 3], tpl = s.templates[(k - 1) % 3];
    const prog = (56 - i) / 56; // progressive overload
    s.workouts.push({
      id: uid(), type: 'strength', rpe: ri(6, 9), name: r.name, date: ds, duration: ri(50, 75), notes: '', created: ago(i), templateId: tpl.id,
      exercises: r.ex.map(([name, kg, reps]) => {
        const w = kg ? Math.round((kg * (1 + prog * 0.12)) / 2.5) * 2.5 : 0;
        return { name, kind: 'strength', sets: [W(reps, w), W(reps, w), W(Math.max(1, reps - ri(0, 2)), w)] };
      }),
    });
  }

  // Body weight
  s.bodyweight = [];
  let bw = 82.4;
  for (let i = 60; i >= 0; i -= ri(1, 3)) { bw += rnd(-0.35, 0.22); s.bodyweight.push({ id: uid(), date: D(-i), value: Math.round(bw * 10) / 10, fat: i % 14 === 0 ? Math.round(rnd(17, 19) * 10) / 10 : '' }); }
  if (!s.settings.goalWeight) s.settings.goalWeight = 78;

  // Food
  const foods = [
    ['Oatmeal with berries', 'Breakfast', 350, 12, 58, 7], ['Greek yogurt', 'Breakfast', 150, 15, 8, 4], ['Scrambled eggs on toast', 'Breakfast', 420, 24, 30, 22],
    ['Chicken & rice bowl', 'Lunch', 620, 45, 70, 14], ['Turkey sandwich', 'Lunch', 480, 32, 45, 16], ['Caesar salad', 'Lunch', 390, 18, 15, 28],
    ['Salmon, potatoes & greens', 'Dinner', 680, 42, 55, 28], ['Spaghetti bolognese', 'Dinner', 720, 35, 85, 22], ['Stir-fry tofu & veggies', 'Dinner', 520, 26, 48, 22],
    ['Protein shake', 'Snacks', 180, 30, 6, 3], ['Banana', 'Snacks', 105, 1, 27, 0], ['Almonds (30g)', 'Snacks', 175, 6, 6, 15], ['Apple', 'Snacks', 95, 0, 25, 0],
  ];
  s.foods = foods.map(([name, , cal, p, c, f]) => ({ id: uid(), name, cal, p, c, f, uses: ri(1, 12), last: Date.now() }));
  s.meals = [];
  for (let i = 13; i >= 0; i--) {
    const ds = D(-i);
    const pick = meal => foods.filter(f => f[1] === meal);
    const plan = i === 0 ? ['Breakfast', 'Lunch', 'Snacks'] : ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    plan.forEach(meal => {
      const opts = pick(meal), f = opts[ri(0, opts.length - 1)];
      s.meals.push({ id: uid(), date: ds, name: f[0], meal, cal: f[2], p: f[3], c: f[4], f: f[5], servings: 1 });
    });
  }
  // Water & sleep
  s.water = {};
  for (let i = 1; i <= 20; i++) s.water[D(-i)] = ri(4, 10);
  s.water[T] = 3;
  s.sleep = [];
  for (let i = 0; i < 21; i++) {
    const bedM = ri(22 * 60 + 15, 24 * 60 + 50) % 1440, sleepM = ri(6 * 60, 8 * 60 + 40);
    s.sleep.push({ id: uid(), date: D(-i), bed: minToTime(Math.round(bedM / 5) * 5), wake: minToTime(Math.round(((bedM + sleepM) % 1440) / 5) * 5), quality: ri(2, 5), notes: '' });
  }

  // Money
  const mk = monthKey(T);
  // mixed currencies: earn in dollars, spend mostly in drams
  const rateOf = c => Number((s.settings.currencies || DEFAULT_CURRENCIES).find(x => x.code === c)?.rate) || 1;
  const base = s.settings.baseCur || 'USD';
  const toBase = (amt, c) => Math.round(amt / rateOf(c) * rateOf(base) * 100) / 100;
  s.budgets = { Groceries: toBase(160000, 'AMD'), Dining: toBase(70000, 'AMD'), Transport: toBase(40000, 'AMD'), Entertainment: toBase(40000, 'AMD'), Shopping: toBase(80000, 'AMD'), Subscriptions: toBase(25, 'USD') };
  s.bills = [
    { id: uid(), name: 'Rent', amount: 250000, cur: 'AMD', day: 1, freq: 'monthly', month: 1, category: 'Housing', autopay: true, start: D(-200) },
    { id: uid(), name: 'Phone plan', amount: 5000, cur: 'AMD', day: 12, freq: 'monthly', month: 1, category: 'Utilities', autopay: false, start: D(-200) },
    { id: uid(), name: 'Netflix', amount: 15.49, cur: 'USD', day: 18, freq: 'monthly', month: 1, category: 'Subscriptions', autopay: true, start: D(-200) },
    { id: uid(), name: 'Gym membership', amount: 25000, cur: 'AMD', day: 5, freq: 'monthly', month: 1, category: 'Fitness', autopay: false, start: D(-200) },
    { id: uid(), name: 'Electricity & gas', amount: 18000, cur: 'AMD', day: 22, freq: 'monthly', month: 1, category: 'Utilities', autopay: false, start: D(-200) },
  ];
  s.transactions = [];
  const tx = (date, type, amount, category, desc, cur, extra = {}) => s.transactions.push({ id: uid(), created: ago(dayDiff(date, T)), date, type, amount: cur === 'AMD' ? Math.round(amount / 100) * 100 : Math.round(amount * 100) / 100, cur, category, desc, notes: '', ...extra });
  for (let m = 5; m >= 0; m--) {
    const M = addMonths(mk, -m);
    const dim = daysInMonth(M);
    const lastDay = m === 0 ? Number(T.slice(8)) : dim;
    const d = n => `${M}-${pad(Math.min(n, lastDay))}`;
    tx(d(1), 'income', 2600, 'Salary', 'Monthly salary', 'USD');
    if (Math.random() < 0.6 && lastDay >= 15) tx(d(15), 'income', ri(80000, 250000), 'Freelance', 'Freelance project', 'AMD');
    s.bills.forEach(b => { if (b.day <= lastDay && (m > 0 || b.autopay || b.day < Number(T.slice(8)) - 2)) tx(d(b.day), 'expense', b.amount, b.category, b.name, b.cur, { billId: b.id }); });
    const places = { Groceries: ['SAS Supermarket', 'Yerevan City', 'GUM market'], Dining: ['Lavash restaurant', 'Coffee shop', 'Shawarma', 'Pizza night'], Transport: ['Yandex Go taxi', 'Metro', 'Fuel'], Entertainment: ['Cinema', 'Concert tickets', 'Steam game'], Shopping: ['Clothes', 'Home goods', 'Online order'], Health: ['Pharmacy'] };
    const ranges = { Groceries: [3000, 25000], Dining: [2500, 15000], Transport: [600, 4000], Entertainment: [2000, 12000], Shopping: [5000, 40000], Health: [1500, 9000] };
    for (let n = 0; n < Math.round(lastDay * 0.9); n++) {
      const cat = Object.keys(places)[ri(0, Object.keys(places).length - 1)];
      const online = cat === 'Entertainment' && Math.random() < 0.3;
      tx(d(ri(1, lastDay)), 'expense', online ? rnd(5, 30) : rnd(...ranges[cat]), cat, places[cat][ri(0, places[cat].length - 1)], online ? 'USD' : 'AMD');
    }
  }

  // Study
  const subj = (name, emoji, color, area, weeklyGoal, extra = {}) => ({ id: uid(), name, emoji, color, area, weeklyGoal, level: '', teacher: '', topics: [], notes: '', archived: false, created: D(-60), ...extra });
  const tp = (titles, doneN) => titles.map((t, i) => ({ id: uid(), title: t, done: i < doneN }));
  s.subjects = [
    subj('Calculus II', '🧮', '#3b82f6', 'school', 300, { level: 'Year 2', teacher: 'Prof. Petrosyan', topics: tp(['Integration by parts', 'Trig substitution', 'Partial fractions', 'Improper integrals', 'Sequences', 'Series & convergence', 'Taylor series'], 3) }),
    subj('English', '🇬🇧', '#ef4444', 'language', 240, { level: 'B2 → C1', teacher: 'IELTS prep', topics: tp(['Writing Task 1', 'Writing Task 2', 'Speaking part 2', 'Listening section 4', 'Academic vocabulary'], 2) }),
    subj('Python programming', '🐍', '#22c55e', 'programming', 300, { teacher: 'Online course', topics: tp(['Basics & syntax', 'Functions', 'OOP', 'Files & errors', 'APIs & requests', 'Final project'], 3) }),
    subj('Piano', '🎹', '#8b5cf6', 'music', 150, { level: 'Grade 3', topics: tp(['C major scale', 'Für Elise (A section)', 'Für Elise (B section)', 'Sight reading'], 2) }),
  ];
  const sk = { 0: ['practice', 'homework', 'class', 'revision', 'reading'], 1: ['flashcards', 'listening', 'speaking', 'writing', 'reading', 'tutor'], 2: ['video', 'project', 'practice', 'reading'], 3: ['instrument', 'tutor'] };
  s.studyLog = [];
  for (let i = 30; i >= 0; i--) {
    s.subjects.forEach((sb, si) => {
      if (Math.random() > [0.45, 0.5, 0.4, 0.35][si] || (i === 0 && Math.random() < 0.6)) return;
      const kinds = sk[si];
      s.studyLog.push({ id: uid(), created: ago(i), date: D(-i), subjectId: sb.id, kind: kinds[ri(0, kinds.length - 1)], minutes: [20, 25, 30, 45, 60, 90][ri(0, 5)], quality: ri(2, 5), notes: '' });
    });
  }
  s.exams = [
    { id: uid(), created: ago(20), title: 'Calculus midterm', kind: 'Midterm', subjectId: s.subjects[0].id, date: D(9), time: '10:00', location: 'Room 214', score: '', maxScore: 100, done: false, notes: 'Chapters 7–9' },
    { id: uid(), created: ago(20), title: 'IELTS mock test', kind: 'Test', subjectId: s.subjects[1].id, date: D(4), time: '', location: '', score: '', maxScore: 9, done: false, notes: '' },
    { id: uid(), created: ago(10), title: 'Python final project', kind: 'Project', subjectId: s.subjects[2].id, date: D(18), time: '', location: 'GitHub', score: '', maxScore: 100, done: false, notes: 'Weather app with API' },
    { id: uid(), created: ago(40), title: 'Calculus quiz 2', kind: 'Quiz', subjectId: s.subjects[0].id, date: D(-12), time: '', location: '', score: 17, maxScore: 20, done: true, notes: '' },
    { id: uid(), created: ago(40), title: 'Essay: technology & society', kind: 'Essay', subjectId: s.subjects[1].id, date: D(-20), time: '', location: '', score: 7, maxScore: 9, done: true, notes: '' },
    { id: uid(), created: ago(40), title: 'Calculus quiz 1', kind: 'Quiz', subjectId: s.subjects[0].id, date: D(-30), time: '', location: '', score: 14, maxScore: 20, done: true, notes: '' },
  ];

  // Journal
  s.journal = {};
  const lines = ['Productive day at work, felt focused.', 'Tired but went to the gym anyway. Proud of that.', 'Great dinner with friends, laughed a lot.', 'Bit stressed about the deadline. Need to plan better.', 'Slow, cozy day. Read a lot.', 'Went for a long walk, cleared my head.', 'Not my best day, slept badly.'];
  for (let i = 1; i <= 40; i++) {
    if (Math.random() < 0.25) continue;
    const mood = clamp(Math.round(rnd(2.2, 5.4)), 1, 5);
    s.journal[D(-i)] = { mood, energy: ri(2, 5), text: lines[ri(0, lines.length - 1)], grat: ['Coffee in the morning', 'A good chat with a friend', ''], tags: [s.settings.journalTags[ri(0, 5)]], updated: ago(i) };
  }

  // Notes
  const now = Date.now();
  s.notes = [
    { id: uid(), title: 'Grocery list', body: '[ ] Eggs\n[x] Spinach\n[ ] Oats\n[ ] Chicken breast\n[ ] Bananas\n[ ] Coffee beans', color: '#22c55e', tags: ['shopping'], pinned: true, created: now - 2e8, updated: now - 3e6 },
    { id: uid(), title: 'Book ideas', body: '# To read\n- Atomic Habits\n- Deep Work\n- The Psychology of Money\n- Project Hail Mary\n\n> “A reader lives a thousand lives.”', color: '#f59e0b', tags: ['reading'], pinned: true, created: now - 5e8, updated: now - 9e7 },
    { id: uid(), title: 'Trip to Lisbon', body: '**Dates:** Dec 12–18\n- Book Airbnb in Alfama\n- Day trip to Sintra\n- Try pastéis de nata at Belém\n\n[ ] Book flights\n[ ] Travel insurance', color: '#06b6d4', tags: ['travel'], pinned: false, created: now - 7e8, updated: now - 2e8 },
    { id: uid(), title: 'Meeting notes — Q4 planning', body: '- Focus on retention\n- Launch v2 onboarding by Nov 30\n- Hire one more designer\n\nNext steps: draft roadmap by Friday.', color: '#64748b', tags: ['work'], pinned: false, created: now - 3e8, updated: now - 3e8 },
    { id: uid(), title: 'Workout PR goals', body: '- Bench 100 kg\n- Squat 140 kg\n- Deadlift 180 kg\n- Sub-25 min 5K', color: '#ef4444', tags: ['fitness'], pinned: false, created: now - 9e8, updated: now - 6e8 },
  ];

  // Goals
  s.goals = [
    { id: uid(), title: 'Run a half marathon', category: 'Fitness', type: 'milestones', start: 0, current: 0, target: 0, unit: '', deadline: D(120), color: '#ef4444', why: 'To prove to myself I can.', created: ago(40), done: false, log: [],
      milestones: [{ id: uid(), title: 'Run 5K without stopping', done: true }, { id: uid(), title: 'Run 10K', done: true }, { id: uid(), title: 'Run 15K', done: false }, { id: uid(), title: 'Sign up for the race', done: false }, { id: uid(), title: 'Finish 21.1K', done: false }] },
    { id: uid(), title: 'Emergency fund', category: 'Finance', type: 'number', start: 0, current: 3200, target: 6000, unit: '$', deadline: D(150), color: '#22c55e', why: 'Peace of mind.', created: ago(60), done: false, log: [], milestones: [] },
    { id: uid(), title: 'Read 24 books this year', category: 'Learning', type: 'number', start: 0, current: 17, target: 24, unit: 'books', deadline: `${T.slice(0, 4)}-12-31`, color: '#f59e0b', why: '', created: ago(300), done: false, log: [], milestones: [] },
    { id: uid(), title: 'Reach 78 kg', category: 'Health', type: 'number', start: 82.4, current: s.bodyweight[s.bodyweight.length - 1].value, target: 78, unit: s.settings.weightUnit, deadline: D(90), color: '#06b6d4', why: '', created: ago(60), done: false, log: [], milestones: [] },
  ];

  // Focus
  s.focusLog = {};
  for (let i = 1; i <= 14; i++) { if (Math.random() < 0.3) continue; const n = ri(1, 6); s.focusLog[D(-i)] = { sessions: n, minutes: n * (s.settings.focusMin || 25), tasks: {} }; }

  return normalize(s);
}
