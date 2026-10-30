/* ============================================================
   Money — page view, multi-currency display & rates.
   ============================================================ */
'use strict';

App.views.finance = {
  title: 'Money',
  render() {
    App.ui.finMonth ||= monthKey(todayStr());
    const mk = App.ui.finMonth;
    const tab = App.ui.finTab || 'overview';
    const t = monthTotals(mk);
    const bt = budgetTotal();
    const head = `<div class="page-head"><div><h2>Money</h2><p>Know where it goes · totals shown in <b>${esc(curInfo(dispCur()).name || dispCur())}</b></p></div>
      <div class="actions">
        ${curSwitcher()}
        <div class="date-nav"><button class="btn-icon sm" data-act="finMonth" data-d="-1" aria-label="Previous month">${ic('left', 16)}</button><span class="dl">${esc(monthLabel(mk))}</span><button class="btn-icon sm" data-act="finMonth" data-d="1" aria-label="Next month">${ic('right', 16)}</button>${mk !== monthKey(todayStr()) ? `<button class="btn btn-sm btn-ghost" data-act="finMonth" data-d="0">This month</button>` : ''}</div>
        <button class="btn" data-act="txNew" data-type="income">${ic('plus', 16)} Income</button>
        <button class="btn btn-primary" data-act="txNew" data-type="expense">${ic('plus', 16)} Expense</button></div></div>
      <div class="grid g4 mb">
        <div class="card stat-card"><div class="stat-ic" style="--c:#22c55e">${ic('trend', 22)}</div><div class="stat"><span class="k">Income</span><span class="v success-text">${fmtMoney(t.income, { short: true })}</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#ef4444">${ic('receipt', 22)}</div><div class="stat"><span class="k">Spent</span><span class="v">${fmtMoney(t.expense, { short: true })}</span>${bt ? `<span class="d">of ${fmtMoney(bt, { short: true })} budget</span>` : ''}</div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#6366f1">${ic('wallet', 22)}</div><div class="stat"><span class="k">Net</span><span class="v ${t.net < 0 ? 'danger-text' : ''}">${fmtMoney(t.net, { sign: true, short: true })}</span></div></div>
        <div class="card stat-card"><div class="stat-ic" style="--c:#f59e0b">${ic('target', 22)}</div><div class="stat"><span class="k">Savings rate</span><span class="v">${t.income ? Math.round(t.net / t.income * 100) + '%' : '—'}</span><span class="d">of income kept</span></div></div>
      </div>
      ${tabs('finTab', [{ value: 'overview', label: 'Overview', icon: 'grid' }, { value: 'tx', label: 'Transactions', icon: 'list', count: t.count }, { value: 'budgets', label: 'Budgets', icon: 'target' }, { value: 'bills', label: 'Bills', icon: 'repeat', count: db().bills.length }, { value: 'rates', label: 'Currencies', icon: 'wallet' }], tab)}`;
    return head + ({ overview: finOverview, tx: finTx, budgets: finBudgets, bills: finBills, rates: finRates }[tab] || finOverview)(mk, t);
  },
};
function txRow(t) {
  const inc = t.type === 'income';
  return `<div class="li click" data-act="txEdit" data-id="${t.id}"><div class="stat-ic" style="--c:${catColor(t.category, t.type)};width:36px;height:36px;border-radius:10px">${ic(inc ? 'trend' : t.billId ? 'repeat' : 'receipt', 17)}</div>
    <div class="grow"><div class="li-title truncate">${esc(t.desc || t.category)}</div><div class="li-sub">${esc(t.category)} · ${esc(relDay(t.date))}</div></div>
    <b class="num ${inc ? 'success-text' : ''}" style="text-align:right">${moneyDual(inc ? t.amount : -t.amount, txCur(t), { sign: true })}</b></div>`;
}
function finOverview(mk, t) {
  const labels = [], inc = [], exp = [];
  for (let i = 5; i >= 0; i--) { const m = addMonths(mk, -i); const x = monthTotals(m); labels.push(monthLabel(m, false).split(' ')[0]); inc.push(x.income); exp.push(x.expense); }
  const cats = Object.entries(t.byCat).sort((a, b) => b[1] - a[1]);
  const recent = txInMonth(mk).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0)).slice(0, 7);
  const upcoming = db().bills.map(b => ({ b, due: billDueDate(b, mk) })).filter(x => x.due && !billPaid(x.b, mk)).sort((a, b) => a.due.localeCompare(b.due));
  // net per currency actually used this month (real money, no conversion)
  const byCur = {};
  txInMonth(mk).forEach(x => { const c = txCur(x); byCur[c] = (byCur[c] || 0) + (x.type === 'income' ? 1 : -1) * Number(x.amount); });
  const curKeys = Object.keys(byCur);
  const multi = curKeys.length > 1 || (curKeys[0] && curKeys[0] !== dispCur());
  return `${multi ? `<div class="card mb"><div class="card-title">${ic('wallet', 16)} Net by currency <span class="card-sub">what you actually earned/spent in each</span></div><div class="row wrap" style="gap:28px">${curKeys.map(c => `<div class="stat"><span class="k">${esc(c)}</span><span class="v ${byCur[c] < 0 ? 'danger-text' : ''}" style="font-size:1.2rem">${fmtMoney(byCur[c], { sign: true, cur: c })}</span>${c !== dispCur() ? `<span class="d">≈ ${fmtMoney(conv(byCur[c], c), { sign: true })}</span>` : ''}</div>`).join('')}</div></div>` : ''}
  <div class="grid g2 mb">
    <div class="card"><div class="card-title">Spending by category</div>
      ${cats.length ? `<div class="col" style="gap:12px">${cats.map(([c, v]) => {
        const bud = budgetFor(c);
        return `<div class="macro"><div class="row between"><span class="truncate"><span class="dot" style="--c:${catColor(c)}"></span> ${esc(c)}</span><span class="num"><b>${fmtMoney(v)}</b>${bud ? ` <span class="faint">/ ${fmtMoney(bud, { short: true })}</span>` : ` <span class="faint">${Math.round(v / t.expense * 100)}%</span>`}</span></div>${bar(bud ? v / bud : v / t.expense, catColor(c), bud ? 'cap' : '')}</div>`;
      }).join('')}</div>` : emptyState('receipt', 'No spending this month', '', '', true)}</div>
    <div class="card"><div class="card-title">Income vs. spending <span class="card-sub">6 months · ${esc(dispCur())}</span></div>
      <div class="legend mb-s"><span><span class="dot" style="--c:#22c55e"></span>Income</span><span><span class="dot" style="--c:#ef4444"></span>Spending</span></div>
      ${chartSlot({ type: 'bar', h: 220, labels, series: [{ name: 'Income', color: '#22c55e', values: inc }, { name: 'Spending', color: '#ef4444', values: exp }], fmt: fmtMoneyAxis })}</div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-title">Recent <span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="finTab" data-val="tx">See all</button></div>
      ${recent.length ? `<div class="list">${recent.map(txRow).join('')}</div>` : emptyState('wallet', 'No transactions', 'Add income or an expense to get started.', '', true)}</div>
    <div class="card"><div class="card-title">Upcoming bills <span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="finTab" data-val="bills">Manage</button></div>
      ${upcoming.length ? `<div class="list">${upcoming.map(({ b, due }) => `<div class="li"><div class="grow"><div class="li-title">${esc(b.name)}</div><div class="li-sub ${due < todayStr() ? 'danger-text' : ''}">${due < todayStr() ? 'Overdue · ' : ''}${esc(relDay(due))}</div></div><b class="num" style="text-align:right">${moneyDual(b.amount, txCur(b))}</b><button class="btn btn-sm" data-act="billPay" data-id="${b.id}">Pay</button></div>`).join('')}</div>
        <p class="faint small mt-s">Still to pay: <b>${fmtMoney(sum(upcoming.map(x => txAmt(x.b))))}</b></p>` : emptyState('check', db().bills.length ? 'All bills paid' : 'No recurring bills', db().bills.length ? 'Nice — nothing left this month.' : 'Track rent, subscriptions and more.', '', true)}</div>
  </div>`;
}
function finTx(mk) {
  const ui = App.ui;
  const q = (ui.finQ || '').toLowerCase();
  let list = txInMonth(mk);
  if (ui.finType) list = list.filter(t => t.type === ui.finType);
  if (ui.finCat) list = list.filter(t => t.category === ui.finCat);
  if (ui.finCurF) list = list.filter(t => txCur(t) === ui.finCurF);
  if (q) list = list.filter(t => `${t.desc} ${t.category} ${t.notes || ''} ${t.amount} ${txCur(t)}`.toLowerCase().includes(q));
  list.sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  const groups = new Map();
  list.forEach(t => { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); });
  const cats = [...new Set(txInMonth(mk).map(t => t.category))].sort();
  const curs = [...new Set(txInMonth(mk).map(txCur))];
  return `<div class="row wrap mb">
      <input class="input" id="finQ" style="max-width:240px" placeholder="Search transactions" data-input="finQ" value="${esc(ui.finQ || '')}" aria-label="Search">
      ${seg('finType', [{ value: '', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }], ui.finType || '')}
      <select class="input" style="max-width:190px" data-change="finCat" aria-label="Category"><option value="">All categories</option>${cats.map(c => `<option ${c === ui.finCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      ${curs.length > 1 || ui.finCurF ? `<select class="input" style="max-width:160px" data-change="finCurF" aria-label="Currency"><option value="">All currencies</option>${curs.map(c => `<option ${c === ui.finCurF ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
      <span class="spacer"></span><button class="btn btn-ghost" data-act="finExport">${ic('download', 16)} CSV</button></div>
    <div class="card">${list.length ? [...groups.entries()].map(([d, l]) => `<div class="group-h">${esc(relDay(d))}<span class="spacer"></span><span class="num">${fmtMoney(sum(l.map(t => (t.type === 'income' ? 1 : -1) * txAmt(t))), { sign: true })}</span></div><div class="list">${l.map(txRow).join('')}</div>`).join('')
      : emptyState('list', 'No transactions found', q || ui.finType || ui.finCat || ui.finCurF ? 'Try clearing the filters.' : `Nothing recorded in ${monthLabel(mk)}.`)}</div>`;
}
function finBudgets(mk, t) {
  const cats = cfg().expenseCats;
  const total = budgetTotal();
  const dim = daysInMonth(mk), isCur = mk === monthKey(todayStr());
  const dayN = isCur ? new Date().getDate() : dim;
  const spentB = sum(Object.keys(db().budgets).map(c => t.byCat[c] || 0));
  const dec = curInfo(dispCur()).dec ?? 2;
  return `<div class="row mb wrap"><span class="muted">Monthly limit per category, in <b>${esc(dispCur())}</b>. Leave blank for no budget.</span><span class="spacer"></span><button class="btn" data-act="finCats">${ic('edit', 16)} Edit categories</button></div>
    <div class="card mb"><div class="row wrap between"><div class="stat"><span class="k">Total budget</span><span class="v">${fmtMoney(total)}</span></div>
      <div class="stat"><span class="k">Spent in budgeted categories</span><span class="v">${fmtMoney(spentB)}</span></div>
      <div class="stat"><span class="k">${isCur ? 'Safe to spend / day' : 'Month'}</span><span class="v">${isCur && total ? fmtMoney(Math.max(0, total - spentB) / Math.max(1, dim - dayN + 1)) : isCur ? '—' : esc(monthLabel(mk, false))}</span></div></div>
      ${total ? `<div class="mt-s">${bar(spentB / total, '', 'thick cap')}</div><p class="faint tiny mt-s">${Math.round(dayN / dim * 100)}% of the month has passed.</p>` : ''}</div>
    <div class="card"><div class="list">${cats.map(c => {
      const spent = t.byCat[c] || 0, b = budgetFor(c);
      const shown = b ? Math.round(b * 10 ** dec) / 10 ** dec : '';
      return `<div class="li" style="flex-wrap:wrap"><span class="dot" style="--c:${catColor(c)}"></span><div class="grow" style="min-width:140px"><div class="li-title">${esc(c)}</div>${b ? bar(spent / b, catColor(c), 'thin cap') : ''}</div>
        <span class="num small ${b && spent > b ? 'danger-text' : 'faint'}" style="min-width:120px;text-align:right">${fmtMoney(spent)}${b ? ` / ${fmtMoney(b)}` : ''}</span>
        <input class="input input-sm" type="number" min="0" step="any" style="width:120px" placeholder="No limit" value="${shown}" data-change="finBudget" data-cat="${esc(c)}" aria-label="Budget for ${esc(c)}"></div>`;
    }).join('')}</div></div>`;
}
function finBills(mk) {
  const bills = [...db().bills].sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0));
  const monthly = sum(bills.map(b => b.freq === 'yearly' ? txAmt(b) / 12 : txAmt(b)));
  return `<div class="row mb"><span class="muted">Recurring costs ≈ <b>${fmtMoney(monthly)}</b>/month · <b>${fmtMoney(monthly * 12)}</b>/year</span><span class="spacer"></span><button class="btn btn-primary" data-act="billNew">${ic('plus', 16)} New bill</button></div>
    <div class="card">${bills.length ? `<div class="list">${bills.map(b => {
      const due = billDueDate(b, mk), paid = billPaid(b, mk);
      return `<div class="li"><div class="stat-ic" style="--c:${catColor(b.category)};width:38px;height:38px;border-radius:10px">${ic('repeat', 17)}</div>
        <div class="grow click" data-act="billEdit" data-id="${b.id}" style="cursor:pointer"><div class="li-title">${esc(b.name)} ${b.autopay ? '<span class="chip">autopay</span>' : ''}</div><div class="li-sub">${b.freq === 'yearly' ? 'Yearly' : 'Monthly'} · day ${b.day} · ${esc(b.category)}</div></div>
        <b class="num" style="text-align:right">${moneyDual(b.amount, txCur(b))}</b>
        ${due ? (paid ? `<span class="chip c" style="--c:var(--success)">${ic('check', 12)} Paid</span>` : `<button class="btn btn-sm ${due < todayStr() ? 'btn-danger' : ''}" data-act="billPay" data-id="${b.id}">Mark paid</button>`) : '<span class="faint small">Not due</span>'}</div>`;
    }).join('')}</div>` : emptyState('repeat', 'No recurring bills', 'Add rent, phone, streaming and gym fees. They’ll appear on your calendar and you can mark them paid each month.', `<button class="btn btn-primary" data-act="billNew">${ic('plus', 16)} New bill</button>`)}</div>`;
}
function curSelect(id, val, act) {
  return `<select class="input input-sm" style="width:auto" ${id ? `id="${id}"` : ''} data-change="${act}" aria-label="Currency">${curList().map(c => `<option value="${c.code}" ${c.code === val ? 'selected' : ''}>${esc(c.symbol)} ${c.code}</option>`).join('')}</select>`;
}
function finRates() {
  const s = cfg();
  const ui = App.ui;
  const cv = { a: ui.cvAmt ?? 10000, f: ui.cvFrom || 'AMD', t: ui.cvTo || 'USD' };
  return `<div class="grid g2 mb">
    <div class="card"><div class="card-title">${ic('wallet', 16)} Defaults</div>
      <div class="set-row"><div class="sr-l"><b>Show totals in</b><small>Everything gets converted into this</small></div>${curSelect('', s.dispCur, 'setCurDisp')}</div>
      <div class="set-row"><div class="sr-l"><b>Default for new entries</b><small>Pre-selected when you add income, expenses or bills</small></div>${curSelect('', s.baseCur, 'setCurBase')}</div>
      <p class="faint small mt-s">Every transaction keeps the currency you entered it in, so you can mix drams and dollars freely. Switching only changes how totals are shown — nothing is lost.</p></div>
    <div class="card"><div class="card-title">${ic('repeat', 16)} Quick converter</div>
      <div class="row wrap"><input class="input" type="number" id="cvAmt" value="${cv.a}" style="width:150px" data-input="cvCalc" aria-label="Amount">
        ${curSelect('cvFrom', cv.f, 'cvCalc')}<button class="btn-icon sm" data-act="cvSwap" aria-label="Swap">⇄</button>${curSelect('cvTo', cv.t, 'cvCalc')}</div>
      <div class="stat mt"><span class="v" id="cvOut">${fmtMoney(conv(cv.a, cv.f, cv.t), { cur: cv.t })}</span><span class="d" id="cvRate">1 ${esc(cv.f)} = ${num(conv(1, cv.f, cv.t), 4)} ${esc(cv.t)}</span></div></div>
  </div>
  <div class="card"><div class="card-title" style="flex-wrap:wrap">Exchange rates <span class="card-sub">how many of each = 1 US dollar${s.ratesUpdated ? ` · updated ${esc(relDay(s.ratesUpdated))}` : ' · approximate — update or edit to match your bank'}</span><span class="spacer"></span>
      <button class="btn btn-sm" data-act="ratesFetch">${ic('reset', 14)} Update rates online</button><button class="btn btn-sm btn-primary" data-act="curAdd">${ic('plus', 14)} Add currency</button></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>In switcher</th><th>Currency</th><th>Symbol</th><th>Per 1 $</th><th>Decimals</th><th>Symbol after</th><th></th></tr></thead><tbody>
    ${curList().map(c => `<tr>
      <td><label class="check-field"><input type="checkbox" ${c.on ? 'checked' : ''} data-change="curEdit" data-code="${c.code}" data-k="on" aria-label="Show ${c.code} in switcher"><span class="switch"></span></label></td>
      <td><b>${esc(c.code)}</b> <span class="faint small">${esc(c.name || '')}</span></td>
      <td><input class="input input-sm" style="width:60px" maxlength="4" value="${esc(c.symbol)}" data-change="curEdit" data-code="${c.code}" data-k="symbol" aria-label="Symbol"></td>
      <td><input class="input input-sm" style="width:110px" type="number" step="any" min="0.000001" value="${c.rate}" ${c.code === 'USD' ? 'disabled title="USD is the reference"' : ''} data-change="curEdit" data-code="${c.code}" data-k="rate" aria-label="Rate"></td>
      <td><select class="input input-sm" style="width:auto" data-change="curEdit" data-code="${c.code}" data-k="dec" aria-label="Decimals"><option value="0" ${c.dec === 0 ? 'selected' : ''}>0</option><option value="2" ${c.dec !== 0 ? 'selected' : ''}>2</option></select></td>
      <td><label class="check-field"><input type="checkbox" ${c.after ? 'checked' : ''} data-change="curEdit" data-code="${c.code}" data-k="after" aria-label="Symbol after"><span class="switch"></span></label></td>
      <td>${DEFAULT_CURRENCIES.some(d => d.code === c.code) || [s.baseCur, s.dispCur].includes(c.code) || db().transactions.some(t => t.cur === c.code) || db().bills.some(b => b.cur === c.code) ? '' : `<button class="btn-icon sm danger" data-act="curDel" data-code="${c.code}" aria-label="Remove">${ic('trash', 14)}</button>`}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

Object.assign(App.actions, {
  finTab: el => { App.ui.finTab = el.dataset.val; renderView(); },
  finMonth: el => { const d = Number(el.dataset.d); App.ui.finMonth = d === 0 ? monthKey(todayStr()) : addMonths(App.ui.finMonth, d); renderView(); },
  txNew: el => openTxForm(null, { type: el.dataset.type || 'expense', date: App.route === 'finance' && App.ui.finMonth && App.ui.finMonth !== monthKey(todayStr()) ? App.ui.finMonth + '-01' : todayStr() }),
  txEdit: el => openTxForm(db().transactions.find(t => t.id === el.dataset.id)),
  finQ: el => { App.ui.finQ = el.value; renderView(); },
  finType: el => { App.ui.finType = el.dataset.val; renderView(); },
  finCat: el => { App.ui.finCat = el.value; renderView(); },
  finCurF: el => { App.ui.finCurF = el.value; renderView(); },
  finBudget: el => {
    const v = el.value === '' ? null : Math.max(0, Number(el.value));
    // typed in the display currency, stored in the default currency
    update(s => { if (v) s.budgets[el.dataset.cat] = conv(v, dispCur(), baseCur()); else delete s.budgets[el.dataset.cat]; });
  },
  finCats: () => openCategoriesForm(),
  finExport: () => {
    const rows = [['Date', 'Type', 'Category', 'Description', 'Amount', 'Currency', `Amount in ${dispCur()}`, 'Notes'],
      ...[...db().transactions].sort((a, b) => a.date.localeCompare(b.date)).map(t => { const sg = t.type === 'income' ? 1 : -1; return [t.date, t.type, t.category, t.desc, sg * t.amount, txCur(t), Math.round(sg * txAmt(t) * 100) / 100, t.notes || '']; })];
    download(`transactions-${todayStr()}.csv`, '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  },
  billNew: () => openBillForm(null),
  billEdit: el => openBillForm(db().bills.find(b => b.id === el.dataset.id)),
  billPay: el => { const b = db().bills.find(x => x.id === el.dataset.id); const mk = App.route === 'finance' ? App.ui.finMonth : monthKey(todayStr()); payBill(b, mk); toast(`${b.name} marked paid`, { type: 'success' }); },
  setDispCur: el => { update(s => { s.settings.dispCur = el.dataset.val; }); renderNav(); },
  setCurDisp: el => update(s => { s.settings.dispCur = el.value; }),
  setCurBase: el => update(s => {
    const old = s.settings.baseCur, nu = el.value;
    if (old === nu) return;
    // budgets and older entries without a currency are in the old default — keep their real value
    Object.keys(s.budgets).forEach(c => { s.budgets[c] = conv(s.budgets[c], old, nu); });
    s.transactions.forEach(t => { if (!t.cur) t.cur = old; });
    s.bills.forEach(b => { if (!b.cur) b.cur = old; });
    s.settings.baseCur = nu;
  }),
  curEdit: el => {
    const k = el.dataset.k;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'rate') { v = Number(v); if (!(v > 0)) { toast('Rate must be above 0', { type: 'error' }); renderView(); return; } }
    if (k === 'dec') v = Number(v);
    if (k === 'symbol' && !String(v).trim()) { renderView(); return; }
    update(s => { s.settings.currencies.find(c => c.code === el.dataset.code)[k] = v; });
  },
  curAdd: () => formModal({
    title: 'Add currency',
    values: { code: '', name: '', symbol: '', rate: '', dec: '2', after: false },
    fields: [
      { key: 'code', label: 'Code', required: true, placeholder: 'e.g. JPY', half: true },
      { key: 'symbol', label: 'Symbol', required: true, placeholder: '¥', half: true },
      { key: 'name', label: 'Name', placeholder: 'Japanese Yen' },
      { key: 'rate', label: 'How many equal 1 US dollar', type: 'number', step: 'any', min: 0.000001, required: true },
      { key: 'dec', label: 'Decimals', type: 'seg', options: ['0', '2'], half: true },
      { key: 'after', label: 'Symbol after the number', type: 'checkbox', half: true },
    ],
    onSave: v => {
      v.code = v.code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
      if (!v.code) { toast('Enter a currency code', { type: 'error' }); return false; }
      if (curList().some(c => c.code === v.code)) { toast('That currency already exists', { type: 'error' }); return false; }
      update(s => { s.settings.currencies.push({ ...v, dec: Number(v.dec), on: true }); });
    },
  }),
  curDel: el => update(s => { s.settings.currencies = s.settings.currencies.filter(c => c.code !== el.dataset.code); }),
  cvCalc: () => {
    const a = Number($('#cvAmt').value) || 0, f = $('#cvFrom').value, t = $('#cvTo').value;
    Object.assign(App.ui, { cvAmt: a, cvFrom: f, cvTo: t });
    $('#cvOut').textContent = fmtMoney(conv(a, f, t), { cur: t });
    $('#cvRate').textContent = `1 ${f} = ${num(conv(1, f, t), 4)} ${t}`;
  },
  cvSwap: () => { const f = App.ui.cvFrom || 'AMD', t = App.ui.cvTo || 'USD'; App.ui.cvFrom = t; App.ui.cvTo = f; renderView(); },
  ratesFetch: async el => {
    el.disabled = true;
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const j = await r.json();
      if (j.result !== 'success' || !j.rates) throw new Error('bad response');
      let n = 0;
      update(s => {
        s.settings.currencies.forEach(c => { if (c.code !== 'USD' && j.rates[c.code]) { c.rate = Math.round(j.rates[c.code] * 10000) / 10000; n++; } });
        s.settings.ratesUpdated = todayStr();
      });
      toast(`Updated ${plural(n, 'exchange rate')}`, { type: 'success' });
    } catch (e) {
      el.disabled = false;
      toast('Couldn’t reach the rates service — you can still type rates in by hand.', { type: 'error' });
    }
  },
});
