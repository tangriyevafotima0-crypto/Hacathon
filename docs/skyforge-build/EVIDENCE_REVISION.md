# SKYFORGE — sifat va dalilni tekshirish yangilanishi

Sana: 2026-11-15, Asia/Tashkent. Vazifa: SF-EVIDENCE-02.

Serverga o‘rnatilgan kod: `de135b82dd517791f7356142d12d81716409ec3e`. Branch: `codex/skyforge-build-pack`. Health: READY; workspace va korpus ulangan. Server build va 71 test muvaffaqiyatli; yakuniy jonli UI tekshiruvi 2026-11-15 10:45 (Asia/Tashkent) da o‘tdi.

## Amalda bajarilgan o‘zgarishlar

- Chatdagi `+` tizim fayl tanlash oynasini ochadi. Bir savolga 3 tagacha, har biri 8 MB gacha PDF, DOCX, TXT, CSV, JSON, PNG yoki JPEG biriktiriladi.
- Fayl → navbat → matn/rasm ajratish → embedding → saqlash → qidiruv oqimi mavjud ingestion ichida ishlaydi. Fayl tayyor bo‘lmaguncha yuborish bloklanadi; holati ko‘rinadi.
- Biriktirilgan fayllar mavjud bo‘lsa, javob qidiruvi faqat ularga tegishli parchalar bilan cheklanadi. Ulanmagan NASA natijasi ularning o‘rniga ishlatilmaydi.
- Chat tarixi turn yozuvida asset ID’lar saqlanadi. Shu chat qayta ochilganda mavjud biriktirmalar tiklanadi. New Chat ularni tozalaydi.
- PNG/JPEG va PDF ichidagi dastlabki 3 ta raster rasm OpenRouter orqali tavsiflanadi; ko‘rinadigan yozuvlar ajratiladi. Natija `AI_INTERPRETATION`, hech qachon avtomatik NASA o‘lchovi emas.
- PDF sahifa lokatori, rasm raqami, manba fayli, model va ajratish holati saqlanadi. Rasm ishlanmasa matn yo‘qolmaydi, PARTIAL/aniq xato holati qoladi.
- Javobdagi Library tugmasi javobning manbalarini ochadi. Yuqoridagi Library ham oxirgi javob dalillarini ko‘rsatadi. Alohida manbani tanlash mumkin.
- Sariq belgi aniq ishlatilgan **ajratilgan matn parchasi**ga qo‘yiladi. Bu original PDF piksel koordinatalariga chizilgan belgi emas. Asl PDF sahifasi alohida havola yoki ichki PDF oynasida tekshiriladi.
- Dalillar JSON eksport qilinadi. Javob nusxasida manba lokatorlari va havolalari saqlanadi.
- Library chatdan yuklangan hujjatlarni ochilishida yangilaydi. Tajriba nomi qidiruvi kengaytirildi, Tozalash tugmasi qo‘shildi. Korpusning qisman ekanligi ochiq yozildi.
- Yulduzsimon belgi o‘rnida o‘zgartirilmagan NASA belgisi NASA manbasiga havola sifatida ishlatiladi. Fire Atlas mustaqil loyiha bo‘lib qoladi; NASA mahsuloti sifatida taqdim etilmaydi.
- Day/night va til tanlovi saqlanadi. Ranglar qora/oq/kulrang, kirishda ko‘k gradient; dalil uchun sariq. Ortiqcha neon qo‘shilmadi.
- Server/API/budjet/manba tekshiruvi xatolari uchun tushunarli xabarlar qo‘shildi.

## Tekshiruv dalillari

| Tekshiruv | Natija va chegarasi |
|---|---|
| `npm test` | 71/71 PASS: fizik ma’no, import, saqlash, manba nazorati, owner izolyatsiyasi va yangi biriktirmalar |
| `npm run build` | PASS |
| `node scripts/d01-d02-integrity.mjs` | 42 artefakt PASS |
| `scripts/attachment-live-check.cjs` | Jonli serverda haqiqiy PDF fayl: matn, ichki raster rasm, haqiqiy OpenRouter talqini, savol-javob, sariq parcha, PDF sahifa havolasi, boshqa session uchun 401/404, New Chat, mobil — PASS |
| `scripts/buildpack-smoke.mjs` | 8 jonli tekshiruv PASS: AI, idempotent turn, taqqoslash, memory, shelves, tools, CSV, Moon abstention, media Range |
| `scripts/buildpack-gold.mjs` | 7/7 belgilangan savol PASS; median 307 ms, p95 599 ms. Bu kichik test to‘plami, umumiy aniqlik foizi emas |
| `scripts/buildpack-updates.mjs` | Smart shelf, qo‘lda chiqarish, stale run, tarixning o‘zgarmasligi va qayta hisoblash — PASS |
| `scripts/workspace-ui-check.cjs` | Library yangilanishi, qidiruvni tozalash, taqqoslash, JSON yuklash, sintetik Tools, Settings/Escape, til, salomlashuv, chat nomi va 390px mobil — PASS |

PDF testida maxsus **sintetik test hujjati** ishlatilgan; u NASA tadqiqoti deb ko‘rsatilmaydi. Haqiqiy NASA T20/T21 savoli alohida jonli smoke testida tekshirildi. Bir o‘lchangan AI javob vaqti 4.5 soniya, provider xarajati $0.000542; bu umumiy kafolat yoki butun ishning xarajati emas.

JSON dalillar: `attachment-live-results.json`, `evidence-revision-smoke.json`, `workspace-ui-results.json`, `GOLD_SET_RESULTS.json`, `dependency-results.json` — repodagi `docs/skyforge-build/` ichida.

## Baholash mezonlari bilan bog‘lanishi

Tekshirilgan rasmiy manba: [2025 NASA Space Apps judging guide](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf). 2026 yil uchun aynan shu qo‘llanma amal qilishini tasdiqlamadik. Avvalgi 7/10 shaxsiy baho bo‘lgan; rasmiy qo‘llanmada yaxlit 1–5 baholash qo‘llanadi.

| Mezon | Mahsulotdagi kuchaytirish | Hali tashqi dalil kerak |
|---|---|---|
| Impact | AI javobidan mustaqil manba tekshiruvigacha to‘g‘ridan-to‘g‘ri yo‘l; hujjat importi | Real tadqiqotchi bilan vaqt tejash va vazifani bajarish o‘lchovi |
| Creativity | Qidiruv, manbali chat, manba tekshiruvi va fizik taqqoslash bir oqimda | Yangi ilmiy usul yaratilgani da’vo qilinmaydi; o‘xshash vositalar bilan taqqoslash kerak |
| Validity | Birlik/tartib, manba ID, o‘lchov va AI talqinini ajratish; yetarli dalilsiz javob bermaslik | Kengroq mustaqil ilmiy va adversarial multimodal test to‘plami |
| Relevance | NASA PSI metadata/jadvallari va BASS dalillari real ishlatiladi | Butun bazani yukladik deb ko‘rsatmaslik; amaldagi challenge shartlarini topshirishda tekshirish |
| Presentation | Sodda interfeys, day/night, manbaga o‘tish, sinov ssenariysi | Jamoaning pitch matni/video va mustaqil tashrifchiga ochiq demo havolasi |

## Sinab ko‘rish

1. http://100.105.241.126:4191/ manzilini oching, Ctrl+F5 bosing. Bu manzil tegishli Tailscale tarmog‘idan ochiladi.
2. `+` ni bosing, 8 MB dan kichik PDF tanlang. `Ingestion…` holati tugashini kuting.
3. “Ushbu faylning asosiy natijasi nima? O‘lchov va manbasini ko‘rsat.” deb yuboring.
4. Javobdagi `Library · Dalilni tekshirish` tugmasini bosing. Manbani tanlang, sariq matnni original sahifa bilan solishtiring. `Dalillarni eksport qilish` orqali JSON oling.
5. New Chat oching. “T20 va T21 da havo oqimi va natija qanday farq qilgan?” deb so‘rang. 11→3 cm/s va 11→47 cm/s tartibi hamda turli yakunlar saqlanishini tekshiring.
6. PNG/JPEG biriktirib, “Rasmda nima ko‘rsatilgan? O‘qilishi mumkin bo‘lgan belgilarni ayt; noaniqlarini ajrat.” deb so‘rang. Natija AI talqini sifatida berilishi kerak.
7. Library’da DAFT deb qidiring, media va manba fayllarini oching. BASS’dan ikkita sinovni tanlab Compare va Export JSON’ni sinang.
8. Tools’da sintetik misolni alohida sinang. Sintetik ehtimol haqiqiy kosmik yong‘in xavfsizligi ehtimoli emas.
9. Settings’da til/ko‘rinishni almashtirib yangilang. Tarixdagi suhbatni qayta oching.

## Ochiq cheklovlar

- PDF ichidagi dastlabki 3 raster rasm; PDF vektor chizmalari va barcha sahifalarni avtomatik render/OCR qilish hali yo‘q. Skan rasmlarining AI transkripsiyasi xato qilishi mumkin.
- Video kadrlarini ilmiy tahlil qilish, transkript va vaqt lokatorlari bu yangilanishda bajarilmadi.
- Original PDF ustida geometrik sariq overlay yo‘q: Library ajratilgan matnni belgilaydi, original sahifaga bog‘laydi.
- Besh NASA to‘plami tanlangan fayllardan iborat; to‘liq NASA bazasi yoki barcha tadqiqot fayllari emas.
- Fizik ranking korpusi hali uchta normalizatsiyalangan BASS sinovi. Oddiy PDF avtomatik tasdiqlangan fizik sinovga aylantirilmaydi.
- Tailscale havola jamoa tarmog‘i uchun. Hakamlar uchun ochiq havola va yakuniy taqdimot alohida tayyorlanishi kerak.
- Haqiqiy server rebootidan keyingi ishga tushish ilgari amalda sinovdan o‘tkazilmagan; xizmatni restart qilish tekshirilgan.

## Analyzer takrorlashi

`npm ci`, `npm test`, `npm run build`, `node scripts/d01-d02-integrity.mjs`.
`SKYFORGE_TEST_URL` ni demo manziliga qo‘yib smoke/gold/updates skriptlarini bajaring.
Playwright o‘rnatilgan muhitda `scripts/workspace-ui-check.cjs` va `scripts/attachment-live-check.cjs` ni bajaring. Attachment skripti real AI chaqiruvi qiladi va kichik xarajat keltiradi. Sinovlar alohida session va sintetik yozuvlardan foydalanadi.
Serverda `G:\SKYFORGE-NASA\release-buildpack.ps1 -Mode Restart` xizmatni qayta ishga tushiradi. API kaliti faqat server `.env.local` faylida qoladi.
