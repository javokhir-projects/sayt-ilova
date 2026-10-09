// Frontend papkasini oladi, kerak bo'lsa build qiladi va tayyor fayllarni
// webroot/ ga ko'chiradi (ilova ichiga shu papka joylanadi).
// To'g'ridan-to'g'ri ishga tushirilsa (npm run prepare-web) — ilova.json dagi sozlamalar ishlatiladi.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSettings, root } from './settings.mjs';

const webroot = path.join(root, 'webroot');

const hasIndex = (dir) => fs.existsSync(path.join(dir, 'index.html'));

// Buyruq chiqishi onLog ga satrma-satr uzatiladi (terminal yoki brauzerdagi interfeys)
const run = (cmd, cwd, onLog) =>
  new Promise((resolve, reject) => {
    onLog(`> ${cmd}`);
    const child = spawn(cmd, { cwd, shell: true, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
    const pipe = (stream) => {
      let buf = '';
      stream.on('data', (d) => {
        buf += d;
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        lines.forEach((l) => l.trim() && onLog(l));
      });
      stream.on('end', () => buf.trim() && onLog(buf));
    };
    pipe(child.stdout);
    pipe(child.stderr);
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`"${cmd}" buyrug'i xato bilan tugadi. Frontend loyihangizni o'z papkasida tekshiring.`)),
    );
  });

// Frontend build qilingandan keyin tayyor fayllar odatda shu papkalardan birida bo'ladi
function findOutput(dir, buildDir) {
  if (buildDir) {
    const p = path.resolve(dir, buildDir);
    if (!hasIndex(p)) throw new Error(`"buildDir" papkasida index.html topilmadi: ${p}`);
    return p;
  }
  for (const c of ['dist', 'build', 'out', '.output/public', 'www', 'public']) {
    const p = path.join(dir, c);
    if (hasIndex(p)) return p;
  }
  // Angular: dist/<nom>/browser, ba'zi loyihalar: dist/<nom>
  const dist = path.join(dir, 'dist');
  if (fs.existsSync(dist)) {
    for (const name of fs.readdirSync(dist)) {
      for (const sub of [path.join(dist, name, 'browser'), path.join(dist, name)]) {
        if (hasIndex(sub)) return sub;
      }
    }
  }
  return null;
}

function packageManager(dir) {
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(dir, 'bun.lock')) || fs.existsSync(path.join(dir, 'bun.lockb'))) return 'bun';
  return 'npm';
}

/**
 * @param {{ source: string, buildCommand?: string, buildDir?: string }} settings
 * @param {(line: string) => void} [onLog]
 * @returns {Promise<{ output: string, count: number, size: number }>}
 */
export async function prepareWeb({ source: rawSource, buildCommand, buildDir }, onLog = console.log) {
  if (!rawSource) throw new Error("Frontend papkasi ko'rsatilmagan. Avval: npm start");

  const source = path.resolve(root, rawSource);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`Frontend papkasi topilmadi: ${source}`);
  }
  if (source === root || root.startsWith(source + path.sep)) {
    throw new Error("Frontend papkasi shu ilova-yasovchi papkaning o'zi bo'lmasligi kerak.");
  }

  let output;
  const pkgFile = path.join(source, 'package.json');

  if (!fs.existsSync(pkgFile)) {
    // Oddiy HTML/CSS/JS sayt yoki allaqachon build qilingan papka
    output = hasIndex(source) ? source : findOutput(source, buildDir);
    if (!output) throw new Error(`${source} ichida index.html topilmadi.`);
    onLog(`Statik sayt topildi: ${output}`);
  } else {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const pm = packageManager(source);

    if (deps.next) {
      const nextCfg = ['next.config.js', 'next.config.mjs', 'next.config.ts']
        .map((f) => path.join(source, f))
        .find((f) => fs.existsSync(f));
      const text = nextCfg ? fs.readFileSync(nextCfg, 'utf8') : '';
      if (!/output\s*:\s*['"]export['"]/.test(text)) {
        throw new Error(
          "Next.js loyihasi faqat statik eksport rejimida ishlaydi.\n" +
            "next.config faylida  output: 'export'  qo'shing (API routes va SSR ilovada ishlamaydi).",
        );
      }
    }

    const cmd =
      buildCommand ||
      (deps.nuxt && pkg.scripts?.generate ? `${pm} run generate` : pkg.scripts?.build ? `${pm} run build` : '');

    if (cmd) {
      if (!fs.existsSync(path.join(source, 'node_modules'))) await run(`${pm} install`, source, onLog);
      await run(cmd, source, onLog);
    } else {
      onLog("package.json da build skripti yo'q — papka tayyor sayt deb olinadi.");
    }

    output = findOutput(source, buildDir) ?? (hasIndex(source) ? source : null);
    if (!output) {
      throw new Error(
        "Build natijasi (index.html) topilmadi — dist, build, out papkalari tekshirildi.\n" +
          'ilova.json ga  "buildDir": "papka_nomi"  qo\'shib aniq ko\'rsating.',
      );
    }
  }

  // webroot/ ni yangilash
  const skip = new Set(['node_modules', '.git', '.env']);
  fs.rmSync(webroot, { recursive: true, force: true });
  fs.cpSync(output, webroot, {
    recursive: true,
    filter: (src) => !skip.has(path.basename(src)) || src === output,
  });

  // Ilova yangilanganda telefondagi eski fayllarni almashtirish uchun kontent "barmoq izi"
  const hash = crypto.createHash('sha1');
  let count = 0;
  let size = 0;
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else {
        const data = fs.readFileSync(p);
        hash.update(path.relative(webroot, p)).update(data);
        count++;
        size += data.length;
      }
    }
  })(webroot);

  fs.writeFileSync(path.join(root, 'webroot.json'), JSON.stringify({ id: hash.digest('hex').slice(0, 16) }, null, 2) + '\n');
  return { output, count, size };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { output, count, size } = await prepareWeb(loadSettings());
    console.log(`\nFrontend tayyor: ${count} ta fayl, ${(size / 1024 / 1024).toFixed(1)} MB  (${output})`);
  } catch (e) {
    console.error(`\nXato: ${e.message}\n`);
    process.exit(1);
  }
}
