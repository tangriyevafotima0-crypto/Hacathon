# SKYFORGE — UZ/EN va Tools yangilanishi

2026-11-15, Asia/Tashkent.

Asos: foydalanuvchining barcha bo‘limlarni UZ/EN qilish talabi va SKYFORGE_Tushuntirish_va_Pitch_v1.html dagi 7–10, 12-bo‘limlar. HTML mahsulot yo‘nalishi sifatida o‘qildi; undagi rejalashtirilgan imkoniyatlar tayyor deb olinmadi.

Bajarildi:
- Asosiy navigatsiya, chat boshqaruvi, qaydlar, ulashilgan chat, dalil paneli, Library filtrlari, taqqoslash, holatlar va Tools uchun umumiy tarjima lug‘ati.
- Eski import/Atlas oynasi global til tanloviga ulandi. API enum qiymatlari, original manba matni va eksport formatlari saqlandi.
- Tools uch maqsadli kartaga ajratildi: qaysi dalil foydaliroq, hisoblashga dalil yetarlimi, shart o‘zgarsa nima bo‘ladi.
- Maqsad, manbalar, bajarish va natija ketma-ketligi; qo‘shimcha vazn/obyekt/prior sozlamalari kerak bo‘lganda ochiladi.
- Natija qisqa va tushunarli; reyting xavfsizlik foizi emasligi, sintetik misol esa NASA natijasi emasligi natijaning o‘zida yoziladi.
- Saqlangan tahlillar, qayta hisoblash va original JSON eksport saqlandi.
- Ixcham delete dialogdan chat nomi olib tashlandi.

Tekshiruv:
- npm test: 71/71 PASS.
- npm run build: PASS (JS bundle 500 kB dan biroz katta; Vite optimallashtirish tavsiyasi mavjud).
- scripts/tools-language-check.cjs: UZ/EN navigatsiya, reyting, haqiqiy enum qiymatlari bilan material/efficiency tanlovi, dalil yetishmasligi, sintetik 33.33%, ssenariy, JSON yuklash, Notes, Library va eski import tili, 390px overflow — PASS.
- scripts/localized-chat-check.cjs: UZ/EN chat, shared view, Cancel/Confirm, nomning yo‘qligi, native browser dialogs=0 — PASS.

Chegaralar:
- Original ilmiy hujjatlar va foydalanuvchi yozgan eski matnlar avtomatik tarjima qilinmaydi. Texnik JSON yozuvi asl schema bilan qoladi.
- Fizik reyting 3 ta BASS-II yozuvi bilan ishlaydi; yangi PDF’lar avtomatik normalizatsiyalangan fizik yozuv deb ko‘rsatilmaydi.
- Ushbu yangilanish yangi 4.93 GB server papkasini umumiy indeksga ulamaydi.
