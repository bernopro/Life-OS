/* ============================================================
   Cloud sync (optional) — Firebase Authentication + Firestore.
   Turned on by putting a config in js/firebase-config.js.
   Each user's whole app state is stored under users/{uid}
   (split into chunks so it never hits Firestore's 1 MB limit),
   cached in localStorage so the app opens instantly and works
   offline, and pushed a moment after every change.
   ============================================================ */
'use strict';

const FIREBASE_VERSION = '10.12.2';
const CHUNK_CHARS = 300000; // ≤ ~900 KB even if every character were 3 bytes
const Cloud = { on: false, backend: null, status: 'idle', meta: {}, pushTimer: null, pushing: false, again: false, remoteChunks: 0, unsub: null, pendingRemote: false, lastError: null };
Cloud.device = (() => { try { let d = localStorage.getItem('lifeos.device'); if (!d) { d = uid(); localStorage.setItem('lifeos.device', d); } return d; } catch (e) { return uid(); } })();

const cloudConfigured = () => !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.projectId);
const metaKey = () => 'lifeos.sync.' + Auth.user.id;
function readMeta() { try { return JSON.parse(localStorage.getItem(metaKey()) || '{}'); } catch (e) { return {}; } }
function writeMeta(m) { Cloud.meta = m; try { localStorage.setItem(metaKey(), JSON.stringify(m)); } catch (e) {} }
function writeCache() { try { localStorage.setItem(storeKey(), JSON.stringify(App.state)); } catch (e) {} }
const colorFor = id => AVATAR_COLORS[[...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];

/* ---------- Firebase backend (compat SDK, loaded only when needed) ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
}
async function makeFirebaseBackend() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
  await loadScript(base + 'firebase-app-compat.js');
  await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]);
  firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth(), db = firebase.firestore();
  try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* private mode / old browser: still works online */ }
  const ref = id => db.collection('users').doc(id);
  const toUser = u => u && { uid: u.uid, email: u.email || '', displayName: u.displayName || '', providerId: u.providerData?.[0]?.providerId || 'password', created: Date.parse(u.metadata?.creationTime) || Date.now() };
  const persist = remember => auth.setPersistence(remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
  const reauth = async password => {
    const u = auth.currentUser;
    if (toUser(u).providerId === 'google.com') await u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
    else await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, password));
  };
  return {
    onAuth: cb => auth.onAuthStateChanged(u => cb(toUser(u))),
    signIn: async (email, pw, remember) => { await persist(remember); await auth.signInWithEmailAndPassword(email, pw); },
    signUp: async (name, email, pw, remember) => { await persist(remember); const c = await auth.createUserWithEmailAndPassword(email, pw); if (name) await c.user.updateProfile({ displayName: name }); },
    signInGoogle: async remember => { await persist(remember); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); },
    resetPassword: email => auth.sendPasswordResetEmail(email),
    signOut: () => auth.signOut(),
    updateName: name => auth.currentUser.updateProfile({ displayName: name }),
    changePassword: async (cur, nw) => { await reauth(cur); await auth.currentUser.updatePassword(nw); },
    deleteAccount: async (password, wipe) => { await reauth(password); await wipe(); await auth.currentUser.delete(); },
    getData: async id => {
      const snap = await ref(id).get();
      if (!snap.exists) return null;
      const m = snap.data();
      const parts = await Promise.all(Array.from({ length: m.chunks || 0 }, (_, i) => ref(id).collection('chunks').doc(String(i)).get()));
      return { updated: m.updated || 0, device: m.device, chunks: m.chunks || 0, json: parts.map(p => (p.exists ? p.data().d : '')).join('') };
    },
    putData: async (id, chunks, meta, oldChunks) => {
      const batch = db.batch();
      chunks.forEach((c, i) => batch.set(ref(id).collection('chunks').doc(String(i)), { d: c }));
      for (let i = chunks.length; i < oldChunks; i++) batch.delete(ref(id).collection('chunks').doc(String(i)));
      batch.set(ref(id), meta);
      await batch.commit();
    },
    wipe: async (id, oldChunks) => {
      const batch = db.batch();
      for (let i = 0; i < Math.max(oldChunks, 1); i++) batch.delete(ref(id).collection('chunks').doc(String(i)));
      batch.delete(ref(id));
      await batch.commit();
    },
    listen: (id, cb, err) => ref(id).onSnapshot(snap => { if (snap.exists && !snap.metadata.hasPendingWrites) cb(snap.data()); }, err),
  };
}

/* ---------- friendly error messages ---------- */
function cloudError(e) {
  const code = e?.code || '';
  if (code.startsWith('auth/api-key-not-valid') || code === 'auth/invalid-api-key' || code === 'auth/configuration-not-found')
    return 'The Firebase settings in js/firebase-config.js are wrong or Email/Password sign-in isn’t enabled yet. Check them against your Firebase project.';
  return ({
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/missing-password': 'Enter your password.',
    'auth/user-not-found': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/invalid-login-credentials': 'Wrong email or password.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes or reset your password.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
    'auth/cancelled-popup-request': 'The Google window was closed before finishing.',
    'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
    'auth/unauthorized-domain': 'This website isn’t allowed to sign in yet. In Firebase → Authentication → Settings → Authorized domains, add this site’s address.',
    'auth/operation-not-allowed': 'This sign-in method isn’t turned on in Firebase (Authentication → Sign-in method).',
    'auth/requires-recent-login': 'For safety, sign out and sign back in, then try again.',
    'permission-denied': 'The database refused access. Check the Firestore security rules (see README).',
    'unavailable': 'Can’t reach the sync service right now.',
  })[code] || e?.message || 'Something went wrong.';
}

/* ---------- status pill in the top bar ---------- */
function syncPillHtml() {
  if (!Auth.user?.cloud) return '';
  const s = Cloud.status;
  const map = { synced: ['cloudok', 'Synced', 'var(--success)'], syncing: ['cloud', 'Syncing…', 'var(--accent)'], offline: ['cloudoff', 'Offline — changes will sync later', 'var(--warn)'], error: ['cloudoff', 'Sync problem — click for details', 'var(--danger)'], idle: ['cloud', 'Cloud sync', 'var(--text-3)'] }[s] || ['cloud', 'Cloud sync', 'var(--text-3)'];
  return `<button class="btn-icon sync-pill ${s}" id="syncPill" data-act="syncOpen" title="${map[1]}" aria-label="${map[1]}" style="color:${map[2]}">${ic(map[0], 19)}</button>`;
}
function setSyncStatus(s) {
  Cloud.status = s;
  const p = $('#syncPill');
  if (p) p.outerHTML = syncPillHtml();
  if (App.route === 'settings' && App.ui.setSec === 'account' && !App.modals.length) { const el = $('#syncInfo'); if (el) el.innerHTML = syncInfoHtml(); }
}
function syncInfoHtml() {
  const m = Cloud.meta;
  const label = { synced: '✅ All changes saved to the cloud', syncing: '🔄 Syncing…', offline: '📴 Offline — changes are saved on this device and will sync when you’re back online', error: '⚠️ ' + esc(cloudError(Cloud.lastError)), idle: 'Waiting…' }[Cloud.status];
  return `<div>${label}</div><div class="faint small mt-s">${m.syncedAt ? 'Last synced ' + esc(new Date(m.syncedAt).toLocaleString()) : 'Not synced yet'}${m.dirty ? ' · unsynced changes on this device' : ''}</div>`;
}

/* ---------- push / pull ---------- */
function schedulePush(ms = 1200) { clearTimeout(Cloud.pushTimer); Cloud.pushTimer = setTimeout(pushNow, ms); }
function onLocalSaved() {
  if (!Auth.user?.cloud) return;
  if (!Cloud.meta.dirty) writeMeta({ ...Cloud.meta, dirty: true });
  if (Cloud.on) { if (Cloud.status !== 'offline' && Cloud.status !== 'error') setSyncStatus('syncing'); schedulePush(); }
}
async function pushNow() {
  clearTimeout(Cloud.pushTimer);
  if (!Cloud.on || !Auth.user || !App.state) return;
  if (Cloud.pushing) { Cloud.again = true; return; }
  const json = JSON.stringify(App.state);
  const chunks = [];
  for (let i = 0; i < json.length; i += CHUNK_CHARS) chunks.push(json.slice(i, i + CHUNK_CHARS));
  const updated = Math.max(Date.now(), (Cloud.meta.syncedAt || 0) + 1);
  Cloud.pushing = true;
  setSyncStatus(navigator.onLine === false ? 'offline' : 'syncing');
  let retry = 0;
  try {
    await Cloud.backend.putData(Auth.user.id, chunks, { updated, chunks: chunks.length, device: Cloud.device, name: Auth.user.displayName, v: 1 }, Cloud.remoteChunks);
    Cloud.remoteChunks = chunks.length;
    Cloud.lastError = null;
    writeMeta({ syncedAt: updated, dirty: JSON.stringify(App.state) !== json });
    setSyncStatus('synced');
  } catch (e) {
    Cloud.lastError = e;
    const denied = e?.code === 'permission-denied';
    setSyncStatus(denied ? 'error' : 'offline');
    if (!denied) retry = 15000;
  } finally {
    Cloud.pushing = false;
    if (Cloud.again || (Cloud.meta.dirty && !retry && Cloud.status === 'synced')) { Cloud.again = false; schedulePush(800); }
    else if (retry) schedulePush(retry);
  }
}
async function fetchRemote() {
  const r = await Cloud.backend.getData(Auth.user.id);
  if (!r) return null;
  Cloud.remoteChunks = r.chunks;
  return { updated: r.updated, device: r.device, data: JSON.parse(r.json) };
}
async function pullRemote({ force = false, quiet = false } = {}) {
  if (App.modals.length && !force) { Cloud.pendingRemote = true; return; }
  Cloud.pendingRemote = false;
  try {
    const r = await fetchRemote();
    if (!r) return;
    if (!force && r.updated <= (Cloud.meta.syncedAt || 0)) return;
    if (Cloud.meta.dirty && !force) { pushNow(); return; } // we have newer local edits — last change wins
    App.state = normalize(r.data);
    writeCache();
    writeMeta({ syncedAt: r.updated, dirty: false });
    setSyncStatus('synced');
    renderAll();
    if (!quiet) toast('Updated with changes from your other device', { type: 'success' });
  } catch (e) { Cloud.lastError = e; setSyncStatus(e?.code === 'permission-denied' ? 'error' : 'offline'); }
}
function listenRemote() {
  Cloud.unsub?.();
  Cloud.unsub = Cloud.backend.listen(Auth.user.id, m => {
    if (m.device === Cloud.device) { Cloud.remoteChunks = m.chunks || Cloud.remoteChunks; return; }
    if ((m.updated || 0) > (Cloud.meta.syncedAt || 0)) pullRemote();
  }, e => { Cloud.lastError = e; setSyncStatus(e?.code === 'permission-denied' ? 'error' : 'offline'); });
}
// apply remote changes that arrived while a dialog was open
setInterval(() => { if (Cloud.pendingRemote && !App.modals.length) pullRemote(); }, 2000);
window.addEventListener('online', () => { if (Cloud.on && Auth.user?.cloud && Cloud.meta.dirty) pushNow(); });
window.addEventListener('offline', () => { if (Cloud.on && Auth.user?.cloud) setSyncStatus('offline'); });

/* ---------- boot ---------- */
function splash(msg, extra = '') {
  document.body.classList.add('auth-mode');
  let host = $('#auth');
  if (!host) { host = document.createElement('div'); host.id = 'auth'; host.className = 'auth-wrap'; document.body.appendChild(host); }
  host.innerHTML = `<div class="auth-card center"><div class="auth-brand" style="justify-content:center"><span class="brand-mark">${ic('check', 24, 'stroke-width="3"')}</span><b>Life OS</b></div><div class="spinner"></div><p class="muted mt">${esc(msg)}</p>${extra}</div>`;
  host.onclick = null; host.onsubmit = null; host.oninput = null;
}
async function cloudBoot() {
  splash('Connecting…');
  try {
    Cloud.backend = await (window.__lifeosTestBackend ? window.__lifeosTestBackend() : makeFirebaseBackend());
  } catch (e) { return cloudOfflineStart(); }
  Cloud.on = true;
  let first = true;
  Cloud.backend.onAuth(async u => {
    if (!first) { if ((u?.uid || null) !== (Auth.user?.id || null)) location.reload(); return; }
    first = false;
    if (!u) { showCloudAuth(); return; }
    await cloudEnter(u);
  });
}
function cloudProfile(u) {
  return { id: u.uid, username: u.email || u.uid, email: u.email, displayName: u.displayName || (u.email || 'me').split('@')[0], color: colorFor(u.uid), created: u.created || Date.now(), providerId: u.providerId, cloud: true };
}
async function cloudEnter(u) {
  Auth.user = cloudProfile(u);
  try { localStorage.setItem('lifeos.lastUser', u.uid); localStorage.setItem('lifeos.profile.' + u.uid, JSON.stringify(Auth.user)); } catch (e) {}
  Cloud.meta = readMeta();
  splash('Loading your data…');
  const cachedRaw = localStorage.getItem(storeKey());
  const cached = (() => { try { return cachedRaw ? normalize(JSON.parse(cachedRaw)) : null; } catch (e) { return null; } })();
  let remote, state = null, push = false;
  try { remote = await fetchRemote(); } catch (e) { remote = undefined; Cloud.lastError = e; }
  if (remote === undefined) {
    // couldn't reach the cloud: use this device's copy, sync later
    if (!cached) { splash('Can’t reach the sync service.', `<p class="faint small">${esc(cloudError(Cloud.lastError))}</p><button class="btn btn-primary mt" onclick="location.reload()">Try again</button>`); return; }
    state = cached; Cloud.status = 'offline';
  } else if (!remote) {
    if (cached) { state = cached; push = true; } // first sync from this device
    else { const picked = await chooseImport(); if (picked) { state = picked; push = true; } }
  } else if (Cloud.meta.dirty && cached) {
    if (remote.updated <= (Cloud.meta.syncedAt || 0)) { state = cached; push = true; } // only we changed
    else {
      const pick = await choiceDialog('Two versions of your data', 'This device has changes that weren’t synced yet, and your data was also changed on another device. Which one do you want to keep?', [
        { label: 'Keep this device’s', value: 'local' },
        { label: 'Use the cloud version', value: 'cloud', cls: 'btn-primary' },
      ]);
      if (pick === 'local') { state = cached; push = true; }
      else { state = normalize(remote.data); writeMeta({ syncedAt: remote.updated, dirty: false }); }
    }
  } else {
    state = normalize(remote.data);
    writeMeta({ syncedAt: remote.updated, dirty: false });
    Cloud.status = 'synced';
  }
  App.onSaved = onLocalSaved;
  startApp(state);
  if (state) writeCache();
  if (push) pushNow();
  listenRemote();
}
/** The SDK couldn't load (offline): open the cached copy and sync next time. */
function cloudOfflineStart() {
  const last = localStorage.getItem('lifeos.lastUser');
  const prof = last && (() => { try { return JSON.parse(localStorage.getItem('lifeos.profile.' + last) || 'null'); } catch (e) { return null; } })();
  const raw = prof && localStorage.getItem('lifeos.data.u.' + last);
  if (!prof || !raw) { splash('You’re offline.', '<p class="faint small">Connect to the internet to sign in.</p><button class="btn btn-primary mt" onclick="location.reload()">Try again</button>'); return; }
  splash('You’re offline.', `<p class="faint small">You can keep using your saved copy on this device. Changes sync next time you’re online.</p><div class="row mt" style="justify-content:center"><button class="btn" onclick="location.reload()">Try again</button><button class="btn btn-primary" id="offlineGo">Continue offline</button></div>`);
  $('#offlineGo').onclick = () => {
    Auth.user = prof;
    Cloud.meta = readMeta();
    Cloud.status = 'offline';
    App.onSaved = onLocalSaved;
    startApp(normalize(JSON.parse(raw)));
  };
}
/** First cloud sign-in with no cloud data yet: offer to bring data that's already on this device. */
function chooseImport() {
  const sources = [];
  const summarize = raw => { try { const d = JSON.parse(raw); return `${(d.tasks || []).length} tasks · ${(d.workouts || []).length} workouts · ${(d.transactions || []).length} transactions`; } catch (e) { return ''; } };
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) sources.push({ label: 'Data saved in this browser', sub: summarize(legacy), raw: legacy });
  readUsers().forEach(u => { const raw = localStorage.getItem('lifeos.data.u.' + u.id); if (raw) sources.push({ label: `Device account: ${u.displayName} (@${u.username})`, sub: summarize(raw), raw }); });
  if (!sources.length) return Promise.resolve(null);
  return new Promise(res => {
    let done = false;
    openModal({
      title: 'Bring your data to the cloud?', size: 'sm', dismissable: false,
      body: `<p class="muted mb">We found Life OS data already on this device. Copy it into your new cloud account so it’s on all your devices?</p>
        <div class="col">${sources.map((s, i) => `<button class="welcome-opt" data-src="${i}"><b>${esc(s.label)}</b><small>${esc(s.sub)}</small></button>`).join('')}</div>`,
      footer: `<span class="spacer"></span><button class="btn btn-ghost" data-fresh>Start fresh instead</button>`,
      onMount: (w, close) => {
        w.querySelector('[data-close]').hidden = true;
        w.querySelectorAll('[data-src]').forEach(b => b.onclick = () => { done = true; close(); try { res(normalize(JSON.parse(sources[b.dataset.src].raw))); } catch (e) { res(null); } });
        w.querySelector('[data-fresh]').onclick = () => { done = true; close(); res(null); };
      },
      onClose: () => { if (!done) res(null); },
    });
  });
}

/* ---------- cloud sign-in screen ---------- */
const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function showCloudAuth(mode = 'signin') {
  document.body.classList.add('auth-mode');
  let host = $('#auth');
  if (!host) { host = document.createElement('div'); host.id = 'auth'; host.className = 'auth-wrap'; document.body.appendChild(host); }
  const state = { mode, busy: false };
  const brand = `<div class="auth-brand"><span class="brand-mark">${ic('check', 24, 'stroke-width="3"')}</span><b>Life OS</b><span class="chip c" style="--c:var(--success);margin-left:auto">${ic('cloud', 12)} Sync on</span></div>`;
  const pw = (id, label, auto) => `<label class="field"><span class="flabel">${label}</span><div class="pw-wrap"><input class="input" id="${id}" type="password" autocomplete="${auto}" required><button type="button" class="btn-icon sm pw-eye" data-eye="${id}" aria-label="Show password">${ic('eye', 16)}</button></div></label>`;
  const google = `<button type="button" class="btn btn-lg btn-block" data-google>${GOOGLE_ICON} Continue with Google</button><div class="or"><span>or</span></div>`;
  const views = {
    signin: () => `${brand}<h2>Sign in</h2><p class="muted mb">Your data syncs across all your devices.</p>${google}
      <form class="col" id="authForm" style="gap:14px">
        <label class="field"><span class="flabel">Email</span><input class="input" id="aEmail" type="email" autocomplete="email" required></label>
        ${pw('aPass', 'Password', 'current-password')}
        <div class="row between"><label class="check-field"><input type="checkbox" id="aRemember" checked><span class="switch"></span><span>Keep me signed in</span></label><button type="button" class="btn btn-ghost btn-sm" data-go="reset">Forgot password?</button></div>
        <p class="auth-err" id="aErr" role="alert"></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="aSubmit">Sign in</button>
      </form>
      <p class="center mt small">New here? <button class="btn btn-ghost btn-sm" data-go="signup">Create an account</button></p>`,
    signup: () => `${brand}<h2>Create your account</h2><p class="muted mb">Free. Sign in from your phone, laptop, anywhere.</p>${google}
      <form class="col" id="authForm" style="gap:14px">
        <label class="field"><span class="flabel">Your name</span><input class="input" id="aName" autocomplete="name" maxlength="40" placeholder="e.g. Aram"></label>
        <label class="field"><span class="flabel">Email</span><input class="input" id="aEmail" type="email" autocomplete="email" required></label>
        ${pw('aPass', 'Password', 'new-password')}
        <div class="pw-meter" id="aMeter"><i></i><i></i><i></i><i></i></div>
        ${pw('aPass2', 'Repeat password', 'new-password')}
        <label class="check-field"><input type="checkbox" id="aRemember" checked><span class="switch"></span><span>Keep me signed in</span></label>
        <p class="auth-err" id="aErr" role="alert"></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="aSubmit">Create account</button>
      </form>
      <p class="center mt small">Already have an account? <button class="btn btn-ghost btn-sm" data-go="signin">Sign in</button></p>`,
    reset: () => `${brand}<h2>Reset your password</h2><p class="muted mb">We’ll email you a link to choose a new password.</p>
      <form class="col" id="authForm" style="gap:14px">
        <label class="field"><span class="flabel">Email</span><input class="input" id="aEmail" type="email" autocomplete="email" required></label>
        <p class="auth-err" id="aErr" role="alert"></p><p class="auth-ok" id="aOk"></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="aSubmit">Send reset link</button>
      </form>
      <p class="center mt small"><button class="btn btn-ghost btn-sm" data-go="signin">${ic('left', 14)} Back to sign in</button></p>`,
  };
  const btnLabel = () => ({ signin: 'Sign in', signup: 'Create account', reset: 'Send reset link' })[state.mode];
  const draw = () => {
    const email = host.querySelector('#aEmail')?.value || '';
    host.innerHTML = `<div class="auth-card">${views[state.mode]()}</div><p class="auth-foot faint tiny">${ic('cloud', 12)} Synced securely with your private account. Only you can see your data.</p>`;
    const e = host.querySelector('#aEmail'); if (e && email) e.value = email;
    setTimeout(() => host.querySelector(state.mode === 'signup' ? '#aName' : (email ? '#aPass' : '#aEmail'))?.focus() || host.querySelector('#aEmail')?.focus(), 30);
  };
  const setBusy = (b, text) => { state.busy = b; host.querySelectorAll('button').forEach(x => { x.disabled = b; }); const s = host.querySelector('#aSubmit'); if (s) s.textContent = b ? text : btnLabel(); };
  const fail = msg => { setBusy(false); const err = host.querySelector('#aErr'); if (err) err.textContent = msg; };
  host.onclick = async e => {
    const go = e.target.closest('[data-go]');
    if (go) { state.mode = go.dataset.go; draw(); return; }
    const eye = e.target.closest('[data-eye]');
    if (eye) { const inp = host.querySelector('#' + eye.dataset.eye); inp.type = inp.type === 'password' ? 'text' : 'password'; eye.innerHTML = ic(inp.type === 'password' ? 'eye' : 'eyeoff', 16); return; }
    if (e.target.closest('[data-google]') && !state.busy) {
      setBusy(true, 'Opening Google…');
      try { await Cloud.backend.signInGoogle(host.querySelector('#aRemember')?.checked !== false); location.reload(); } catch (ex) { fail(cloudError(ex)); }
    }
  };
  host.oninput = e => {
    if (e.target.id === 'aPass' && state.mode === 'signup') { const m = host.querySelector('#aMeter'); if (m) m.dataset.s = e.target.value ? passwordScore(e.target.value) : ''; }
    const err = host.querySelector('#aErr'); if (err) err.textContent = '';
  };
  host.onsubmit = async e => {
    e.preventDefault();
    if (state.busy) return;
    const val = id => host.querySelector('#' + id)?.value || '';
    const email = val('aEmail').trim(), remember = host.querySelector('#aRemember')?.checked;
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.');
    try {
      if (state.mode === 'reset') {
        setBusy(true, 'Sending…');
        await Cloud.backend.resetPassword(email);
        setBusy(false);
        host.querySelector('#aOk').textContent = `If an account exists for ${email}, a reset link is on its way. Check your inbox (and spam).`;
        return;
      }
      if (state.mode === 'signup') {
        if (val('aPass').length < 6) return fail('Password must be at least 6 characters.');
        if (val('aPass') !== val('aPass2')) return fail('The two passwords don’t match.');
        setBusy(true, 'Creating account…');
        await Cloud.backend.signUp(val('aName').trim(), email, val('aPass'), remember);
      } else {
        if (!val('aPass')) return fail('Enter your password.');
        setBusy(true, 'Signing in…');
        await Cloud.backend.signIn(email, val('aPass'), remember);
      }
      location.hash = '';
      location.reload();
    } catch (ex) { fail(cloudError(ex)); }
  };
  draw();
}

/* ---------- signed-in: account page & actions ---------- */
async function cloudLogOut() {
  if (Cloud.meta.dirty && Cloud.on) { setSyncStatus('syncing'); await Promise.race([pushNow(), new Promise(r => setTimeout(r, 4000))]); }
  const keepCache = Cloud.meta.dirty; // never throw away changes that haven't reached the cloud
  try { await Cloud.backend?.signOut(); } catch (e) {}
  const id = Auth.user.id;
  clearTimeout(saveTimer); App.state = null;
  if (!keepCache) ['lifeos.data.u.', 'lifeos.focus.u.', 'lifeos.sync.'].forEach(k => localStorage.removeItem(k + id));
  localStorage.removeItem('lifeos.lastUser');
  location.hash = ''; location.reload();
}
function setAccountCloud() {
  const u = Auth.user;
  const isPw = u.providerId === 'password';
  return `<div class="card set-sec"><h3>${ic('user', 18)} Your account</h3>
      <div class="row mb" style="gap:14px">${avatarHtml(u, 56)}<div style="min-width:0"><b style="font-size:1.1rem">${esc(u.displayName)}</b><div class="faint small truncate">${esc(u.email || '')}${u.providerId === 'google.com' ? ' · Google' : ''}</div></div></div>
      <div class="set-row"><div class="sr-l"><b>Display name</b></div><input class="input input-sm" style="width:220px" value="${esc(u.displayName)}" maxlength="40" data-change="cloudName"></div>
      ${isPw ? `<div class="set-row"><div class="sr-l"><b>Password</b><small>Change it, or get a reset link by email</small></div><div class="row wrap"><button class="btn btn-sm" data-act="cloudPass">${ic('edit', 14)} Change</button><button class="btn btn-sm btn-ghost" data-act="cloudReset">${ic('mail', 14)} Email reset link</button></div></div>` : ''}
      <div class="set-row"><div class="sr-l"><b>Sign out</b><small>Your data stays safe in the cloud</small></div><button class="btn btn-sm" data-act="accLogout">${ic('left', 14)} Log out</button></div></div>
    <div class="card set-sec"><h3>${ic('cloud', 18)} Sync</h3><p>Everything you do is saved to your private cloud account and appears on every device where you sign in.</p>
      <div id="syncInfo" class="mb">${syncInfoHtml()}</div>
      <div class="row wrap"><button class="btn btn-sm btn-primary" data-act="syncNow">${ic('upload', 14)} Sync now</button><button class="btn btn-sm" data-act="syncPull">${ic('download', 14)} Reload from cloud</button></div></div>
    <div class="card set-sec" style="border-color:color-mix(in srgb,var(--danger) 35%,var(--border))"><h3 class="danger-text">${ic('trash', 18)} Delete account</h3>
      <p>Permanently deletes your account and all of your data from the cloud and this device. Export a backup first if you might want it.</p>
      <button class="btn btn-danger" data-act="cloudDelete">Delete my account</button></div>`;
}
Object.assign(App.actions, {
  syncOpen: () => { App.ui.setSec = 'account'; go('settings'); },
  syncNow: async () => { saveNow(); await pushNow(); if (Cloud.status === 'synced') toast('Everything is synced', { type: 'success' }); },
  syncPull: async () => {
    if (Cloud.meta.dirty && !(await confirmDialog('This device has changes that haven’t synced yet. Replace them with the cloud version?', { ok: 'Use cloud version', danger: true }))) return;
    await pullRemote({ force: true, quiet: true });
    toast('Loaded the latest data from the cloud', { type: 'success' });
  },
  cloudName: async el => {
    const v = el.value.trim().slice(0, 40);
    if (!v) { el.value = Auth.user.displayName; return; }
    try {
      await Cloud.backend.updateName(v);
      Auth.user.displayName = v;
      localStorage.setItem('lifeos.profile.' + Auth.user.id, JSON.stringify(Auth.user));
      renderTopbar(); renderView(); toast('Name updated');
    } catch (e) { toast(cloudError(e), { type: 'error' }); }
  },
  cloudReset: async () => {
    try { await Cloud.backend.resetPassword(Auth.user.email); toast(`Reset link sent to ${Auth.user.email}`, { type: 'success' }); } catch (e) { toast(cloudError(e), { type: 'error' }); }
  },
  cloudPass: () => formModal({
    title: 'Change password', size: 'sm', values: {},
    fields: [
      { key: 'cur', label: 'Current password', type: 'password', required: true },
      { key: 'nw', label: 'New password', type: 'password', required: true, hint: 'At least 6 characters.' },
      { key: 'nw2', label: 'Repeat new password', type: 'password', required: true },
    ],
    onSave: v => {
      if (v.nw.length < 6) { toast('New password must be at least 6 characters', { type: 'error' }); return false; }
      if (v.nw !== v.nw2) { toast('New passwords don’t match', { type: 'error' }); return false; }
      (async () => {
        try { await Cloud.backend.changePassword(v.cur, v.nw); App.modals[App.modals.length - 1]?.close(); toast('Password changed', { type: 'success' }); }
        catch (e) { toast(cloudError(e), { type: 'error' }); }
      })();
      return false;
    },
  }),
  cloudDelete: () => {
    const google = Auth.user.providerId === 'google.com';
    formModal({
      title: 'Delete account', size: 'sm',
      intro: `<p class="danger-text small mb">This permanently erases your account and <b>all</b> your data everywhere. It can’t be undone.</p>`,
      values: {},
      fields: google ? [{ key: 'ok', label: 'Type DELETE to confirm', required: true }] : [{ key: 'pw', label: 'Type your password to confirm', type: 'password', required: true }],
      submit: 'Delete forever',
      onSave: v => {
        if (google && v.ok !== 'DELETE') { toast('Type DELETE in capitals to confirm', { type: 'error' }); return false; }
        (async () => {
          try {
            const id = Auth.user.id;
            Cloud.unsub?.(); Cloud.on = false;
            await Cloud.backend.deleteAccount(v.pw, () => Cloud.backend.wipe(id, Cloud.remoteChunks));
            clearTimeout(saveTimer); App.state = null;
            ['lifeos.data.u.', 'lifeos.focus.u.', 'lifeos.sync.', 'lifeos.profile.'].forEach(k => localStorage.removeItem(k + id));
            localStorage.removeItem('lifeos.lastUser');
            location.hash = ''; location.reload();
          } catch (e) { Cloud.on = true; listenRemote(); toast(cloudError(e), { type: 'error' }); }
        })();
        return false;
      },
    });
  },
});
