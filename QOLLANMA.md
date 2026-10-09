# Frontend loyihangizdan mobil ilova yasash — qo'llanma

**Ilova Yasovchi** kompyuteringizdagi **frontend loyiha papkasini** oladi va undan Android yoki iPhone ilova yasaydi. Frontend ilova **ichiga joylanadi** — ilova tez ochiladi, interfeysi internetsiz ham ishlaydi.

Hammasi **brauzerdagi qulay sahifa** orqali qilinadi: papkani tanlaysiz, ikonkani yuklaysiz, nomini yozasiz va bitta tugmani bosasiz. Ilova **Expo serverida** yig'iladi — kuchli kompyuter kerak emas.

**Qanday frontendlar ishlaydi:**

| Loyiha | Holati |
|--------|--------|
| React (Vite, Create React App), Vue, Svelte, Angular, Preact, Solid | ✅ avtomatik |
| Oddiy HTML/CSS/JS (ichida `index.html` bor papka) | ✅ avtomatik |
| Allaqachon build qilingan papka (`dist`, `build`) | ✅ avtomatik |
| Next.js | ✅ faqat `output: 'export'` rejimida (pastga qarang) |
| Nuxt | ✅ `nuxt generate` orqali |
| PHP, Django, Laravel, Express va boshqa **server** loyihalari | ❌ ishlamaydi |

> **Muhim:** ilovaga faqat frontend (brauzerda ishlaydigan qism) joylanadi. Saytingiz API/backend bilan ishlasa — backend internetda (serverda) turishi kerak va frontend unga `https://api.saytingiz.uz` kabi **to'liq manzil** bilan murojaat qilishi kerak.

---

## Bir martalik tayyorgarlik

### 1. Node.js o'rnating

https://nodejs.org → **LTS** versiyasini yuklab oling → o'rnatuvchida hamma joyda **Next**. O'rnatgandan keyin kompyuterni qayta yoqing.

### 2. Arxivni oching

`sayt-ilova.zip` → o'ng tugma → **Extract All** (Hammasini chiqarish). `sayt-ilova` papkasi paydo bo'ladi.

> Papka yo'lida kirill harflari bo'lmagani ma'qul. `C:\Users\Ism\Desktop\sayt-ilova` — yaxshi.

### 3. Frontend loyihangiz build bo'lishini tekshiring

Oddiy HTML sayt bo'lsa — bu qadamni o'tkazib yuboring.

Frontend papkangizda terminal oching (papkani oching → manzil qatoriga `cmd` yozib **Enter**) va:
```
npm run build
```
Xatosiz tugashi kerak. Xato chiqsa — avval loyihangizni tuzating.

**Next.js bo'lsa:** `next.config.js` (`.mjs`/`.ts`) fayliga qo'shing:
```js
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

---

## Ilova yasash

### 1. Ilova Yasovchini ishga tushiring

- **Windows:** `sayt-ilova` papkasidagi **`ilova-yasash.bat`** faylini ikki marta bosing.
- **macOS:** **`ilova-yasash.command`** faylini ikki marta bosing (birinchi marta: o'ng tugma → Open).
- **Linux:** papkada terminal ochib `npm install`, keyin `npm start`.

Birinchi marta kerakli kutubxonalar yuklanadi (1–3 daqiqa). Keyin **brauzerda Ilova Yasovchi sahifasi o'zi ochiladi**.

> Sahifaning yuqori o'ng burchagidagi tugma bilan kun/tun rejimini almashtirishingiz mumkin.
>
> Qora oyna (terminal) ochiq qoladi — **uni yopmang**, Ilova Yasovchi shu oynada ishlaydi. Ishingiz tugagach yopasiz.
>
> Brauzer o'zi ochilmasa — qora oynada ko'rsatilgan manzilni (`http://127.0.0.1:4321`) brauzerga kiriting.

### 2. Sahifada ma'lumotlarni kiriting

**① Frontend loyiha** — **Papkani tanlash** tugmasini bosing. Oyna ochiladi:
- chap tomonda tez o'tish: **Ish stoli**, **Hujjatlar**, **Yuklanmalar**, disklar;
- papkalarni bosib ichiga kirasiz; frontend loyihalar quti belgisi va **React**, **Vue**, **HTML sayt** kabi yorliq bilan ko'rsatiladi;
- loyihangiz papkasiga kirib, **Shu papkani tanlash** ni bosing.

**② Ilova ma'lumotlari:**
- **Ikonka** — PNG rasmni kvadrat maydonga sudrab tashlang yoki bosib tanlang (kvadrat, 1024×1024 tavsiya etiladi). Tanlamasangiz — standart ikonka.
- **Ilova nomi** — telefonda ikonka ostida ko'rinadi. O'ng tomondagi telefon rasmida qanday ko'rinishini darhol ko'rasiz.
- **Fon rangi** — ochilish ekrani va ikonka fonining rangi.
- **Versiya** — birinchi marta `1.0.0`. Ilovani yangilaganda oshiring: `1.0.1`, `1.1.0` ...
- **Qo'shimcha: ilova identifikatori** — Play Market/App Store'ga chiqarsangiz, o'zingizga xos qiling (masalan `uz.mendokon.app`). Birinchi builddan keyin o'zgartirib bo'lmaydi.

**③ Platforma:**
- **Android — APK**: telefonga to'g'ridan-to'g'ri o'rnatish, do'stlarga yuborish uchun;
- **Play Market**: Google Play'ga yuklash uchun AAB fayl;
- **iPhone — iOS**: pullik Apple Developer akkaunt ($99/yil) kerak.

### 3. «Ilovani yasash» tugmasini bosing

Sahifada jarayon bosqichma-bosqich ko'rinadi:

1. **Frontend build** — loyihangiz sizning kompyuteringizda build qilinadi (kerak bo'lsa `npm install` ham).
2. **Expo akkaunt** — birinchi marta **brauzerda Expo sahifasi ochiladi**, Ilova Yasovchi sahifasida esa **tasdiqlash kodi** ko'rinadi. Expo sahifasida akkauntingizga kiring (akkaunt bo'lmasa — o'sha yerda bepul ro'yxatdan o'ting), kod bir xil ekanini tekshirib **tasdiqlang**. Brauzerda raqam ko'rsatilsa — uni Ilova Yasovchi sahifasidagi maydonga kiriting. Tasdiqlagach, jarayon o'zi davom etadi. (Expo sahifasi ochilmasa — **Kirish sahifasini ochish** tugmasini bosing.)
3. **Expo loyiha** — expo.dev da loyihangiz avtomatik yaratiladi.
4. **Ilova yig'ish** — Expo serverida, **10–20 daqiqa**.

> Brauzer sahifasini yopib qo'ysangiz ham build to'xtamaydi — qayta ochsangiz jarayon davom etayotganini ko'rasiz. Faqat **qora oynani yopmang**.
>
> Batafsil jarayonni ko'rmoqchi bo'lsangiz — **Batafsil jarayon (log)** ni oching.

### 4. Natija

Build tugagach **QR kod** va **APK yuklab olish** tugmasi chiqadi:
1. Telefon kamerasi bilan QR kodni skanerlang — APK yuklanadi.
2. Faylni oching. "Noma'lum manbalardan o'rnatish"ga ruxsat so'ralsa — **ruxsat bering**.

APK faylni boshqalarga ham yuborishingiz mumkin (Telegram va h.k.).

**Play Market tanlagan bo'lsangiz:** `.aab` faylni yuklab olib, [Google Play Console](https://play.google.com/console) ga yuklang (Google developer akkaunt, bir martalik $25).

**iPhone tanlagan bo'lsangiz:** build paytida Apple akkaunt ma'lumotlari **qora oynada** so'raladi — sahifa sizga qachon o'tish kerakligini aytadi.

---

## Ilovani yangilash

Frontend kodini o'zgartirdingizmi — ilovani qayta yig'ish kerak:
1. `ilova-yasash.bat` ni ishga tushiring — oldingi ma'lumotlaringiz sahifada tayyor turadi.
2. **Versiyani oshiring** va **Ilovani yasash** ni bosing.
3. Yangi APK ni eskisi ustidan o'rnating — foydalanuvchi ma'lumotlari (login, sozlamalar) saqlanib qoladi.

## Boshqa loyihadan yangi ilova

Boshqa frontend papkasini tanlang — sahifa *"Oldin ... ilovasi boshqa papkadan yasalgan. Bu loyihadan nima qilamiz?"* deb so'raydi:
- **Yangi alohida ilova** — yangi nom va identifikator bilan alohida ilova;
- **O'sha ilovani yangilash** — oldingi ilova shu loyiha bilan almashtiriladi.

## Ilova nimalarni qila oladi

- Frontend to'liq ekranda ochiladi; sahifalar (React Router, Vue Router va h.k.) ishlaydi
- Login, localStorage, cookie'lar ilova yopilib ochilganda ham saqlanadi
- Android "orqaga" tugmasi oldingi sahifaga qaytaradi
- Boshqa saytlarga havolalar, telefon raqamlari (`tel:`), email, Telegram — tegishli ilovada ochiladi

---

## Muammolar va yechimlar

| Holat | Yechim |
|-------|--------|
| `Node.js o'rnatilmagan` | Node.js o'rnating va kompyuterni qayta yoqing. |
| Brauzer ochilmadi | Qora oynadagi `http://127.0.0.1:...` manzilini brauzerga kiriting. |
| Sahifa ochilmayapti | Qora oyna yopilib qolgan — `ilova-yasash.bat` ni qayta ishga tushiring. |
| Papka oynasida loyihangiz quti belgisi bilan ko'rinmayapti | Loyihaning **asosiy** papkasiga kiring (ichida `package.json` yoki `index.html` bo'lgan). |
| `Faqat PNG rasm qabul qilinadi` | Rasmni PNG formatda saqlang (masalan Paint → Save as → PNG). |
| `"npm run build" buyrug'i xato bilan tugadi` | Frontend loyihangizning o'zida xato bor. Uni o'z papkasida `npm run build` qilib tuzating. |
| `Build natijasi (index.html) topilmadi` | `sayt-ilova\ilova.json` ga `"buildDir": "papka_nomi",` qatorini qo'shing. |
| `Next.js loyihasi faqat statik eksport rejimida ishlaydi` | Yuqoridagi `output: 'export'` ni qo'shing. |
| Expo kirish sahifasi ochilmadi | Ilova Yasovchi sahifasidagi **Kirish sahifasini ochish** tugmasini bosing. |
| `Expo'ga kirish tasdiqlanmadi yoki kod eskirdi` | Kod 15 daqiqa amal qiladi. **Ilovani yasash** ni qayta bosing va yangi kod bilan tasdiqlang. |
| Build xato bilan tugadi | **Build sahifasi** havolasini oching — sababi qizil rangda ko'rsatiladi. **Batafsil jarayon (log)** da ham ko'rinadi. |
| Ilovada oq ekran | Frontend brauzerda ishlashini tekshiring: frontend papkasida `npm run build`, keyin `npx serve dist` va brauzerda oching. |
| Ma'lumotlar yuklanmayapti (API) | Frontend backendga to'liq `https://...` manzil bilan murojaat qilishi va backend CORS'da ilova manziliga ruxsat berishi kerak. Bu manzil logda: *"Ilova ichidagi manzil (backend CORS uchun)"*. |
| Bepul build limiti tugadi | Expo bepul tarifida oylik build soni cheklangan. Keyingi oyni kuting yoki tarifni oshiring. |

**Qo'shimcha sozlamalar** (tajribali foydalanuvchilar uchun) — `ilova.json` faylida:
- `"buildCommand": "npm run build:prod"` — boshqa build buyrug'i
- `"buildDir": "dist/app"` — build natijasi papkasi
