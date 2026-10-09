/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import type { ExpoConfig } from 'expo/config';

// npm start savollariga berilgan javoblar (scripts/wizard.mjs yozadi)
type Settings = {
  name?: string;
  icon?: string;
  splash?: string;
  color?: string;
  version?: string;
  package?: string;
  slug?: string;
  easProjectId?: string;
};

const settingsFile = path.resolve(process.cwd(), 'ilova.json');
const settings: Settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};

const APP_NAME = settings.name || 'Mening Ilovam';
const APP_ICON = settings.icon || './assets/icon.png';
const APP_SPLASH = settings.splash || APP_ICON;
const APP_COLOR = settings.color || '#ffffff';
const APP_VERSION = settings.version || '1.0.0';

for (const [key, file] of [['icon', APP_ICON], ['splash', APP_SPLASH]]) {
  if (!fs.existsSync(path.resolve(process.cwd(), file))) {
    throw new Error(`ilova.json: ${key} fayli topilmadi: ${file}`);
  }
}

// "Mening Do'konim" -> "mening-dokonim" / "meningdokonim"
const ascii = APP_NAME.toLowerCase().replace(/['‘’ʻʼ`]/g, '').normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = settings.slug || ascii.replace(/ /g, '-') || 'webapp';
const packageName = settings.package || `com.webapp.${ascii.replace(/ /g, '') || 'app'}`;

if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)) {
  throw new Error(`Paket nomi noto'g'ri formatda (masalan: com.kompaniya.ilova): ${packageName}`);
}

// scripts/prepare-web.mjs yozadi; frontend o'zgarganini ilova shu orqali biladi
const webrootInfo = path.resolve(process.cwd(), 'webroot.json');
const webId: string = fs.existsSync(webrootInfo) ? JSON.parse(fs.readFileSync(webrootInfo, 'utf8')).id : 'dev';

// Lokal server porti doimiy bo'lishi shart: localStorage/cookie'lar origin (port) ga bog'langan
const port = 20000 + ([...packageName].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 40000);

const config: ExpoConfig = {
  name: APP_NAME,
  slug,
  version: APP_VERSION,
  orientation: 'portrait',
  icon: APP_ICON,
  userInterfaceStyle: 'light',
  backgroundColor: APP_COLOR,
  ios: {
    bundleIdentifier: packageName,
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: {
    package: packageName,
    adaptiveIcon: {
      foregroundImage: APP_ICON,
      backgroundColor: APP_COLOR,
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: APP_ICON,
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: APP_SPLASH,
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: APP_COLOR,
      },
    ],
    // Ilova ichidagi http://127.0.0.1 serveriga ulanish uchun
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
    './plugins/withWebroot',
  ],
  extra: {
    webId,
    port,
    color: APP_COLOR,
    ...(settings.easProjectId ? { eas: { projectId: settings.easProjectId } } : {}),
  },
};

export default config;
