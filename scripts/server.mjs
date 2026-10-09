// npm start — brauzerda ilova yasash interfeysini ochadi (faqat shu kompyuter uchun, 127.0.0.1).
// Interfeys: ui/ papkasi. Build bosqichlari va loglar brauzerga SSE orqali uzatiladi.
import { exec, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import QRCode from 'qrcode';
import { prepareWeb } from './prepare-web.mjs';
import { defaultPackage, loadSettings, PACKAGE_RE, root, saveSettings, toSlug } from './settings.mjs';

const EAS_CLI = 'eas-cli@24.12.1';
const isWin = process.platform === 'win32';
const UI_DIR = path.join(root, 'ui');
const APP_ICON = path.join(root, 'assets', 'app-icon.png');
const DEFAULT_ICON = path.join(root, 'assets', 'icon.png');
const PLATFORMS = ['apk', 'aab', 'ios'];

// ───────────────────────────── Yordamchilar ─────────────────────────────

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '');

const exists = (p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function openBrowser(url) {
  const cmd = isWin ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

/** Buyruqni ishga tushiradi; har bir chiqish satri onLine ga beriladi. */
function runCommand(cmd, args, { onLine = () => {}, stdio, env, logStdout = true } = {}) {
  return new Promise((resolve) => {
    // Windows'da npx .cmd fayl — shell orqali, buyruq bitta qator qilib beriladi
    const child = isWin
      ? spawn([cmd, ...args].join(' '), [], { cwd: root, shell: true, env, stdio })
      : // alohida jarayon guruhi — bekor qilinganda ichidagi barcha jarayonlar bilan to'xtatiladi
        spawn(cmd, args, { cwd: root, env, stdio, detached: stdio !== 'inherit' });
    job.child = child;
    let stdout = '';
    let stderr = '';
    const pipe = (stream, sink, emitLines = true) => {
      if (!stream) return;
      let buf = '';
      stream.on('data', (d) => {
        const text = d.toString();
        sink(text);
        if (!emitLines) return;
        buf += text;
        const lines = buf.split(/\r?\n|\r/);
        buf = lines.pop();
        lines.map(stripAnsi).forEach((l) => l.trim() && onLine(l));
      });
      stream.on('end', () => buf.trim() && onLine(stripAnsi(buf)));
    };
    pipe(child.stdout, (t) => (stdout += t), logStdout);
    pipe(child.stderr, (t) => (stderr += t));
    child.on('error', (e) => resolve({ code: -1, stdout, stderr: stderr + e.message }));
    child.on('close', (code) => {
      job.child = null;
      resolve({ code, stdout, stderr });
    });
  });
}

// git o'rnatilmagan kompyuterlarda ham ishlashi uchun
const easEnv = { ...process.env, EAS_NO_VCS: '1', EAS_PROJECT_ROOT: root, NO_COLOR: '1', FORCE_COLOR: '0' };
const eas = (args, opts = {}) => runCommand('npx', ['--yes', EAS_CLI, ...args], { env: easEnv, ...opts });

// ───────────────────────────── Papkalar ─────────────────────────────

function detectProject(dir) {
  try {
    const pkgFile = path.join(dir, 'package.json');
    if (exists(pkgFile)) {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      const d = { ...pkg.dependencies, ...pkg.devDependencies };
      const type = d.next
        ? 'Next.js'
        : d.nuxt
          ? 'Nuxt'
          : d['@angular/core']
            ? 'Angular'
            : d['@sveltejs/kit'] || d.svelte
              ? 'Svelte'
              : d.vue
                ? 'Vue'
                : d['solid-js']
                  ? 'Solid'
                  : d.preact
                    ? 'Preact'
                    : d.react
                      ? 'React'
                      : d.astro
                        ? 'Astro'
                        : pkg.scripts?.build
                          ? 'JavaScript'
                          : null;
      if (type) return { type, name: pkg.name };
    }
    if (exists(path.join(dir, 'index.html'))) return { type: 'HTML sayt' };
  } catch {
    // o'qib bo'lmaydigan papka
  }
  return null;
}

function shortcuts() {
  const home = os.homedir();
  const list = [
    { label: 'Ish stoli', icon: 'desktop', path: path.join(home, 'Desktop') },
    { label: 'Ish stoli (OneDrive)', icon: 'desktop', path: path.join(home, 'OneDrive', 'Desktop') },
    { label: 'Hujjatlar', icon: 'docs', path: path.join(home, 'Documents') },
    { label: 'Yuklanmalar', icon: 'download', path: path.join(home, 'Downloads') },
    { label: 'Uy papkasi', icon: 'home', path: home },
  ];
  if (isWin) {
    for (const letter of 'CDEFGHIJKLMN') list.push({ label: `${letter}: disk`, icon: 'drive', path: `${letter}:\\` });
  } else {
    list.push({ label: 'Kompyuter', icon: 'drive', path: '/' });
  }
  return list.filter((s) => exists(s.path));
}

function listDir(dir) {
  const abs = path.resolve(dir);
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const dirs = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('$') || e.name === 'node_modules') continue;
    const full = path.join(abs, e.name);
    let isDir = e.isDirectory();
    if (!isDir && e.isSymbolicLink()) {
      try {
        isDir = fs.statSync(full).isDirectory();
      } catch {
        isDir = false;
      }
    }
    // ilova yasovchining o'z papkasi frontend loyiha sifatida ko'rsatilmaydi
    if (isDir) dirs.push({ name: e.name, path: full, project: full === root ? null : detectProject(full) });
    if (dirs.length >= 500) break;
  }
  dirs.sort((a, b) => Number(!!b.project) - Number(!!a.project) || a.name.localeCompare(b.name));
  const parent = path.dirname(abs);
  return { path: abs, parent: parent === abs ? null : parent, project: abs === root ? null : detectProject(abs), dirs };
}

// ───────────────────────────── Build jarayoni ─────────────────────────────

const STEPS = [
  { id: 'frontend', label: 'Frontend build' },
  { id: 'account', label: 'Expo akkaunt' },
  { id: 'project', label: 'Expo loyiha' },
  { id: 'build', label: "Ilova yig'ish" },
];

const job = { state: 'idle', clients: new Set(), child: null };

function resetJob(platform) {
  Object.assign(job, {
    state: 'running',
    platform,
    startedAt: Date.now(),
    steps: Object.fromEntries(STEPS.map((s) => [s.id, { status: 'pending', detail: '' }])),
    logs: [],
    login: null,
    buildPage: null,
    result: null,
    error: null,
    cancelled: false,
  });
}

const snapshot = () => {
  const { clients, child, ...rest } = job;
  return { ...rest, stepList: STEPS };
};

function emit(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of job.clients) res.write(data);
}

const log = (text) => {
  job.logs.push(text);
  if (job.logs.length > 3000) job.logs.splice(0, job.logs.length - 3000);
  emit({ type: 'log', text });
};

const setStep = (id, status, detail = '') => {
  job.steps[id] = { status, detail };
  emit({ type: 'step', id, status, detail });
};

class Cancelled extends Error {}
const checkCancelled = () => {
  if (job.cancelled) throw new Cancelled();
};

/**
 * Expo'ga kirish. Terminal bo'lmaganda eas-cli brauzer rejimini rad etadi, shuning uchun
 * qurilma kodi usuli ishlatiladi: havola + kod → foydalanuvchi brauzerda tasdiqlaydi → so'rab turamiz.
 */
async function deviceLogin() {
  setStep('account', 'active', 'Brauzerda Expo akkauntingizga kiring');
  const start = await eas(['login', '--device', '--non-interactive'], { onLine: log });
  checkCancelled();
  const out = stripAnsi(start.stdout + start.stderr);
  const url = out.match(/Open\s+(https:\/\/\S+)/)?.[1];
  const code = out.match(/Code:\s*(\S+)/)?.[1];
  // "--resume <uuid>, adding ..." — vergul ID'ga qo'shilib ketmasligi uchun faqat UUID olinadi
  const requestId = out.match(/--resume\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];
  if (start.code !== 0 || !url || !requestId) throw new Error("Expo'ga kirishni boshlab bo'lmadi. Internet aloqasini tekshiring.");

  job.login = { url, code, needsMatch: false, match: null };
  emit({ type: 'login', login: job.login });
  openBrowser(url);

  const deadline = Date.now() + 15 * 60 * 1000;
  let lastState = '';
  const note = (state, line) => {
    // har bir so'rov emas, faqat holat o'zgarganda logga yoziladi
    if (state !== lastState) log(line);
    lastState = state;
  };
  try {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      checkCancelled();
      const args = ['login', '--device', '--non-interactive', '--resume', requestId];
      const usedMatch = job.login.match;
      if (usedMatch) args.push('--match', usedMatch);
      const res = await eas(args);
      checkCancelled();
      const text = stripAnsi(res.stdout + res.stderr).trim();

      if (/Logged in as/i.test(text)) {
        log(text.match(/Logged in as.*/i)[0]);
        return;
      }

      // Expo aniq rad etgan — so'rov yopilgan, qaytadan boshlash kerak
      const failure = text.match(/Device login failed \((\w+)\)/)?.[1];
      if (failure || /request not found|Start again with eas login/i.test(text)) {
        log(text);
        throw new Error(
          failure === 'access_denied'
            ? "Expo'da kirish rad etildi. «Ilovani yasash» ni qayta bosing."
            : failure === 'expired_token'
              ? "Tasdiqlash kodi eskirdi. «Ilovani yasash» ni qayta bosing."
              : usedMatch
                ? `Kiritilgan raqam (${usedMatch}) mos kelmadi. «Ilovani yasash» ni qayta bosing va brauzerdagi raqamni aniq kiriting.`
                : "Expo'ga kirish tasdiqlanmadi. «Ilovani yasash» ni qayta bosing.",
        );
      }

      if (/number shown in their browser/i.test(text)) {
        note('match', usedMatch ? `Raqam yuborildi (${usedMatch}), Expo javobi kutilmoqda...` : "Expo tekshiruv raqamini so'rayapti — brauzerdagi raqamni sahifaga kiriting");
        if (!job.login.needsMatch) {
          job.login = { ...job.login, needsMatch: true };
          emit({ type: 'login', login: job.login });
        }
      } else if (/pending|Retry after/i.test(text)) {
        note('pending', 'Brauzerda tasdiqlash kutilmoqda...');
      } else if (res.code !== 0) {
        // tarmoq yoki Expo tomonidagi vaqtinchalik xato — so'rashda davom etamiz
        note(`err:${text}`, `Expo javobi (qayta urinilmoqda): ${text.split(/\r?\n/).pop()}`);
      }
    }
    throw new Error("Expo'ga kirish uchun vaqt tugadi (15 daqiqa). «Ilovani yasash» ni qayta bosing.");
  } finally {
    // bekor qilingan/tugagan so'rov fayli qolib ketmasin (eas-cli faqat muvaffaqiyatda o'chiradi)
    fs.rmSync(path.join(os.homedir(), '.expo', 'device-login', `${requestId}.json`), { force: true });
    job.login = null;
    emit({ type: 'login', login: null });
  }
}

async function runBuild(settings) {
  const platform = settings.lastPlatform;
  resetJob(platform);
  emit({ type: 'snapshot', job: snapshot() });
  let current = 'frontend';

  try {
    // 1. Frontend
    setStep('frontend', 'active', settings.source);
    const { count, size } = await prepareWeb(settings, log);
    checkCancelled();
    const cfg = await runCommand('npx', ['expo', 'config', '--json', '--type', 'public']);
    if (cfg.code !== 0) throw new Error(`Ilova sozlamalarida xato:\n${stripAnsi(cfg.stderr)}`);
    const port = JSON.parse(cfg.stdout).extra.port;
    log(`Ilova ichidagi manzil (backend CORS uchun): http://127.0.0.1:${port}`);
    setStep('frontend', 'done', `${count} ta fayl, ${(size / 1024 / 1024).toFixed(1)} MB`);

    // 2. Expo akkaunt
    current = 'account';
    setStep('account', 'active', 'Tekshirilmoqda...');
    let who = await eas(['whoami']);
    checkCancelled();
    if (who.code !== 0) {
      await deviceLogin();
      who = await eas(['whoami']);
      if (who.code !== 0) throw new Error("Expo akkauntiga kirib bo'lmadi.");
    }
    setStep('account', 'done', stripAnsi(who.stdout).trim().split(/\r?\n/)[0]);

    // 3. expo.dev loyiha (bir marta)
    current = 'project';
    if (!settings.easProjectId) {
      setStep('project', 'active', 'Yaratilmoqda...');
      const init = await eas(['init', '--non-interactive', '--force'], { onLine: log });
      checkCancelled();
      const id = stripAnsi(init.stdout + init.stderr).match(/"projectId":\s*"([0-9a-f-]{36})"/)?.[1];
      if (!id) throw new Error("expo.dev da loyiha yaratib bo'lmadi.");
      settings.easProjectId = id;
      saveSettings(settings);
    }
    setStep('project', 'done', settings.slug);

    // 4. Build
    current = 'build';
    setStep('build', 'active', "Expo serverida — odatda 10–20 daqiqa");
    let build;
    if (platform === 'ios') {
      // Apple akkaunt ma'lumotlari terminalda so'raladi
      setStep('build', 'active', "Terminal oynasiga o'ting — Apple akkaunt ma'lumotlari so'raladi");
      const res = await eas(['build', '-p', 'ios', '--profile', 'production'], { stdio: 'inherit' });
      checkCancelled();
      if (res.code !== 0) throw new Error("Build xato bilan tugadi. Terminal oynasidagi xabarni o'qing.");
      const list = await eas(['build:list', '--platform', 'ios', '--limit', '1', '--json', '--non-interactive']);
      build = JSON.parse(list.stdout)[0];
    } else {
      const profile = platform === 'apk' ? 'preview' : 'production';
      const res = await eas(['build', '-p', 'android', '--profile', profile, '--non-interactive', '--json'], {
        logStdout: false, // --json natijasi stdout'da, loglar stderr'da
        onLine: (l) => {
          log(l);
          const url = l.match(/See logs:\s*(\S+)/)?.[1];
          if (url) {
            job.buildPage = url;
            emit({ type: 'buildPage', url });
          }
        },
      });
      checkCancelled();
      try {
        build = JSON.parse(res.stdout.slice(res.stdout.indexOf('[')))[0];
      } catch {
        build = null;
      }
      if (res.code !== 0 || !build || build.status !== 'FINISHED') {
        throw new Error(
          'Build xato bilan tugadi.' + (job.buildPage ? ' Sababini build sahifasida ko\'ring.' : ' Loglarni ko\'ring.'),
        );
      }
    }

    const artifactUrl = build?.artifacts?.buildUrl ?? build?.artifacts?.applicationArchiveUrl ?? null;
    const buildPage = job.buildPage ?? (build?.id ? `https://expo.dev/builds/${build.id}` : null);
    const qrTarget = platform === 'apk' ? artifactUrl : buildPage;
    const qr = qrTarget ? await QRCode.toString(qrTarget, { type: 'svg', margin: 1, width: 220 }) : null;
    setStep('build', 'done', 'Tayyor');

    job.state = 'done';
    job.result = { platform, artifactUrl, buildPage, qr, finishedAt: Date.now() };
    emit({ type: 'done', result: job.result });
  } catch (e) {
    if (e instanceof Cancelled || job.cancelled) {
      job.state = 'cancelled';
      setStep(current, 'error', 'Bekor qilindi');
      emit({ type: 'cancelled' });
    } else {
      job.state = 'error';
      job.error = e.message;
      setStep(current, 'error', '');
      log(`Xato: ${e.message}`);
      emit({ type: 'error', message: e.message });
    }
  }
}

function cancelJob() {
  if (job.state !== 'running') return;
  job.cancelled = true;
  const child = job.child;
  if (child?.pid) {
    if (isWin) exec(`taskkill /pid ${child.pid} /T /F`, () => {});
    else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }
}

// ───────────────────────────── Sozlamalar ─────────────────────────────

function publicState() {
  const s = loadSettings();
  return {
    settings: {
      source: s.source ?? '',
      name: s.name ?? '',
      color: s.color ?? '#ffffff',
      version: s.version ?? '1.0.0',
      package: s.package ?? '',
      platform: s.lastPlatform ?? 'apk',
      iconName: s.iconSource ?? '',
    },
    hasIcon: exists(APP_ICON) && s.icon === './assets/app-icon.png',
    // paket nomi expo.dev loyihasi yaratilgach o'zgarmaydi
    packageLocked: !!(s.package && s.easProjectId),
    hasProject: !!s.easProjectId,
    project: s.source && exists(s.source) ? detectProject(s.source) : null,
    shortcuts: shortcuts(),
    sep: path.sep,
    job: job.state === 'idle' ? null : snapshot(),
  };
}

function validate(input) {
  const errors = {};
  const source = typeof input.source === 'string' ? path.resolve(input.source.trim()) : '';
  if (!source || !exists(source) || !fs.statSync(source).isDirectory()) errors.source = 'Frontend papkasini tanlang';
  else if (source === root || root.startsWith(source + path.sep)) errors.source = "Bu ilova yasovchining o'z papkasi";
  else if (!detectProject(source)) errors.source = "Bu papkada frontend loyiha topilmadi (package.json yoki index.html yo'q)";

  const name = String(input.name ?? '').trim();
  if (!name) errors.name = 'Ilova nomini kiriting';
  else if (name.length > 40) errors.name = 'Nom 40 belgidan oshmasin';

  if (!PLATFORMS.includes(input.platform)) errors.platform = 'Platformani tanlang';
  if (!/^\d+\.\d+\.\d+$/.test(String(input.version ?? '').trim())) errors.version = 'Format: 1.0.0';
  if (!/^#[0-9a-fA-F]{6}$/.test(String(input.color ?? ''))) errors.color = "Rang noto'g'ri";
  if (input.package && !PACKAGE_RE.test(String(input.package).trim())) {
    errors.package = 'Format: uz.kompaniya.ilova (lotin harflari, raqam, nuqta)';
  }
  return { errors, source, name };
}

// ───────────────────────────── HTTP ─────────────────────────────

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const readBody = (req, limit) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Fayl juda katta'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

let port = Number(process.env.PORT) || 4321;

async function handle(req, res) {
  // Faqat shu kompyuterdagi brauzer va faqat shu sahifa (boshqa saytlar so'rov yubora olmasin)
  const host = req.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return sendJson(res, 403, { error: 'Taqiqlangan' });
  if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== `http://${host}`) {
    return sendJson(res, 403, { error: 'Taqiqlangan' });
  }

  const url = new URL(req.url, `http://${host}`);
  const route = `${req.method} ${url.pathname}`;

  switch (route) {
    case 'GET /api/state':
      return sendJson(res, 200, publicState());

    case 'GET /api/fs': {
      const dir = url.searchParams.get('path') || shortcuts()[0]?.path || os.homedir();
      try {
        return sendJson(res, 200, listDir(dir));
      } catch {
        return sendJson(res, 400, { error: "Bu papkani ochib bo'lmadi" });
      }
    }

    case 'GET /api/package-name':
      return sendJson(res, 200, { package: defaultPackage(url.searchParams.get('name') ?? '') });

    case 'GET /icon.png': {
      const s = loadSettings();
      const file = s.icon === './assets/app-icon.png' && exists(APP_ICON) ? APP_ICON : DEFAULT_ICON;
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      return fs.createReadStream(file).pipe(res);
    }

    case 'POST /api/icon': {
      if (req.headers['content-type'] !== 'image/png') return sendJson(res, 400, { error: 'Faqat PNG rasm qabul qilinadi' });
      try {
        const buf = await readBody(req, 15 * 1024 * 1024);
        const size = pngSize(buf);
        if (!size) return sendJson(res, 400, { error: 'Faqat PNG rasm qabul qilinadi' });
        fs.writeFileSync(APP_ICON, buf);
        const s = loadSettings();
        saveSettings({ ...s, icon: './assets/app-icon.png', iconSource: decodeURIComponent(url.searchParams.get('name') ?? '') });
        const warning =
          size.width !== size.height
            ? `Rasm kvadrat emas (${size.width}×${size.height}) — ikonka cho'zilib ko'rinishi mumkin`
            : size.width < 512
              ? `Rasm kichik (${size.width}×${size.height}) — 1024×1024 tavsiya etiladi`
              : '';
        return sendJson(res, 200, { ...size, warning });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }

    case 'DELETE /api/icon': {
      fs.rmSync(APP_ICON, { force: true });
      const s = loadSettings();
      saveSettings({ ...s, icon: './assets/icon.png', iconSource: undefined });
      return sendJson(res, 200, { ok: true });
    }

    case 'POST /api/build': {
      if (job.state === 'running') return sendJson(res, 409, { error: 'Build allaqachon ketmoqda' });
      if (!String(req.headers['content-type']).startsWith('application/json')) return sendJson(res, 415, { error: 'JSON kerak' });
      let input;
      try {
        input = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8'));
      } catch {
        return sendJson(res, 400, { error: "So'rov noto'g'ri" });
      }
      const { errors, source, name } = validate(input);
      if (Object.keys(errors).length) return sendJson(res, 400, { errors });

      let s = loadSettings();
      if (input.newApp) {
        // Boshqa loyiha — alohida ilova: expo.dev loyihasi va paket nomi yangidan
        s = { icon: s.icon, iconSource: s.iconSource };
      }
      const locked = !!(s.package && s.easProjectId);
      s = {
        ...s,
        source,
        name,
        color: input.color,
        version: input.version.trim(),
        package: locked ? s.package : String(input.package || defaultPackage(name)).trim(),
        slug: s.slug ?? toSlug(name),
        icon: s.icon && exists(path.join(root, s.icon)) ? s.icon : './assets/icon.png',
        lastPlatform: input.platform,
      };
      saveSettings(s);
      runBuild(s);
      return sendJson(res, 202, { ok: true });
    }

    case 'POST /api/login-match': {
      if (!job.login) return sendJson(res, 409, { error: 'Kirish kutilmayapti' });
      let body;
      try {
        body = JSON.parse((await readBody(req, 1024)).toString('utf8'));
      } catch {
        return sendJson(res, 400, { error: "So'rov noto'g'ri" });
      }
      const match = String(body.match ?? '').trim();
      if (!/^\d{1,8}$/.test(match)) return sendJson(res, 400, { error: 'Faqat raqam kiriting' });
      job.login = { ...job.login, match };
      emit({ type: 'login', login: job.login });
      return sendJson(res, 200, { ok: true });
    }

    case 'POST /api/shutdown':
      // yangi ishga tushirilgan Ilova Yasovchi eskisini yopadi (build ketayotgan bo'lsa — yo'q)
      if (job.state === 'running') return sendJson(res, 409, { error: 'Build ketmoqda' });
      sendJson(res, 200, { ok: true });
      setTimeout(() => process.exit(0), 100);
      return;

    case 'POST /api/cancel':
      cancelJob();
      return sendJson(res, 200, { ok: true });

    case 'POST /api/reset':
      if (job.state !== 'running') job.state = 'idle';
      return sendJson(res, 200, { ok: true });

    case 'GET /api/events': {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify({ type: 'snapshot', job: job.state === 'idle' ? null : snapshot() })}\n\n`);
      job.clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => {
        clearInterval(ping);
        job.clients.delete(res);
      });
      return;
    }
  }

  if (req.method === 'GET') {
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const full = path.join(UI_DIR, path.normalize(file));
    if (full.startsWith(UI_DIR + path.sep) && exists(full) && fs.statSync(full).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      return fs.createReadStream(full).pipe(res);
    }
  }
  sendJson(res, 404, { error: 'Topilmadi' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: 'Ichki xato' });
  });
});

const DEFAULT_PORT = port;
let triedShutdown = false;

server.on('error', async (e) => {
  if (e.code !== 'EADDRINUSE' || port >= DEFAULT_PORT + 20) {
    console.error(e.message);
    process.exit(1);
  }
  // Odatiy portda eski Ilova Yasovchi ochiq qolgan bo'lsa — uni yopib, o'rnini egallaymiz
  if (port === DEFAULT_PORT && !triedShutdown) {
    triedShutdown = true;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/shutdown`, { method: 'POST', signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        console.log("  Eski Ilova Yasovchi oynasi yopildi.");
        await new Promise((r) => setTimeout(r, 600));
        return server.listen(port, '127.0.0.1');
      }
    } catch {
      // eski versiya yoki boshqa dastur — keyingi portga o'tamiz
    }
  }
  port++;
  server.listen(port, '127.0.0.1');
});

// Ilova yasovchi yopilganda ishlab turgan buyruq ham to'xtatiladi
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    const pid = job.child?.pid;
    if (pid && !isWin) {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        // jarayon allaqachon tugagan
      }
    }
    process.exit(0);
  });
}

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`\n  Ilova yasovchi ishga tushdi: ${url}`);
  console.log("  Brauzer o'zi ochilmasa, shu manzilni brauzerga kiriting.");
  console.log("  Ishni tugatgach shu oynani yoping (yoki Ctrl+C).\n");
  if (!process.env.NO_OPEN) openBrowser(url);
});
