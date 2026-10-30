/* ============================================================
   Money — transactions, monthly budgets, recurring bills.
   ============================================================ */
'use strict';

const CAT_COLORS = ['#6366f1', '#f97316', '#22c55e', '#ec4899', '#06b6d4', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#3b82f6', '#84cc16', '#d946ef', '#64748b', '#a855f7'];
const catColor = (c, type = 'expense') => { const list = type === 'income' ? cfg().incomeCats : cfg().expenseCats; const i = Math.max(0, list.indexOf(c)); return CAT_COLORS[i % CAT_COLORS.length]; };
const txInMonth = mk => db().transactions.filter(t => monthKey(t.date) === mk);
const txCur = t => t.cur || baseCur();
/** A transaction's / bill's amount converted into the display currency. */
const txAmt = t => conv(t.amount, txCur(t));
/** Budgets are stored in the default currency; this returns them in the display currency. */
const budgetFor = c => db().budgets[c] ? conv(db().budgets[c], baseCur()) : 0;
const budgetTotal = () => sum(Object.keys(db().budgets).map(budgetFor));
const curOptions = () => curList().map(c => ({ value: c.code, label: `${c.symbol}  ${c.code} — ${c.name || c.code}` }));
function monthTotals(mk) {
  const list = txInMonth(mk);
  const income = sum(list.filter(t => t.type === 'income').map(txAmt));
  const expense = sum(list.filter(t => t.type === 'expense').map(txAmt));
  const byCat = {};
  list.filter(t => t.type === 'expense').forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + txAmt(t); });
  return { income, expense, net: income - expense, byCat, count: list.length };
}
/** "12,000 ֏" plus "≈ $31.01" when the item's currency differs from the display one. */
function moneyDual(amount, cur, opts = {}) {
  const main = fmtMoney(amount, { ...opts, cur });
  if (cur === dispCur()) return main;
  return `${main} <span class="faint tiny">≈ ${fmtMoney(conv(amount, cur), { sign: opts.sign && amount > 0, short: true })}</span>`;
}
function curSwitcher() {
  const on = curList().filter(c => c.on || c.code === dispCur());
  if (on.length < 2) return '';
  return seg('setDispCur', on.map(c => ({ value: c.code, label: `${esc(c.symbol)} ${c.code}` })), dispCur(), 'title="Show money in…"');
}
function billDueDate(b, mk) {
  const day = Math.min(Number(b.day) || 1, daysInMonth(mk));
  const ds = `${mk}-${pad(day)}`;
  if (b.start && ds < b.start.slice(0, 8) + '01') return null;
  if (b.freq === 'yearly' && Number(b.month || 1) !== Number(mk.slice(5))) return null;
  return ds;
}
const billPaid = (b, mk) => db().transactions.some(t => t.billId === b.id && monthKey(t.date) === mk);

function openTxForm(tx, defaults = {}) {
  const isNew = !tx;
  const v = tx || { type: defaults.type || 'expense', amount: '', cur: App.ui.lastCur || baseCur(), desc: '', category: '', date: defaults.date || todayStr(), notes: '' };
  const catOpts = type => (type === 'income' ? cfg().incomeCats : cfg().expenseCats);
  formModal({
    title: isNew ? 'New transaction' : 'Edit transaction',
    values: { ...v, cur: txCur(v), category: v.category || catOpts(v.type)[0] },
    fields: [
      { key: 'type', label: 'Type', type: 'seg', options: [{ value: 'expense', label: '− Expense' }, { value: 'income', label: '+ Income' }] },
      { key: 'amount', label: 'Amount', type: 'number', step: 'any', min: 0.01, max: 1e12, required: true, half: true, autofocus: true },
      { key: 'cur', label: 'Currency', type: 'select', options: curOptions, half: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'desc', label: 'Description', placeholder: 'e.g. Groceries at Aldi, Paycheck' },
      { key: 'category', label: 'Category', type: 'select', options: catOpts(v.type) },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
    ],
    onMount: form => {
      const sel = form.querySelector('[name=category]');
      form.querySelectorAll('input[name=type]').forEach(r => r.addEventListener('change', () => {
        const cats = catOpts(r.value);
        sel.innerHTML = cats.map(c => `<option>${esc(c)}</option>`).join('');
      }));
    },
    onSave: x => {
      x.amount = Math.round(Number(x.amount) * 100) / 100;
      if (!x.desc) x.desc = x.category;
      App.ui.lastCur = x.cur;
      update(s => { if (isNew) s.transactions.push({ id: uid(), created: Date.now(), ...x }); else Object.assign(s.transactions.find(t => t.id === tx.id), x); });
      toast(isNew ? `${x.type === 'income' ? 'Income' : 'Expense'} of ${fmtMoney(x.amount, { cur: x.cur })} added` : 'Saved', { type: 'success' });
    },
    onDelete: isNew ? null : () => withUndo('Transaction deleted', s => { s.transactions = s.transactions.filter(t => t.id !== tx.id); }),
  });
}
function openBillForm(b) {
  const isNew = !b;
  formModal({
    title: isNew ? 'New recurring bill' : 'Edit bill',
    values: b ? { ...b, cur: txCur(b) } : { name: '', amount: '', cur: baseCur(), day: new Date().getDate(), freq: 'monthly', month: new Date().getMonth() + 1, category: cfg().expenseCats.includes('Subscriptions') ? 'Subscriptions' : cfg().expenseCats[0], autopay: false },
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Rent, Netflix, Gym membership', autofocus: true },
      { key: 'amount', label: 'Amount', type: 'number', step: 'any', min: 0.01, required: true, third: true },
      { key: 'cur', label: 'Currency', type: 'select', options: curOptions, third: true },
      { key: 'day', label: 'Day of month', type: 'number', min: 1, max: 31, required: true, third: true },
      { key: 'freq', label: 'Frequency', type: 'seg', options: [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }] },
      { key: 'month', label: 'Month', type: 'select', showIf: v => v.freq === 'yearly', options: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2024, i, 1).toLocaleDateString(undefined, { month: 'long' }) })) },
      { key: 'category', label: 'Category', type: 'select', options: () => cfg().expenseCats },
      { key: 'autopay', label: 'Auto-log as paid on the due date', type: 'checkbox' },
    ],
    onSave: v => {
      v.day = clamp(Math.round(v.day), 1, 31); v.month = Number(v.month) || 1;
      update(s => { if (isNew) s.bills.push({ id: uid(), start: todayStr(), ...v }); else Object.assign(s.bills.find(x => x.id === b.id), v); });
      autopayBills();
    },
    onDelete: isNew ? null : () => withUndo('Bill removed', s => { s.bills = s.bills.filter(x => x.id !== b.id); }),
  });
}
function payBill(b, mk) {
  const ds = billDueDate(b, mk) || `${mk}-01`;
  update(s => { s.transactions.push({ id: uid(), created: Date.now(), type: 'expense', amount: b.amount, cur: txCur(b), desc: b.name, category: b.category, date: ds > todayStr() ? todayStr() : ds, billId: b.id, notes: 'Recurring bill' }); });
}
/** Log autopay bills whose due date has passed this month. */
function autopayBills() {
  const mk = monthKey(todayStr());
  let n = 0;
  (db().bills || []).forEach(b => {
    const due = billDueDate(b, mk);
    if (b.autopay && due && due <= todayStr() && !billPaid(b, mk)) {
      db().transactions.push({ id: uid(), created: Date.now(), type: 'expense', amount: b.amount, cur: txCur(b), desc: b.name, category: b.category, date: due, billId: b.id, notes: 'Auto-paid bill' });
      n++;
    }
  });
  if (n) { save(); renderView(); }
}
function openCategoriesForm() {
  formModal({
    title: 'Edit categories',
    values: { exp: cfg().expenseCats.join('\n'), inc: cfg().incomeCats.join('\n') },
    fields: [
      { key: 'exp', label: 'Expense categories (one per line)', type: 'textarea', rows: 8, half: true },
      { key: 'inc', label: 'Income categories (one per line)', type: 'textarea', rows: 8, half: true },
    ],
    onSave: v => {
      const parse = t => [...new Set(t.split('\n').map(x => x.trim()).filter(Boolean))];
      const exp = parse(v.exp), inc = parse(v.inc);
      if (!exp.length || !inc.length) { toast('Keep at least one category of each type', { type: 'error' }); return false; }
      update(s => { s.settings.expenseCats = exp; s.settings.incomeCats = inc; });
      toast('Categories updated', { type: 'success' });
    },
  });
}

