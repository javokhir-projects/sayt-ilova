const $ = (id) => document.getElementById(id);

const api = async (url, opts = {}) => {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || "So'rov bajarilmadi"), { body });
  return body;
};

const icon = (name) => `<svg class="i"><use href="#i-${name}" /></svg>`;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ───────────────────────────── Kun / tun ─────────────────────────────

$('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // saqlab bo'lmasa ham mavzu shu sessiyada ishlaydi
  }
});

// ───────────────────────────── Holat ─────────────────────────────

let state = null;
const form = {
  source: '',
  project: null,
  newApp: false,
  packageEdited: false,
};

const ICON_URL = () => `/icon.png?t=${Date.now()}`;

function setIcon() {
  const url = ICON_URL();
  for (const id of ['icon-preview', 'phone-icon', 'build-icon']) $(id).src = url;
}

function renderSource() {
  const box = $('folder-picked');
  box.classList.toggle('selected', !!form.source);
  $('source-path').textContent = form.source || 'Papka tanlanmagan';
  $('source-type').innerHTML = form.project ? `<span class="tag">${icon('check')}${escapeHtml(form.project.type)}</span>` : '';
  $('pick-folder').textContent = form.source ? "O'zgartirish" : 'Papkani tanlash';
}

function renderPackage() {
  const input = $('package');
  const locked = state.packageLocked && !form.newApp;
  input.readOnly = locked;
  $('package-hint').textContent = locked
    ? "Bu ilovaning identifikatori — Play Market/App Store'da o'zgartirib bo'lmaydi."
    : "Play Market / App Store uchun o'zingizga xos qiling. Birinchi builddan keyin o'zgartirib bo'lmaydi.";
}

async function suggestPackage() {
  if (form.packageEdited || (state.packageLocked && !form.newApp)) return;
  const name = $('name').value.trim();
  const { package: pkg } = await api(`/api/package-name?name=${encodeURIComponent(name)}`);
  $('package').value = pkg;
}

function renderPhone() {
  $('phone-name').textContent = $('name').value.trim() || 'Ilova';
  $('color-value').textContent = $('color').value;
}

// ───────────────────────────── Papka tanlash ─────────────────────────────

const dialog = $('folder-dialog');
let browsing = null;

async function browse(dir) {
  try {
    browsing = await api(`/api/fs${dir ? `?path=${encodeURIComponent(dir)}` : ''}`);
  } catch (e) {
    $('dirs').innerHTML = `<li class="empty">${escapeHtml(e.message)}</li>`;
    return;
  }

  // Yo'l bo'laklari (breadcrumbs)
  const sep = state.sep;
  const parts = browsing.path.split(sep).filter(Boolean);
  const isWinPath = /^[A-Za-z]:/.test(browsing.path);
  const crumbs = parts.map((part, i) => {
    const target = isWinPath
      ? i === 0
        ? `${part}${sep}`
        : parts.slice(0, i + 1).join(sep)
      : sep + parts.slice(0, i + 1).join(sep);
    return `<button data-path="${escapeHtml(target)}">${escapeHtml(part)}</button>`;
  });
  if (!isWinPath) crumbs.unshift(`<button data-path="${sep}">${sep}</button>`);
  $('crumbs').innerHTML = crumbs.join(`<span class="sep">${icon('chevron')}</span>`);

  const rows = [];
  if (browsing.parent) rows.push(`<li data-path="${escapeHtml(browsing.parent)}">${icon('up')}<span class="dir-name">Yuqoriga</span></li>`);
  for (const d of browsing.dirs) {
    rows.push(
      `<li class="${d.project ? 'project' : ''}" data-path="${escapeHtml(d.path)}">${icon(d.project ? 'box' : 'folder')}
        <span class="dir-name">${escapeHtml(d.name)}</span>
        ${d.project ? `<span class="tag">${escapeHtml(d.project.type)}</span>` : ''}</li>`,
    );
  }
  if (!browsing.dirs.length) rows.push('<li class="empty">Bu papkada ichki papkalar yo\'q</li>');
  $('dirs').innerHTML = rows.join('');
  $('dirs').scrollTop = 0;

  $('dialog-path').textContent = browsing.path;
  $('dialog-type').innerHTML = browsing.project
    ? `<span class="tag">${icon('check')}${escapeHtml(browsing.project.type)} loyiha</span>`
    : '<span class="dialog-hint">Frontend loyiha emas — loyiha papkasiga kiring</span>';
  $('folder-select').disabled = !browsing.project;
}

$('pick-folder').addEventListener('click', () => {
  dialog.showModal();
  const start = form.source ? form.source.slice(0, form.source.lastIndexOf(state.sep)) || form.source : '';
  browse(start);
});
$('folder-close').addEventListener('click', () => dialog.close());

$('shortcuts').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) browse(btn.dataset.path);
});
$('crumbs').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) browse(btn.dataset.path);
});
$('dirs').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-path]');
  if (li) browse(li.dataset.path);
});

$('folder-select').addEventListener('click', () => {
  if (!browsing?.project) return;
  const changed = form.source !== browsing.path;
  form.source = browsing.path;
  form.project = browsing.project;
  dialog.close();
  setError('source', '');
  renderSource();

  // Avval boshqa papkadan ilova yasalgan bo'lsa — yangi ilovami yoki o'shanimi?
  const differs = state.hasProject && state.settings.source && form.source !== state.settings.source;
  $('newapp-choice').hidden = !differs;
  if (differs) {
    $('newapp-text').textContent = `Oldin "${state.settings.name}" ilovasi boshqa papkadan yasalgan. Bu loyihadan nima qilamiz?`;
    setNewApp(true);
  } else if (form.newApp) {
    setNewApp(false);
  }
  if (changed && (!$('name').value.trim() || form.newApp) && browsing.project.name) {
    $('name').value = prettify(browsing.project.name);
    renderPhone();
    suggestPackage();
  }
});

const prettify = (s) =>
  s
    .replace(/^@[^/]+\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

function setNewApp(value) {
  form.newApp = value;
  for (const b of document.querySelectorAll('[data-newapp]')) b.classList.toggle('active', b.dataset.newapp === String(value));
  if (value) {
    form.packageEdited = false;
    $('version').value = '1.0.0';
  } else {
    $('package').value = state.settings.package;
    $('version').value = state.settings.version;
  }
  renderPackage();
  suggestPackage();
}

document.querySelectorAll('[data-newapp]').forEach((b) =>
  b.addEventListener('click', () => setNewApp(b.dataset.newapp === 'true')),
);

// ───────────────────────────── Ikonka ─────────────────────────────

async function uploadIcon(file) {
  $('icon-warning').hidden = true;
  if (!file) return;
  if (file.type !== 'image/png') {
    showIconWarning('Faqat PNG rasm qabul qilinadi');
    return;
  }
  try {
    const res = await api(`/api/icon?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: file,
    });
    if (res.warning) showIconWarning(res.warning);
    $('icon-reset').hidden = false;
    setIcon();
  } catch (e) {
    showIconWarning(e.message);
  }
}

function showIconWarning(text) {
  $('icon-warning').textContent = text;
  $('icon-warning').hidden = false;
}

$('icon-input').addEventListener('change', (e) => uploadIcon(e.target.files[0]));
const drop = $('dropzone');
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('drag');
});
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('drag');
  uploadIcon(e.dataTransfer.files[0]);
});
$('icon-reset').addEventListener('click', async () => {
  await api('/api/icon', { method: 'DELETE' });
  $('icon-reset').hidden = true;
  $('icon-warning').hidden = true;
  setIcon();
});

// ───────────────────────────── Forma ─────────────────────────────

$('name').addEventListener('input', () => {
  renderPhone();
  suggestPackage();
});
$('color').addEventListener('input', renderPhone);
$('package').addEventListener('input', () => (form.packageEdited = true));

function setError(field, text) {
  const el = document.querySelector(`[data-error="${field}"]`);
  if (el) el.textContent = text;
  el?.closest('.field')?.classList.toggle('invalid', !!text);
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  for (const f of ['source', 'name', 'version', 'package', 'platform']) setError(f, '');

  const body = {
    source: form.source,
    name: $('name').value.trim(),
    color: $('color').value,
    version: $('version').value.trim(),
    package: $('package').value.trim(),
    platform: document.querySelector('input[name=platform]:checked')?.value,
    newApp: form.newApp,
  };

  const btn = $('build-btn');
  btn.disabled = true;
  try {
    await api('/api/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    showBuild();
  } catch (err) {
    const errors = err.body?.errors;
    if (errors) {
      for (const [f, text] of Object.entries(errors)) setError(f, text);
      if (errors.package) $('advanced').open = true;
      document.querySelector('.field-error:not(:empty)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      alert(err.message);
    }
  } finally {
    btn.disabled = false;
  }
});

// ───────────────────────────── Build jarayoni ─────────────────────────────

let job = null;
let timerId = null;

function showForm() {
  $('form-view').hidden = false;
  $('build-view').hidden = true;
}

function showBuild() {
  $('form-view').hidden = true;
  $('build-view').hidden = false;
  window.scrollTo(0, 0);
}

const PLATFORM_LABEL = { apk: 'Android — APK', aab: 'Play Market — AAB', ios: 'iPhone — iOS' };

function renderJob() {
  if (!job) return;
  const running = job.state === 'running';
  $('build-title').textContent = running
    ? 'Ilova yasalmoqda'
    : job.state === 'done'
      ? 'Ilova tayyor'
      : job.state === 'cancelled'
        ? 'Bekor qilindi'
        : 'Xato yuz berdi';
  $('build-sub').textContent = `${$('name').value || state.settings.name} · ${PLATFORM_LABEL[job.platform] ?? ''}`;

  $('progress').innerHTML = job.stepList
    .map((s, i) => {
      const st = job.steps[s.id] ?? { status: 'pending', detail: '' };
      const mark = st.status === 'done' ? icon('check') : st.status === 'error' ? icon('x') : i + 1;
      return `<li class="${st.status}"><span class="dot">${mark}</span>
        <div class="grow"><div class="step-label">${escapeHtml(s.label)}</div>
        ${st.detail ? `<div class="step-detail">${escapeHtml(st.detail)}</div>` : ''}</div></li>`;
    })
    .join('');

  const login = job.login;
  $('login-notice').hidden = !login;
  if (login) {
    $('login-link').href = login.url;
    $('login-code').textContent = login.code ?? '';
    const showMatch = login.needsMatch && !login.match;
    if (showMatch && $('match-form').hidden) setTimeout(() => $('match-input').focus(), 50);
    $('match-form').hidden = !showMatch;
    $('match-error').textContent = login.matchError ? "Raqam mos kelmadi — brauzerdagi raqamni qayta kiriting" : '';
  }

  $('buildpage-notice').hidden = !(running && job.buildPage);
  if (job.buildPage) $('buildpage-link').href = job.buildPage;

  const r = job.result;
  $('result').hidden = !r;
  if (r) {
    $('qr').innerHTML = r.qr ?? '';
    $('qr').hidden = !r.qr;
    $('download-link').hidden = !r.artifactUrl;
    if (r.artifactUrl) $('download-link').href = r.artifactUrl;
    $('result-page').hidden = !r.buildPage;
    if (r.buildPage) $('result-page').href = r.buildPage;
    $('download-text').textContent = r.platform === 'aab' ? '.aab faylni yuklab olish' : r.platform === 'apk' ? 'APK yuklab olish' : 'Yuklab olish';
    $('result-help').textContent =
      r.platform === 'apk'
        ? "Telefon kamerasi bilan QR kodni skanerlang yoki APK ni yuklab olib telefonga yuboring. O'rnatishda «noma'lum manbalar»ga ruxsat bering."
        : r.platform === 'aab'
          ? ".aab faylni yuklab olib, Google Play Console'ga yuklang."
          : 'Ilovani App Store Connect / TestFlight orqali tarqating.';
  }

  $('error-box').hidden = job.state !== 'error';
  $('error-box').textContent = job.error ?? '';
  if (job.state === 'error') $('logs-box').open = true;

  $('cancel-btn').hidden = !running;
  $('back-btn').hidden = running;

  clearInterval(timerId);
  const tick = () => {
    const end = job.result?.finishedAt ?? (running ? Date.now() : job.endedAt ?? Date.now());
    const sec = Math.max(0, Math.round((end - job.startedAt) / 1000));
    $('timer').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };
  tick();
  if (running) timerId = setInterval(tick, 1000);
}

function appendLog(text) {
  const pre = $('logs');
  const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40;
  pre.textContent += `${text}\n`;
  if (atBottom) pre.scrollTop = pre.scrollHeight;
}

function connectEvents() {
  const es = new EventSource('/api/events');
  es.onmessage = (msg) => {
    const ev = JSON.parse(msg.data);
    switch (ev.type) {
      case 'snapshot':
        job = ev.job;
        if (!job) return;
        $('logs').textContent = job.logs.join('\n') + (job.logs.length ? '\n' : '');
        $('logs').scrollTop = $('logs').scrollHeight;
        showBuild();
        break;
      case 'step':
        job.steps[ev.id] = { status: ev.status, detail: ev.detail };
        break;
      case 'log':
        job.logs.push(ev.text);
        appendLog(ev.text);
        return;
      case 'login':
        job.login = ev.login;
        break;
      case 'buildPage':
        job.buildPage = ev.url;
        break;
      case 'done':
        job.state = 'done';
        job.result = ev.result;
        break;
      case 'error':
        job.state = 'error';
        job.error = ev.message;
        job.endedAt = Date.now();
        break;
      case 'cancelled':
        job.state = 'cancelled';
        job.endedAt = Date.now();
        break;
    }
    renderJob();
  };
}

$('match-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/login-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match: $('match-input').value }),
    });
    $('match-input').value = '';
  } catch (err) {
    $('match-error').textContent = err.message;
  }
});

$('cancel-btn').addEventListener('click', async () => {
  if (confirm("Build to'xtatilsinmi?")) await api('/api/cancel', { method: 'POST' });
});

$('back-btn').addEventListener('click', async () => {
  await api('/api/reset', { method: 'POST' });
  job = null;
  await loadState();
  showForm();
});

// ───────────────────────────── Boshlash ─────────────────────────────

async function loadState() {
  state = await api('/api/state');
  const s = state.settings;
  form.source = s.source;
  form.project = state.project;
  form.newApp = false;
  form.packageEdited = !!s.package;
  $('newapp-choice').hidden = true;

  $('name').value = s.name;
  $('color').value = s.color;
  $('version').value = s.version;
  $('package').value = s.package;
  const radio = document.querySelector(`input[name=platform][value="${s.platform}"]`);
  if (radio) radio.checked = true;
  $('icon-reset').hidden = !state.hasIcon;

  $('shortcuts').innerHTML = state.shortcuts
    .map((sc) => {
      const name = { desktop: 'monitor', docs: 'file', download: 'download', home: 'home', drive: 'drive' }[sc.icon] ?? 'folder';
      return `<button data-path="${escapeHtml(sc.path)}">${icon(name)}${escapeHtml(sc.label)}</button>`;
    })
    .join('');

  renderSource();
  renderPackage();
  renderPhone();
  setIcon();
  if (!s.package) suggestPackage();
}

await loadState();
showForm();
connectEvents();
