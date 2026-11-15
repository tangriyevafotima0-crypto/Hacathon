# Serverdagi 5 GB paket — Library ulanishi

2026-11-15. Manba: G:/SKYFORGE-NASA/additional-5gb/manifest.json.

- Rejada 372 ta fayl, 4,928,699,481 bayt.
- Manifestdagi tekshirilgan fayllar: 370 ta, 4,926,218,253 bayt. 2 ta FAILED; paket to‘liq deb belgilanmagan.
- Server Library katalogida 61 ta mavjud, hajmi mos kelgan PDF. Tadqiqotlar: PSI-102 (27), PSI-107 (18), PSI-47 (7), PSI-117 (5), PSI-98 (4).
- Tartib: Library → Serverdagi 5 GB to‘plam → tadqiqot → PDF hujjatlar → tanlangan hujjatning ichki ko‘rinishi.
- Bir paytning o‘zida faqat tanlangan tadqiqot fayllari chiqadi. Qidiruv ham shu tadqiqot ichida ishlaydi. Ortga qaytilganda PDF yopiladi.
- Downloads preview tugmasi va blob faylga bog‘lanish olib tashlandi. Test ham Downloads fayliga bog‘liq emas: server fayllarida ishlaydi. Downloads’dagi asl fayllar o‘chirilmagan.
- Katalog 15 soniyada yangilanadi; yangi manifest-verified PDFlar o‘z tadqiqot bo‘limida chiqadi.
- Jonli serverda: PDF asl baytlari, HTTP Range, haqiqiy canvas sahifasi, papkalarga ajratish, ortga qaytish o‘tdi. PSI-117 ichidagi 227 sahifali PDFda oldingi/keyingi sahifa, zoom, katta oyna, mobil ekran va UZ/EN o‘tdi. JS xatolari yo‘q.
- Bu ulanish fayllarni ko‘rish uchun. Qo‘shimcha paketning barcha matni avtomatik AI indeksiga qo‘shildi degan da’vo qilinmagan. ZIP ichidagi fayllar o‘z-o‘zidan katalogga chiqarilmaydi.

Sayt: http://100.105.241.126:4191/ — Ctrl+F5 → Library.

## Yangilanish: yagona Library

Alohida “5 GB to‘plam” chiqarib tashlandi. Barcha 370 ta tekshirilgan fayl asosiy tadqiqot kartalariga birlashtirildi. 61 ta PDF o‘z tadqiqotining “PDF hujjatlar” qismida ochiladi; qolgan fayllar o‘sha tadqiqotning “Boshqa fayllar” ichida. Video/rasmlar ham shu tadqiqot ichida ko‘rinadi. Hozir paketda yangi PSI ID yo‘qligi sababli jami 5 ta tadqiqot saqlanadi; keyin yangi ID bo‘lsa nomi bilan avtomatik qo‘shiladi. Kartadagi fayl soni birlashtirilgan mavjud yozuvlardan hisoblanadi.

75/75 test o‘tdi. Jonli server: 370 fayl, 61 PDF; Library ichida alohida collection yo‘q, PDF study-detail ichida ko‘rinadi. 227 sahifali server PDFda EN/UZ, oldingi/keyingi, zoom, mobil, katta oynada ochish o‘tdi. Bu o‘zgarish fayl ko‘rish ulanishi; barcha yangi fayllar AI indeksiga qo‘shildi degani emas.
