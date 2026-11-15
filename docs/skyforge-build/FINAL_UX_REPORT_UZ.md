# SKYFORGE — yakuniy UX va ishlash tekshiruvi

Sana: 2026-11-15. Ishlayotgan reliz: `6409b41`.
Manzil: http://100.105.241.126:4191/
Branch: `codex/skyforge-build-pack`.

## Tayyorlangan qismlar

- Tools tasdiqlangan B ko‘rinishiga mos: uchta alohida ilova, so‘nggi saqlangan ishlar. Har biri o‘z vazifasini bajaradi.
- Reyting: tanlangan sinovlargina hisoblanadi; natija, sabab, dalil havolasi, sozlamalar, saqlash va eksport ishlaydi.
- Baholash: haqiqiy dalil yetishmasa sabablarni ko‘rsatadi. Sintetik misol alohida belgilangan; n=10, k=3, a=b=1 uchun 33.33%, interval 10.93–60.97%. Noto‘g‘ri qiymatlar rad qilinadi.
- Ssenariy: kuzatilgan fakt, kiritilgan taxmin va keyingi tajriba ajratilgan. Saqlangan ishni qayta ochish va eksport mavjud.
- Chat: Stop kvadrat belgisi yuborish tugmasining o‘rnida paydo bo‘ladi. Bekor qilishdan keyin yuborish belgisi qaytadi.
- Mahsulot haqida savol tadqiqot javobiga adashmaydi. Oddiy salomlashish/suhbat mumkin. Ilmiy va boshqa faktlar faqat ulangan manbalardan; mos dalil bo‘lmasa bazada topilmaganini aytadi. Oldingi javob keshi yangi siyosatdan ajratildi.
- Chat menyusi: nomlash, pin, share havolasini nusxalash, suhbatni nusxalash, xotira, arxiv va o‘chirish. Tools sahifasidan ham kerakli oynani ochadi. Clipboard ruxsati berilmasa muqobil nusxalash mavjud. Sidebar uchun bitta hamburger qoldi.
- Library: serverdagi 61 ta tekshirilgan PDF katalogi. PDF endi iframe/brauzer plaginiga tayanmaydi: Library ichida haqiqiy sahifa chiziladi. Oldingi/keyingi sahifa, sahifa raqami, zoom va katta oynada ko‘rish mavjud. Import qilingan PDF ham o‘z hujjati ichida ko‘rinadi.
- Kompyuterdagi PDFni mahalliy ko‘rish tugmasi mavjud. Bu tanlov faylni serverga jo‘natmaydi va AI indeksiga qo‘shmaydi.
- UZ/EN, mobil ekran va kunduz/tun mavzulari saqlangan.

## Haqiqiy tekshiruvlar

- `npm test`: 74/74 o‘tdi.
- Mahalliy va server `npm run build`: o‘tdi. Asosiy JS hajmi uchun Vite ogohlantirishi qolgan; PDF mexanizmi kerak bo‘lgandagina alohida yuklanadi.
- `scripts/focused-apps-check.cjs`: jonli serverda ikki tilda ilovalar, hisoblashlar, cheklovlar, eksport, qayta ochish va mobil ko‘rinish tekshirildi. Natija `docs/skyforge-build/focused-apps-results.json`.
- `scripts/menu-cross-page-check.cjs`: jonli serverda Rename, Share, Copy fallback, Memory saqlash, revoke, archive/restore, bitta sidebar boshqaruvi ikki tilda o‘tdi; JS xato yo‘q.
- `scripts/stop-icon-check.cjs`: UI bekor qilish oqimi kechiktirilgan test transportida o‘tdi. Backend AbortSignal alohida unit testda tekshirilgan.
- `scripts/source-only-live.mjs`: 10 ta avvalgi jonli sinov — mahsulotni tanishtirish UZ/EN, suhbat, bazada yo‘q fakt, yo‘q trial, T20/T21 UZ/EN va haqiqiy AI sozlama takliflari — o‘tdi. Dalillar `source-only-live.json`da.
- `scripts/library-pdf-check.cjs`: jonli server katalogi, haqiqiy `%PDF-` baytlari, HTTP Range 206 va ko‘rinadigan sahifada 72,273 ta oq bo‘lmagan piksel tasdiqlandi; JS xato yo‘q.
- `scripts/inline-pdf-check.cjs`: Downloads’dagi `PSI-117_Presentations_Extinction_Characteristics_TFarouk.pdf` (11,802,360 bayt, 18 sahifa) bilan jonli serverda EN/UZ sinov. Sahifa 1→2→1 haqiqiy tasviri almashdi; zoom, mobil 390px, katta oyna va yopish o‘tdi. Shaxsiy boshqa Downloads hujjatlari ishlatilmadi.
- Server health: READY, workspaceConfigured=true, corpusConfigured=true.

## Sinab ko‘rish

1. Saytni oching, Ctrl+F5 bosing.
2. Library → PDF hujjatlar → server PDF nomini bosing. PDF shu sahifada ko‘rinadi.
3. Yoki “Kompyuterdagi PDFni ko‘rish” orqali Downloads’dagi PSI-117 hujjatini tanlang.
4. Chap/o‘ng tugma, sahifa raqami, +/− zoom va katta oynani sinang.
5. Tools → Reyting/Baholash/Ssenariy orqali alohida ish bajaring va saqlangan natijani qayta oching.
6. Chatda T20/T21 haqida so‘rang; keyin bazaga aloqasiz fakt so‘rang. Ikkinchisida tasodifiy fakt o‘rniga mos dalil yo‘qligi chiqishi kerak.

## Qolayotgan chegaralar

Serverdagi yangi PDFni ko‘rish uning AI vektor indeksiga qo‘shilganini bildirmaydi. Qo‘shimcha 5 GB paket to‘liq yuklanib/indexlangan deb hisoblanmagan. Katalog faqat tekshirilgan mavjud fayllarni ko‘rsatadi. Fizik reyting hali manba tekshiruvidan o‘tgan uchta BASS-II yozuvi bilan ishlaydi; barcha PDF avtomatik o‘lchov jadvaliga aylantirilmaydi. Mahalliy PDF ko‘rish — preview; AI uchun mavjud Import oqimi va 8 MB chegarasi amal qiladi.

Bu hisobot butun loyiha 100% tayyor degan da’vo emas; yuqoridagi relizda amalda tekshirilgan imkoniyatlarni qayd etadi.
