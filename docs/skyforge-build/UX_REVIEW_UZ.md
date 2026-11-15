# SKYFORGE UX va kod tekshiruvi

Sana: 2026-11-15. Tekshiruv chegarasi: 51a1a53 dan hozirgi o‘zgarishlargacha.

## Natija

Chatning uch nuqtasi har bir sidebar qatori yoniga ko‘chirildi. Desktopda hover/fokusda, sensorli qurilmada doim bosish mumkin. Ixcham ikonali menyuda Rename, Pin, Share, Copy, Memory, Archive, Delete mavjud. Nomni o‘zgartirish faqat Rename tanlanganda alohida oynada ochiladi. Menyu tashqariga bosish va Escape bilan yopiladi, klaviatura strelkalari bilan boshqariladi. Bog‘liq bo‘lmagan chatning menyusi ham aynan o‘sha chatga amal qiladi.

## Standards — mustaqil kod tekshiruvi

Repo ichida AGENTS/CONTRIBUTING/CODING_STANDARDS topilmadi. Funksional tekshiruvda 3 muammo:

1. Xotirani yangi chatda yoqish boshqaruvi yo‘qolgan — Memory ichida qaytarildi.
2. Dalil parchasi o‘rniga butun PDF sahifasi sariq belgilanayotgan edi — endi aniq source.text parchasi ishlatiladi.
3. Chat o‘chirilganda yoki boshqa chat tanlanganda biriktirmalar saqlanib qolishi — biriktirmalar va draft holati tozalanadi.

Uchala muammo tuzatildi. Kod tuzilmasi bo‘yicha bitta tavsiya qoladi: Workspace.jsx kattalashgan; Notes, upload va evidence komponentlarini keyingi refaktorda alohida modullarga ajratish. Bu tekshiruvdan o‘tgan oqimni ishlamaydi degani emas.

## Spec — mustaqil talablar tekshiruvi

3 muammo:

1. Ulashilgan suhbatda AI talqini belgisi va manba bog‘lanishi yo‘qolishi — kind, interpretation va evidence ID’lar saqlanadi/ko‘rsatiladi.
2. Butun sahifani dalil deb bo‘yash — aniq keltirilgan parcha bilan cheklangan.
3. English rejimida attachment holatlari o‘zbekcha qolishi — Ready/Partially ready/Failed va hajm xabari tarjima qilindi.

Uchala muammo tuzatildi.

## Amaliy sinovlar

- 71 avtomatik test PASS; o‘zgargan API uchun qo‘shimcha share/revoke va Notes izolyatsiyasi assertionlari PASS.
- Build PASS.
- Sidebar: bo‘sh chatlar yashirin, Rename, Pin, Share boshqa sessiyada ochilishi, revoke, Notes reload, day/night, Escape va 390 px overflow — PASS.
- Evidence: oddiy Library ochilganda panel yo‘q; so‘ralganda o‘qiladigan mazmun va cited page havolasi chiqadi; yopish — PASS. Taqdimot testida maxsus source fixture ishlatilgan, ilmiy yangi dalil yaratilmagan.
- O‘zbekcha va inglizcha haqiqiy OpenRouter savoli: T20 11→3 cm/s Quenched, T21 11→47 cm/s Blow-off; ikkala dalil/locator bor — PASS. Chiqishlar docs/skyforge-build/ux-bilingual-results.json da.

## Baholash: 8/10

Bu ichki UX va mahsulot tayyorligining subyektiv bahosi, NASA hakamlarining rasmiy bali emas. Manbani tekshirish, asosiy chat oqimi va xatolarni ajratish ancha yaxshilandi. 10/10 uchun real foydalanuvchilar bilan vazifani bajarish o‘lchovlari, barcha yordamchi ekranlarda to‘liq ikki tillilik, ko‘proq ilmiy korpusda mustaqil sinov va barcha PDF formatlarida original matnga koordinatali belgi kerak.

PDF originalining o‘ziga sariq overlay hali qo‘shilmagan. O‘qiladigan dalil ajratiladi va asl sahifa ochiladi. Bu ikki imkoniyat hisobotda bir xil deb ko‘rsatilmaydi. Video tahlili va barcha skanlarga OCR hali cheklangan. Tailscale manzil umumiy internet uchun ochiq emas.

Yakuniy deploy: b75aa59. Jonli 4191 serverda sidebar-menu-check, evidence-menu-check va workspace-ui-check — PASS. Inglizcha UI oqimi va ikki tildagi haqiqiy AI savollari alohida tekshirildi. Kod bo‘yicha 4 ta takrorlanmaydigan funksional muammo (ikki review’da ayrimlari takrorlangan) tuzatildi; bitta modullarga ajratish tavsiyasi qolgan.
