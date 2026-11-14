# SKYFORGE Z01 topshirish paketi

**Versiya: SKYFORGE-Z01-v1.0.0. Egasi: Z Codex. Sana: 2026-11-14.**

Z01 ma'lumot shartnomasi, CSV/JSON two-pass import, preview/confirm, revision, manba bog'lanishi va localStorage adapteri tayyor. `npm test`: **23/23 PASS**. Diskka saqlab, yangi adapterdan qayta o'qish va T25 ni takror import qilish demosi: **PASS**. Production build: **FAIL / dependency installation blocked**; Vite 7.3.7 keshda yo'q, npm tarmog'i ochilmadi. Mustaqil Analyzer va PM tasdig'i hali olinmagan.

Bu paketdagi umumiy baza berilgan 31-oktabr prototipi. BNning yangiroq umumiy repozitori yoki integratsiya commiti berilmagan. Shu sababli yangi kod alohida Z nusxasida tayyorlandi. Boshqa rollarning kodiga va Argon promptiga tegilmadi. Saytning eski risk hisoblash interfeysi o'zgartirilmagan; yangi Atlas UI ulanmagan.

## Ishga tushirish

Arxivni oching, terminalda `skyforge` papkasiga o'ting. Node.js 22.12+ kerak.

```sh
npm test
npm run demo:z01
```

Bu ikki buyruq tashqi dependency o'rnatmasdan ishlaydi. To'liq React/Vite buildni tekshirish uchun internet ishlaydigan muhitda:

```sh
npm ci
npm test
npm run build
```

## Kerakli fayllar

- `src/atlas/core/` — Z01 moduli, TypeScript tiplari va import sxemasi.
- `src/atlas/core/fixtures/` — T20/T21 namunasi, asl T25 CSV.
- `tests/atlas/import.test.js` — 20 ta yangi Atlas testi; mavjud 3 ta model testi ham saqlangan.
- `scripts/z01-demo.mjs` — seed → preview → commit → T25 → disk reload → repeated import → field evidence → exchange.
- `docs/z01/CONTRACT.md` — D va Bk uchun shartnoma va ulash namunasi.
- `docs/z01/HANDOFF.md` — bajarilgan ishlar, cheklovlar va Analyzer qadamlari.
- `docs/z01/*.log` — haqiqiy buyruq chiqishlari va exit code.
- `docs/z01/demo-output/` — haqiqiy demo saqlagan ma'lumot va eksportlar.
- `docs/z01/baseline-integrity.json` — asl prototip bilan faylma-fayl SHA-256 solishtirish.
- `MANIFEST.sha256` — paket tarkibining nazorat yig'indilari.

Umumiy fayllardan faqat `package.json` ichidagi test/demo skriptlari o'zgardi. Dependency versiyalari va `package-lock.json` o'zgarishsiz. Integratsiyada butun eski prototipni yangiroq repo ustiga ko'chirmang: `core`, `tests/atlas`, demo skript va hujjatlarni olib, `package-scripts.patch`ni amaldagi test skriptlariga moslab qo'llang.
