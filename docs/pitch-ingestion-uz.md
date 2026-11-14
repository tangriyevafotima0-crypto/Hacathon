# SKYFORGE Fire Atlas · 15-noyabr demo

Oldingi qabul jadvali 23/27 bandni tasdiqlagan. Quyidagi ingestion ishlari yangi ko‘lam hisoblanadi.

## Besh tadqiqot

| Tadqiqot | PSI ID · versiya · DOI | NASA katalog hajmi, bayt | Demo manbalari |
| --- | --- | ---: | --- |
| SAFFIRE-I | PSI-98 · v4 · 10.60555/0t15-1z43 | 12 250 600 201 | Metadata va sinov jadvali |
| SPICE | PSI-107 · v4 · 10.60555/9kbh-e962 | 6 946 864 573 | Metadata va sinov jadvali |
| SAME | PSI-102 · v4 · 10.60555/gd4k-8h62 | 657 608 178 | Metadata va sinov jadvali |
| DAFT / DAFT-2 | PSI-47 · v5 · 10.60555/ztgj-d202 | 41 765 333 | Metadata, sinov jadvali va ISS rasmi |
| Cool Flame Dynamics CFD | PSI-117 · v2 · 10.60555/gz0q-b577 | 70 820 870 | NASA metadata va metodika. Ground CFD. |
| Jami | 5 tadqiqot | 19 967 659 155 | Demo uchun tanlangan fayllar |

Atlas’dagi BASS-II T20/T21/T25 oldingi ko‘rsatish oqimida mavjud. Ingestion orqali tasdiqlangan Atlas CSV/JSON qatorlari ham qidiruvga qo‘shiladi.

## Server va qayta ishga tushirish

Serverdagi manbalar `G:\SKYFORGE-NASA\pitch-five` ichida. `plan.json` hajm va tanlovni ko‘rsatadi. Tadqiqot papkalaridagi `manifest.json` tekshirilgan fayllar holati va mahalliy SHA-256 qiymatlarini saqlaydi. Serverdagi `ingestion.sqlite` navbat, dalillar va vektorlarni saqlaydi. Qidiruv filtrlangan yozuvlar ustida aniq kosinus hisoblaydi.

Node 24+ bilan repo papkasida:

```powershell
npm.cmd ci
npm.cmd install --prefix G:\SKYFORGE-NASA\ingestion-runtime --save-exact @huggingface/transformers@3.8.1
$env:SKYFORGE_DATA_ROOT='G:/SKYFORGE-NASA'
$env:SKYFORGE_INGESTION_RUNTIME='G:/SKYFORGE-NASA/ingestion-runtime'
node --input-type=module -e "import {preparePitch} from './server/nasa-pitch.js'; await preparePitch('G:/SKYFORGE-NASA/pitch-five')"
npm.cmd run build
npm.cmd run preview -- --host 100.105.241.126 --port 4191 --strictPort
```

Windows serverida mavjud demo Task Scheduler’da `SKYFORGE-Fire-Atlas-Pitch` nomi bilan ishga tushiriladi. Uning ishchi papkasi `G:\SKYFORGE-NASA\fire-atlas-pitch`. Ingestion ishga tushishi uchun Node servisi ishlab turadi. Birinchi yuklashda model keshga yoziladi. Yangi manbalar yuklanganda xizmatni qayta ishga tushiring. Tayyor, o‘zgarmagan qatorlar qayta embedding qilinmaydi.

Model `Xenova/multilingual-e5-small`, revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, q8 CPU ONNX, 384 o‘lcham. Asosiy model MIT litsenziyasida. CSV har bir ma’lumot qatori bo‘yicha, metadata esa maydon va matn bo‘lagi bo‘yicha ajratiladi. [Asosiy model](https://huggingface.co/intfloat/multilingual-e5-small) · [ONNX modeli](https://huggingface.co/Xenova/multilingual-e5-small)

## Demo tekshiruvi

1. Serverdagi Atlas sahifasini oching. **NASA dalillari va vektor qidiruvi** bo‘limida beshta tadqiqot va ularning indeks holatini ko‘ring.
2. `smoke particle size in microgravity` va `mikrogravitatsiyada tutun zarrachalari o‘lchami` savollarini sinang. Topilgan dalilda NASA havolasini, asl fayl va lokatorni oching. DAFT kartasidagi ISS rasmini ko‘rsating.
3. Oldingi **NASA’dan olish → Preview → Tasdiqlash** oqimi orqali BASS-II sinovlarini import qiling. **Ingestion** navbatini tekshiring. Ish serverga qabul qilingach, brauzer yopilganida ham indekslash davom etadi.
4. Qidiruv va dalillar eksportini, keyin BASS-II taqqoslash va hisobot eksportini tekshiring. T20 oqimi **11 → 3 cm/s** holida chiqadi.
5. Analyzer xizmatni qayta ishga tushirib, tayyor qatorlar sonini va bir xil import natijasidagi job IDni solishtiradi.

Demo ingestori NASA metadata va CSV qatorlarini indekslaydi. PDF/DOCX, OCR, video korpusi va Gemini orqali javob yaratish keyingi ko‘lamda.

## Yakunlash ketma-ketligi

| Tartib | Mas’ul | Yakunlash sharti |
| --- | --- | --- |
| 1 · parallel | D | Beshta tadqiqotdagi demo dalili va NASA lokatorlarini tekshiradi. CFD kartasini model sifatida ko‘rsatadi. |
| 1 · parallel | Bk | Demo qurilmasidan server URL’ini ochadi. Import holati, rasm va eksportni tekshiradi. Jonli Gemini kaliti bo‘lsa, eski en tekshiruvini alohida sinaydi. |
| 1 · parallel | H va BN | Pitch ssenariysi, H01 asl fayllari va tadbir topshirish talablarini tekshiradi. |
| 2 · birgalikda | Analyzer va BN | Importdan keyin server navbati, ikkala tildagi qidiruv, asl manba, restart va fizik qiymatlar eksportini mustaqil tekshiradi. |
| 3 · ketma-ket | BN, H va Bk | Taqdimot qurilmasida to‘liq mashq qiladi va demo manzili hamda commitni qayd etadi. |
