/* ============================================================
   Accounts — sign up / log in, each user gets their own data.
   Everything lives in this browser (works on GitHub Pages with
   no server). Passwords are salted + hashed with PBKDF2 and
   never stored in plain text.
   ============================================================ */
'use strict';

const USERS_KEY = 'lifeos.users';
const SESSION_KEY = 'lifeos.session';
const LOCK_KEY = 'lifeos.lockout';
const SESSION_DAYS = 30;
const PBKDF2_ITER = 150000;
const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#f59e0b', '#3b82f6'];

/* ---------- storage ---------- */
function readUsers() {
  try { const u = JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); return Array.isArray(u) ? u : []; } catch (e) { return []; }
}
function writeUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
const findUser = name => readUsers().find(u => u.username.toLowerCase() === String(name).trim().toLowerCase());
const initials = u => (u.displayName || u.username).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const avatarHtml = (u, size = 40) => `<span class="avatar" style="--c:${u.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px">${esc(initials(u))}</span>`;

function getSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const s = JSON.parse(store.getItem(SESSION_KEY) || 'null');
      if (s && s.userId && (!s.expires || s.expires > Date.now())) return s;
    } catch (e) {}
  }
  return null;
}
function setSession(userId, remember) {
  clearSession();
  const s = { userId, at: Date.now(), expires: remember ? Date.now() + SESSION_DAYS * 864e5 : 0 };
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
}
function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {} }

/* ---------- hashing ---------- */
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function randomSalt() { const a = new Uint8Array(16); crypto.getRandomValues(a); return toB64(a); }
// Small pure-JS SHA-256, only used if WebCrypto is unavailable (very old browsers).
function sha256Hex(str) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const bytes = [...new TextEncoder().encode(str)];
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
async function hashPassword(password, salt, alg) {
  alg ||= (window.crypto && crypto.subtle) ? 'pbkdf2' : 'sha256x';
  if (alg === 'pbkdf2') {
    if (!(window.crypto && crypto.subtle)) throw new Error('This browser can’t verify this password here. Open the app over https (e.g. GitHub Pages).');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromB64(salt), iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256);
    return { alg, hash: toB64(bits) };
  }
  let h = salt + ':' + password;
  for (let i = 0; i < 4000; i++) h = sha256Hex(h + salt);
  return { alg: 'sha256x', hash: h };
}
async function verifyPassword(user, password) {
  const { hash } = await hashPassword(password, user.salt, user.alg);
  if (hash.length !== user.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ user.hash.charCodeAt(i);
  return diff === 0;
}

/* ---------- brute-force slow-down ---------- */
function lockInfo(name) {
  try { return (JSON.parse(localStorage.getItem(LOCK_KEY) || '{}'))[name.toLowerCase()] || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; }
}
function setLock(name, info) {
  try { const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}'); if (info) all[name.toLowerCase()] = info; else delete all[name.toLowerCase()]; localStorage.setItem(LOCK_KEY, JSON.stringify(all)); } catch (e) {}
}

/* ---------- validation ---------- */
function validUsername(u) {
  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(u)) return 'Username: 3–24 letters, numbers, dots, dashes or underscores.';
  return '';
}
function passwordScore(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

/* ---------- account actions ---------- */
async function createAccount({ displayName, username, password, importLegacy }) {
  const users = readUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) throw new Error('That username is taken on this device.');
  const salt = randomSalt();
  const { alg, hash } = await hashPassword(password, salt);
  const user = { id: uid(), username, displayName: displayName || username, salt, alg, hash, color: AVATAR_COLORS[users.length % AVATAR_COLORS.length], created: Date.now(), lastLogin: Date.now() };
  users.push(user);
  writeUsers(users);
  if (importLegacy) {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem('lifeos.data.u.' + user.id, legacy);
      localStorage.removeItem(LEGACY_KEY);
      const lf = localStorage.getItem('lifeos.focus.v1');
      if (lf) { localStorage.setItem('lifeos.focus.u.' + user.id, lf); localStorage.removeItem('lifeos.focus.v1'); }
    }
  }
  return user;
}
async function logIn(username, password) {
  const user = findUser(username);
  const lock = lockInfo(username);
  if (lock.until > Date.now()) throw new Error(`Too many tries. Wait ${Math.ceil((lock.until - Date.now()) / 1000)} seconds.`);
  const ok = user ? await verifyPassword(user, password) : (await hashPassword(password, randomSalt()), false);
  if (!ok) {
    const n = lock.n + 1;
    setLock(username, { n, until: n >= 5 ? Date.now() + Math.min(300, 15 * 2 ** (n - 5)) * 1000 : 0 });
    throw new Error(n >= 5 ? 'Wrong username or password. Too many tries — wait a bit before trying again.' : 'Wrong username or password.');
  }
  setLock(username, null);
  const users = readUsers();
  const u = users.find(x => x.id === user.id);
  u.lastLogin = Date.now();
  writeUsers(users);
  return u;
}
function logOut() {
  if (Auth.user?.cloud) { saveNow(); cloudLogOut(); return; }
  saveNow();
  clearSession();
  location.hash = '';
  location.reload();
}

/* ---------- login screen ---------- */
function showAuthScreen(mode) {
  document.body.classList.add('auth-mode');
  let host = $('#auth');
  if (!host) { host = document.createElement('div'); host.id = 'auth'; host.className = 'auth-wrap'; document.body.appendChild(host); }
  const users = readUsers().sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
  const state = { mode: mode || (users.length ? 'pick' : 'signup'), picked: null, busy: false };
  const legacy = !!localStorage.getItem(LEGACY_KEY);

  const brand = `<div class="auth-brand"><span class="brand-mark">${ic('check', 24, 'stroke-width="3"')}</span><b>Life OS</b></div>`;
  const pwField = (id, label, auto, extra = '') => `<label class="field"><span class="flabel">${label}</span><div class="pw-wrap"><input class="input" id="${id}" type="password" autocomplete="${auto}" ${extra}><button type="button" class="btn-icon sm pw-eye" data-eye="${id}" aria-label="Show password">${ic('eye', 16)}</button></div></label>`;
  const views = {
    pick: () => `${brand}<h2>Who’s using Life OS?</h2><p class="muted">Pick your account or create a new one.</p>
      <div class="profiles">${users.map(u => `<button class="profile" data-pick="${u.id}">${avatarHtml(u, 64)}<b class="truncate">${esc(u.displayName)}</b><small class="faint truncate">@${esc(u.username)}</small></button>`).join('')}
        <button class="profile add" data-go="signup"><span class="avatar" style="--c:var(--text-3);width:64px;height:64px">${ic('plus', 28)}</span><b>New account</b><small class="faint">for you or a friend</small></button></div>
      <button class="btn btn-ghost btn-sm mt" data-go="login">Sign in with a username instead</button>`,
    login: () => {
      const u = state.picked;
      return `${brand}${u ? `<div class="center mb">${avatarHtml(u, 72)}<h2 style="margin-top:10px">Hi, ${esc(u.displayName)}</h2><p class="muted">@${esc(u.username)}</p></div>` : '<h2>Sign in</h2><p class="muted mb">Welcome back.</p>'}
      <form class="col" id="authForm" style="gap:14px" autocomplete="on">
        ${u ? `<input type="hidden" id="aUser" value="${esc(u.username)}">` : `<label class="field"><span class="flabel">Username</span><input class="input" id="aUser" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>`}
        ${pwField('aPass', 'Password', 'current-password', 'required')}
        <label class="check-field"><input type="checkbox" id="aRemember" checked><span class="switch"></span><span>Keep me signed in on this device</span></label>
        <p class="auth-err" id="aErr" role="alert"></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="aSubmit">Sign in</button>
      </form>
      <div class="row between mt"><button class="btn btn-ghost btn-sm" data-go="${users.length ? 'pick' : 'signup'}">${ic('left', 14)} ${users.length ? 'All accounts' : 'Back'}</button><button class="btn btn-ghost btn-sm" data-go="signup">Create account</button></div>
      <p class="faint tiny mt">Forgot your password? Accounts live only on this device, so it can’t be reset by email — use a backup file or create a new account.</p>`;
    },
    signup: () => `${brand}<h2>Create your account</h2><p class="muted mb">Your data is saved privately in this browser on this device.</p>
      <form class="col" id="authForm" style="gap:14px" autocomplete="on">
        <label class="field"><span class="flabel">Your name</span><input class="input" id="aName" autocomplete="name" placeholder="e.g. Aram" maxlength="40"></label>
        <label class="field"><span class="flabel">Username</span><input class="input" id="aUser" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="letters, numbers, . _ -" required maxlength="24"></label>
        ${pwField('aPass', 'Password', 'new-password', 'required minlength="6"')}
        <div class="pw-meter" id="aMeter"><i></i><i></i><i></i><i></i></div>
        ${pwField('aPass2', 'Repeat password', 'new-password', 'required')}
        <label class="check-field"><input type="checkbox" id="aRemember" checked><span class="switch"></span><span>Keep me signed in on this device</span></label>
        ${legacy ? `<label class="check-field"><input type="checkbox" id="aImport" ${users.length ? '' : 'checked'}><span class="switch"></span><span>Move the data already in this browser into this account</span></label>` : ''}
        <p class="auth-err" id="aErr" role="alert"></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="aSubmit">Create account</button>
      </form>
      ${users.length ? `<div class="row mt"><button class="btn btn-ghost btn-sm" data-go="pick">${ic('left', 14)} I already have an account</button></div>` : `<div class="row mt"><button class="btn btn-ghost btn-sm" data-go="login">Already have an account? Sign in</button></div>`}`,
  };
  const draw = () => {
    host.innerHTML = `<div class="auth-card">${views[state.mode]()}</div><p class="auth-foot faint tiny">${ic('database', 12)} No servers, no tracking — your data never leaves this device. Export backups in Settings.</p>`;
    const focusEl = state.mode === 'login' && !state.picked ? host.querySelector('#aUser') : host.querySelector(state.mode === 'signup' ? '#aName' : '#aPass');
    setTimeout(() => focusEl?.focus(), 30);
  };
  host.onclick = e => {
    const go = e.target.closest('[data-go]');
    if (go) { state.mode = go.dataset.go; state.picked = null; draw(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) { state.picked = users.find(u => u.id === pick.dataset.pick); state.mode = 'login'; draw(); return; }
    const eye = e.target.closest('[data-eye]');
    if (eye) { const inp = host.querySelector('#' + eye.dataset.eye); inp.type = inp.type === 'password' ? 'text' : 'password'; eye.innerHTML = ic(inp.type === 'password' ? 'eye' : 'eyeoff', 16); }
  };
  host.oninput = e => {
    if (e.target.id === 'aPass' && state.mode === 'signup') {
      const sc = passwordScore(e.target.value);
      const m = host.querySelector('#aMeter');
      if (m) { m.dataset.s = e.target.value ? sc : ''; m.title = ['Very weak', 'Weak', 'Okay', 'Good', 'Strong'][sc]; }
    }
    const err = host.querySelector('#aErr'); if (err) err.textContent = '';
  };
  host.onsubmit = async e => {
    e.preventDefault();
    if (state.busy) return;
    const err = host.querySelector('#aErr'), btn = host.querySelector('#aSubmit');
    const val = id => (host.querySelector('#' + id)?.value || '');
    const fail = msg => { err.textContent = msg; state.busy = false; btn.disabled = false; btn.textContent = state.mode === 'signup' ? 'Create account' : 'Sign in'; };
    state.busy = true; btn.disabled = true; btn.textContent = state.mode === 'signup' ? 'Creating…' : 'Signing in…';
    try {
      const remember = host.querySelector('#aRemember')?.checked;
      let user;
      if (state.mode === 'signup') {
        const username = val('aUser').trim(), pw = val('aPass');
        const bad = validUsername(username);
        if (bad) return fail(bad);
        if (pw.length < 6) return fail('Password must be at least 6 characters.');
        if (pw !== val('aPass2')) return fail('The two passwords don’t match.');
        user = await createAccount({ displayName: val('aName').trim(), username, password: pw, importLegacy: host.querySelector('#aImport')?.checked });
      } else {
        if (!val('aUser').trim() || !val('aPass')) return fail('Enter your username and password.');
        user = await logIn(val('aUser'), val('aPass'));
      }
      setSession(user.id, remember);
      location.hash = '';
      location.reload();
    } catch (ex) { fail(ex.message || 'Something went wrong.'); }
  };
  draw();
}

/* ---------- signed-in UI ---------- */
function accountMenu(anchor) {
  const u = Auth.user;
  const others = u.cloud ? [] : readUsers().filter(x => x.id !== u.id);
  openMenu(anchor, [
    { label: u.cloud ? `${u.displayName} · ${u.email || ''}` : `${u.displayName} (@${u.username})`, icon: 'user', onClick: () => { App.ui.setSec = 'account'; go('settings'); } },
    '-',
    { label: 'Account settings', icon: 'sliders', onClick: () => { App.ui.setSec = 'account'; go('settings'); } },
    ...(u.cloud ? [{ label: 'Sync now', icon: 'cloud', onClick: () => App.actions.syncNow() }]
      : others.length ? [{ label: 'Switch account', icon: 'repeat', onClick: () => logOut() }] : [{ label: 'Add another account', icon: 'plus', onClick: () => logOut() }]),
    { label: 'Log out', icon: 'left', color: 'var(--danger)', onClick: () => logOut() },
  ], { align: 'right' });
}
function setAccount() {
  const u = Auth.user;
  return `<div class="card set-sec"><h3>${ic('user', 18)} Your account</h3>
      <div class="row mb" style="gap:14px">${avatarHtml(u, 56)}<div><b style="font-size:1.1rem">${esc(u.displayName)}</b><div class="faint small">@${esc(u.username)} · member since ${esc(new Date(u.created).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</div></div></div>
      <div class="set-row"><div class="sr-l"><b>Display name</b></div><input class="input input-sm" style="width:220px" value="${esc(u.displayName)}" maxlength="40" data-change="accName"></div>
      <div class="set-row"><div class="sr-l"><b>Avatar color</b></div><div class="swatches">${AVATAR_COLORS.map(c => `<button class="sw-btn ${u.color === c ? 'on' : ''}" style="--c:${c}" data-act="accColor" data-c="${c}" aria-label="Color ${c}"></button>`).join('')}</div></div>
      <div class="set-row"><div class="sr-l"><b>Password</b><small>Change the password for this account</small></div><button class="btn btn-sm" data-act="accPass">${ic('edit', 14)} Change password</button></div>
      <div class="set-row"><div class="sr-l"><b>Sign out</b><small>Switch to another account or let a friend sign in</small></div><button class="btn btn-sm" data-act="accLogout">${ic('left', 14)} Log out</button></div></div>
    <div class="card set-sec"><h3>${ic('users', 18)} Accounts on this device</h3><p>Each account has its own completely separate data.</p>
      <div class="list">${readUsers().map(x => `<div class="li">${avatarHtml(x, 34)}<div class="grow"><div class="li-title">${esc(x.displayName)} ${x.id === u.id ? '<span class="chip">you</span>' : ''}</div><div class="li-sub">@${esc(x.username)} · last active ${esc(relDay(ymd(new Date(x.lastLogin || x.created))))}</div></div></div>`).join('')}</div></div>
    <div class="card set-sec" style="border-color:color-mix(in srgb,var(--danger) 35%,var(--border))"><h3 class="danger-text">${ic('trash', 18)} Delete account</h3>
      <p>Permanently removes your account and all of its data from this device. Export a backup first if you might want it later.</p>
      <button class="btn btn-danger" data-act="accDelete">Delete my account</button></div>`;
}
function updateUser(mut) {
  const users = readUsers();
  const u = users.find(x => x.id === Auth.user.id);
  mut(u);
  writeUsers(users);
  Auth.user = u;
}

Object.assign(App.actions, {
  accountMenu: el => accountMenu(el),
  accLogout: () => logOut(),
  accName: el => {
    const v = el.value.trim().slice(0, 40);
    if (!v) { el.value = Auth.user.displayName; return; }
    updateUser(u => { u.displayName = v; });
    if (!cfg().name || cfg().name === Auth.user.displayName) update(s => { s.settings.name = v; }, { render: false });
    renderTopbar(); renderView(); toast('Name updated');
  },
  accColor: el => { updateUser(u => { u.color = el.dataset.c; }); renderTopbar(); renderView(); },
  accPass: () => formModal({
    title: 'Change password', size: 'sm',
    values: {},
    fields: [
      { key: 'cur', label: 'Current password', type: 'password', required: true },
      { key: 'nw', label: 'New password', type: 'password', required: true, hint: 'At least 6 characters.' },
      { key: 'nw2', label: 'Repeat new password', type: 'password', required: true },
    ],
    onSave: v => {
      (async () => {
        if (!(await verifyPassword(Auth.user, v.cur))) return toast('Current password is wrong', { type: 'error' });
        if (v.nw.length < 6) return toast('New password must be at least 6 characters', { type: 'error' });
        if (v.nw !== v.nw2) return toast('New passwords don’t match', { type: 'error' });
        const salt = randomSalt();
        const { alg, hash } = await hashPassword(v.nw, salt);
        updateUser(u => { u.salt = salt; u.alg = alg; u.hash = hash; });
        App.modals[App.modals.length - 1]?.close();
        toast('Password changed', { type: 'success' });
      })();
      return false; // closed above once the async checks pass
    },
  }),
  accDelete: () => formModal({
    title: 'Delete account', size: 'sm',
    intro: `<p class="danger-text small mb">This permanently erases <b>@${esc(Auth.user.username)}</b> and all of its data from this device. It can’t be undone.</p>`,
    values: {},
    fields: [{ key: 'pw', label: 'Type your password to confirm', type: 'password', required: true }],
    submit: 'Delete forever',
    onSave: v => {
      (async () => {
        if (!(await verifyPassword(Auth.user, v.pw))) return toast('Wrong password', { type: 'error' });
        const id = Auth.user.id;
        clearTimeout(saveTimer); App.state = null;
        writeUsers(readUsers().filter(x => x.id !== id));
        ['lifeos.data.u.' + id, 'lifeos.focus.u.' + id].forEach(k => localStorage.removeItem(k));
        clearSession();
        location.hash = ''; location.reload();
      })();
      return false;
    },
  }),
});
