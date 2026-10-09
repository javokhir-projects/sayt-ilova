import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import Server, { resolveAssetsPath } from '@dr.pogodin/react-native-static-server';
import {
  copyFileAssets,
  DocumentDirectoryPath,
  exists,
  readFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';

SplashScreen.preventAutoHideAsync().catch(() => {});

const extra = Constants.expoConfig?.extra ?? {};
const WEB_ID: string = extra.webId ?? 'dev';
const PORT: number = extra.port ?? 38080;
const APP_COLOR: string = extra.color ?? '#ffffff';
const ORIGIN = `http://127.0.0.1:${PORT}`;

const MIME_TYPES = `
mimetype.assign = (
  ".html" => "text/html; charset=utf-8", ".htm" => "text/html; charset=utf-8",
  ".js" => "text/javascript; charset=utf-8", ".mjs" => "text/javascript; charset=utf-8",
  ".css" => "text/css; charset=utf-8", ".json" => "application/json", ".map" => "application/json",
  ".webmanifest" => "application/manifest+json", ".xml" => "application/xml", ".txt" => "text/plain; charset=utf-8",
  ".svg" => "image/svg+xml", ".png" => "image/png", ".jpg" => "image/jpeg", ".jpeg" => "image/jpeg",
  ".gif" => "image/gif", ".webp" => "image/webp", ".avif" => "image/avif", ".ico" => "image/x-icon",
  ".woff" => "font/woff", ".woff2" => "font/woff2", ".ttf" => "font/ttf", ".otf" => "font/otf", ".eot" => "application/vnd.ms-fontobject",
  ".mp4" => "video/mp4", ".webm" => "video/webm", ".mp3" => "audio/mpeg", ".wav" => "audio/wav", ".ogg" => "audio/ogg",
  ".wasm" => "application/wasm", ".pdf" => "application/pdf",
  "" => "application/octet-stream"
)`;

const SERVER_CONFIG = `
${MIME_TYPES}
# SPA: mavjud bo'lmagan yo'llar (masalan /profile) index.html ga yo'naltiriladi
server.error-handler-404 = "/index.html"
# Ilova yangilanganda eski fayllar keshdan olinmasligi uchun
server.modules += ("mod_setenv")
setenv.add-response-header = ("Cache-Control" => "no-cache")
`;

// Android'da ilova ichidagi fayllarni server to'g'ridan-to'g'ri o'qiy olmaydi —
// ular bir marta oddiy papkaga chiqariladi (frontend yangilanganda qayta).
async function prepareFiles(): Promise<string> {
  if (Platform.OS !== 'android') return resolveAssetsPath('webroot');

  const dir = `${DocumentDirectoryPath}/webroot`;
  const marker = `${DocumentDirectoryPath}/webroot.id`;
  const current = (await exists(marker)) ? await readFile(marker, 'utf8') : '';

  if (current !== WEB_ID || !(await exists(`${dir}/index.html`))) {
    if (await exists(dir)) await unlink(dir);
    await copyFileAssets('webroot', dir);
    await writeFile(marker, WEB_ID, 'utf8');
  }
  return dir;
}

function useLocalServer() {
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let server: Server | undefined;
    let cancelled = false;

    (async () => {
      try {
        const fileDir = await prepareFiles();
        if (cancelled) return;
        server = new Server({ fileDir, port: PORT, hostname: '127.0.0.1', extraConfig: SERVER_CONFIG });
        const url = await server.start();
        if (!cancelled) setOrigin(url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      setOrigin('');
      server?.stop();
    };
  }, [attempt]);

  const retry = () => {
    setError('');
    setAttempt((n) => n + 1);
  };

  return { origin, error, retry };
}

// Ilova ichidagi sahifalar shu yerda, tashqi havolalar (boshqa saytlar, tel:, mailto:) tizimda ochiladi
const isInternal = (url: string) =>
  url.startsWith(ORIGIN) || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:');

function Browser() {
  const { origin, error, retry } = useLocalServer();
  const webview = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webview.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  useEffect(() => {
    if (error) SplashScreen.hideAsync().catch(() => {});
  }, [error]);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  const onShouldStartLoad = useCallback((req: { url: string; isTopFrame?: boolean }) => {
    if (req.isTopFrame === false || isInternal(req.url)) return true;
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  const onLoadEnd = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: APP_COLOR }]} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {origin ? (
        <WebView
          ref={webview}
          source={{ uri: `${origin}/` }}
          style={styles.webview}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          onLoadEnd={onLoadEnd}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
        />
      ) : error ? (
        <View style={[styles.overlay, styles.error]}>
          <Text style={styles.errorTitle}>Ilovani ishga tushirib bo'lmadi</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.button} onPress={retry}>
            <Text style={styles.buttonText}>Qayta urinish</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Browser />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8, color: '#111' },
  errorText: { fontSize: 15, textAlign: 'center', color: '#555', marginBottom: 20 },
  button: { backgroundColor: '#111', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
