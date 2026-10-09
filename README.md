# Frontend → Mobil ilova (Expo)

Kompyuterdagi frontend loyiha papkasidan Android/iOS ilova yasaydi. Frontend ilova ichiga joylanadi va telefonda ilova ichidagi lokal HTTP server (`http://127.0.0.1:<port>`) orqali WebView'da ochiladi.

Foydalanuvchilar uchun batafsil qo'llanma: [QOLLANMA.md](QOLLANMA.md).

## Ishga tushirish

```bash
npm install
npm start               # yoki Windows: ilova-yasash.bat, macOS: ilova-yasash.command
```

`npm start` (`scripts/server.mjs`) `127.0.0.1:4321` da lokal veb-interfeysni (`ui/`) ishga tushiradi va brauzerni ochadi. Interfeysda: papka tanlash oynasi (server papkalarni ko'rsatadi, frontend loyihalarni aniqlaydi), ikonka yuklash (PNG), nom/rang/versiya/paket, platforma (APK / AAB / iOS). «Ilovani yasash» → frontend build → Expo akkaunt (kerak bo'lsa `eas login --browser`) → `eas init` → `eas build`; bosqichlar va loglar SSE orqali sahifaga uzatiladi, oxirida QR kod va yuklab olish havolasi.

Sozlamalar `ilova.json` ga saqlanadi (`app.config.ts` ham shu fayldan o'qiydi). Qo'shimcha kalitlar: `buildCommand`, `buildDir`, `splash`.

Xavfsizlik: server faqat `127.0.0.1` da tinglaydi, `Host` va `Origin` sarlavhalari tekshiriladi (boshqa saytlar so'rov yubora olmaydi).

## Boshqa buyruqlar

```bash
npm run prepare-web     # faqat frontendni build qilib webroot/ ga ko'chirish (ilova.json bo'yicha)
npm run build:android   # lokal APK (Android SDK + Java + CMake kerak; Windows hostda rasman qo'llab-quvvatlanmaydi)
npm run dev             # expo start
```

## Qanday ishlaydi

1. `scripts/prepare-web.mjs` — frontend papkasini aniqlaydi (paket menejeri, framework), kerak bo'lsa `install` + `build` qiladi, natijani `webroot/` ga ko'chiradi va kontent xeshini `webroot.json` ga yozadi.
2. `plugins/withWebroot.js` — prebuild paytida `webroot/` ni Android assets va iOS bundle'ga joylaydi.
3. `App.tsx` — Android'da assets'ni (frontend xeshi o'zgarganda) hujjatlar papkasiga chiqaradi, `@dr.pogodin/react-native-static-server` (lighttpd) ni ishga tushiradi va WebView'da ochadi.
   - Port paket nomidan hisoblanadi va **doimiy** — localStorage/cookie'lar saqlanadi.
   - Mavjud bo'lmagan yo'llar `index.html` ga qaytadi (SPA routing).
   - `Cache-Control: no-cache` — ilova yangilanganda eski fayllar keshdan olinmaydi.
4. `scripts/server.mjs` — interfeys va build jarayoni: git'siz rejimda (`EAS_NO_VCS=1`) EAS: login, `eas init` (ID `ilova.json` ga yoziladi), build. Versiya kodi EAS'da avtomatik oshiriladi (`appVersionSource: remote`).

## Cheklovlar

- Faqat statik frontend. SSR, API routes, PHP va h.k. ishlamaydi.
- Backend internetda bo'lishi kerak; frontend unga to'liq URL bilan murojaat qiladi, backend CORS'da `http://127.0.0.1:<port>` ga ruxsat beradi.
- Frontend o'zgarsa ilovani qayta build qilish kerak.
- iOS yo'li hali sinovdan o'tmagan (Apple ma'lumotlari terminal oynasida so'raladi).
