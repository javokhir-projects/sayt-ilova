// ilova.json — npm start savollariga berilgan javoblar. app.config.ts ham shu fayldan o'qiydi.
import fs from 'node:fs';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..');
export const settingsFile = path.join(root, 'ilova.json');

export function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  const clean = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined && v !== ''));
  fs.writeFileSync(settingsFile, JSON.stringify(clean, null, 2) + '\n');
}

// "Mening Do'konim" -> "mening dokonim"
const ascii = (name) => name.toLowerCase().replace(/['‘’ʻʼ`]/g, '').normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

export const toSlug = (name) => ascii(name).replace(/ /g, '-') || 'webapp';

export const defaultPackage = (name) => `com.webapp.${ascii(name).replace(/ /g, '').replace(/^(\d)/, 'a$1') || 'app'}`;

export const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
