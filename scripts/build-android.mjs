// ilova.json dagi frontend papkasidan Android APK ni lokal build qiladi (Android SDK va Java kerak).
// Windows, Linux va macOS da ishlaydi.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const isWin = process.platform === 'win32';
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit', env: process.env });

if (!fs.existsSync(path.join(root, 'ilova.json'))) {
  console.error("ilova.json topilmadi. Avval sozlamalarni kiriting: npm start");
  process.exit(1);
}

if (!process.env.ANDROID_HOME) {
  const guess = isWin
    ? path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
    : path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk');
  if (fs.existsSync(guess)) process.env.ANDROID_HOME = guess;
}

run('node scripts/prepare-web.mjs');
run('npx expo prebuild --platform android --clean --no-install');
run(isWin ? 'gradlew.bat assembleRelease' : './gradlew assembleRelease', path.join(root, 'android'));

const config = JSON.parse(
  execSync('npx expo config --json --type public', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const name = `${config.name.replace(/[^\w.-]+/g, '_')}-${config.version}`;
const out = path.join(root, 'dist', `${name}.apk`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'), out);
console.log(`\nTayyor: ${path.relative(root, out)}`);
