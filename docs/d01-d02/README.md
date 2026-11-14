# D01 / D02 — Z01 bilan yakunlangan ilmiy paket
Versiya: SKYFORGE-D01-D02-v0.2.0. Sana: 2026-11-14.
Repo: https://github.com/tangriyevafotima0-crypto/Hacathon
Baseline: 04df76287b92d5b78443125753052cbdd31570b3.
D commit: topshirilgan checkoutda git rev-parse HEAD; final javobda aniq ID beriladi.

## Natija va chegarasi
Z01 core/test fayllari yuklangan Hacathon-main.zip bilan byte-for-byte bir xil ekanligi tekshirildi.
D01/D02 shu real corega ulanib ishlaydi. src/atlas/core hamda mavjud UI/model o'zgartirilmagan.
src/atlas/data — D authoritative data + source/evidence helpers.
tests/atlas/data.test.js — 21 yangi D ilmiy va integratsiya testi.
Mavjud23test bilan jami44test. npm ci, npm test, npm run build muvaffaqiyatli.
Bu production build mavjud React interfeysining buildi; D moduli UIga ulandi degani emas.
D modulining browser bundle tekshiruvi alohida. Browser UI va mustaqil Analyzer qabulini
shu rol o'z nomidan tasdiqlamaydi.

## Ishga tushirish / Analyzer takrorlashi
Node22.12+ (tekshiruvda Node24.19.0).
~~~sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
node scripts/d01-d02-demo.mjs
npm run build
node scripts/d01-d02-integrity.mjs
~~~
Demo soati fixed test clock; haqiqiy tajriba vaqti emas.
Demo: COMMIT changes2→1→0; generation1→2→2; disk reload3trial.
T20/T21 history NOT_PROVIDED; T25 REUSED va flag saqlanadi.
Core scientific_verification NOT_VERIFIED, D source check alohida.
D tomonidan bir xil qiymatga yangi document/excerpt qo'shilsa, Z01 yangi revision qiladi;
eski revisionning manba zanjiri saqlanadi.
Buyruqlar, exit code, stdout/stderr: evidence/commands.json va *.log.

## D01: NASA Table7.1
Asl hisobot: https://ntrs.nasa.gov/citations/20210011385.
Table7.1 PDF104/bosma96; §7.1.3 PDF102/bosma94; §7.1.4 PDF103/bosma95.
Visual tekshirildi: evidence/table-7-1.png.

| Trial | Width raw/SI | Flow raw/SI | O2 raw/SI | Outcome | History |
|---|---|---|---|---|---|
|GMT190-T20|1.2cm /0.012m|11→3cm/s /0.11→0.03m/s|17.2vol% /0.172mol/mol|Quenched|NOT_PROVIDED|
|GMT190-T21|1.2cm /0.012m|11→47cm/s /0.11→0.47m/s|17.2vol% /0.172mol/mol|Blow-off|NOT_PROVIDED|
|GMT216-T25|2.2cm /0.022m|5→2.5cm/s /0.05→0.025m/s|20.8vol% /0.208mol/mol|Reused, ignited|REUSED|

Uchalasida concurrent spatial flow. Core parameter.direction esa temporal decrease/increase.
O2 location chamber_atmosphere: MSG ichidagi kichik duct ambient sharoiti, lokal alanga emas.
Width location sample_surface; flow location chamber_atmosphere — contract interpretation,
§7.1.3 setup bilan asoslangan, yangi lokal o'lchov emas.
Z faqat3parametrni normallashtiradi. Tarkib75%paxta/25%fiberglass, taxminan0.32mm
thickness,10cm exposed length va1atm pressure SERIES_CONTEXT sifatida field-provenance.jsonda.
Ular Table7.1 row measurement sifatida ko'rsatilmaydi.

NEW bevosita manbada yo'q: T20/T21 Table7.1 hamda AppendixB PDF120/bosma112
(sample144m/145m)da explicit NEW topilmadi. Reused tag yo'qligi NEWga tenglashtirilmadi.
T25 Table7.1da REUSED; AppendixB PDF121/bosma113 sample138m.
Ignited — keyinchalik quenched yoki to'liq burnout degani emas.

T25 Z original CSV fizik qiymatlari to'g'ri edi. Asl core fixture o'zgarmadi.
D CSV qo'shimcha study_id/document_id/excerpt/claim_type va aniq birlik/location bilan boyitildi.
Mavjud revisionni yashirin almashtirish yo'q.

Rasmiy PSI-25 Experimental table CSV:129data row, header bilan130CSV record.
Join:GMT+Test #. T20 CSV120, T21 CSV121, T25 CSV125 (header1).
T25 material raw label2cmSIBAL — Table7.1 aniq width2.2cm bilan farqi saqlangan.
Air display5/2.5 — oqim; Fan display53/45 — asbob display, oqim emas.
Initial/final O2:20.8/20.7 alohida; Table7.1 nominal20.8ni final20.7 bilan almashtirmaymiz.
InitialCO=-1ppm manbadagi raw sifatida quality flag bilan saqlanadi.
75frames vaqt emas. Bu gaz readingsdan risk yoki lokal emissiya tezligi chiqarilmadi.

## Z shartnomasi bo'yicha yetkazilgan fayllar
- src/atlas/data/bass-ii-seed.json — Z v1 T20/T21.
- src/atlas/data/GMT216-T25.csv — manba bilan boyitilgan, Z parser o'qiydigan import.
- src/atlas/data/bass-three.json — bir batchli alternativ exchange.
- src/atlas/data/field-provenance.json — raw/SI, scoped source locator, tarixi va CSV dalili.
- src/atlas/data/index.js — sourceReview, fieldProof, exact gap status va corpus query.
- docs/d01-d02/contract-mapping.json — oldingi nomzod maydon/statuslardan Z v1ga xarita.

sourceReview aynan shu fizik qiymat va source chainni tekshiradi.
Raqam, history, outcome yoki locator o'zgarsa fieldProof tekshirilgan sidecarni bermaydi.
D_SOURCE_CHECKED — shu yozuv/manba tekshiruvi; import confirmation yoki mustaqil ilmiy
approval emas. Z core review flaglari o'zgarishsiz qoladi.

## D02: tasdiqlangan manbalar va provenance
13source entry: source-table.csv; mashina shakli src/atlas/data/source-registry.json.

|ID|DOI|Versiya|Claim type / roli|
|---|---|---|---|
|PSI-25|10.60555/4qc4-de67|4|OBSERVATION;3kuratlangan BASS-II row|
|PSI-98|10.60555/0t15-1z43|4|OBSERVATION;SAFFIRE-I|
|PSI-99|10.60555/2chp-m469|5|OBSERVATION;SAFFIRE-II|
|PSI-69|10.60555/mbq8-0451|5|OBSERVATION;FLEX liquid droplets|
|PSI-101|10.60555/2np7-jv14|4|OBSERVATION;SAME-R smoke|
|PSI-159|10.60555/cyt1-kh64|1|OBSERVATION;CFI-G gas flames|
|PSI-117|10.60555/gz0q-b577|2|MODEL_RESULT;Ground Investigation/OpenFOAM|
|E-FIELD|rasmiy NASA URL|—|OBJECTIVE;electric-field/gas-flame mechanism|
|BRE|rasmiy NASA URL vaNTRS20160010073|—|OBJECTIVE;gaseous porous-burner emulator|
|LUCI|NTRS20250010653|—|OBSERVATION;simulated lunar-g analog|
|FM2|NTRS20260001966|—|OBJECTIVE;planned lunar-surface tests|

Qo'shimcha2entry: BASS-II technical memorandum va2026lunar-g precursor observation.
API metadata extracts saqlangan; full response hash, DOI,versiya,JSONpointer/provenance bor.
Raw NASA CSVlar src/atlas/data/sourcesda byte-for-byte saqlangan.
E-FIELD/BRE gaz-flame yoki emulyator dalili; to'g'ridan-to'g'ri mato sinovi emas.
NTRS20160010073 BREga tegishli, E-FIELDga emas.
SAME-R metadata/diagramdan validated alarm classifier yoki universal particle size yasalmadi.
PSI-117 mustaqil flight dataset emas; FLEX kuzatuvlariga tayangan ground CFD study.

LUCI:2025NewShepardda simulated lunar-g, normal-pressure air, ikki sample,2.5minutdan ortiq.
Bu Oy yuzasi tajribasi emas, ammo LUCI “hali faqat kutilmoqda” ham emas.
2026NTRS PDF21/bosma20: aircraft simulated0.165g,5cmSIBAL,21%O2,1atm,
20sdownward spread kuzatuvi mavjud. Bu actual lunar-surface yoki Mars atmosphere dalili emas.

FM2 manbalari versiyaga bog'landi.2024CLPS/CP21/SIBAL+PMMA konsepti bilan
2026SpaceX/fabric konsepti bitta yakunlangan testga aralashtirilmadi.
2026current concept PDF5-6; requirements PDF10/bosma9:
8.2psia va37/33/29/25%O2, fabricSynergyProNavy.
Bular OBJECTIVE/requirements; measured30%+O2korpusiga qo'shilmadi.
Ko'rilgan korpusda completed lunar-surface result yo'q; butun NASA arxivi bo'yicha
universal yo'qlik da'vosi qilinmaydi. Mars uchun bevosita matching surface evidence ham shu
connected korpusda yo'q; related lunar/ISS dalillari alohida ko'rsatiladi.

## Oy/Mars uchun aynan4status
Master prompt paragraph46dagi nomlar o'zgarishsiz:
1.Direct matching evidence
2.Related evidence with different conditions
3.No matching evidence in connected corpus
4.Insufficient metadata

Har planet uchun4fixture=8fixture. Actual connected Moon/Mars surface so'rovi “Related...”.
Direct branch uchun NASAga nisbatlanmagan TEST-ONLY sintetik inputlar ishlatilgan:
ular production connected corpusga kirmaydi va alohida opt-in bo'lmasa hisobga olinmaydi.
Shu tariqa branch tekshiruvi mavjud, lekin uydirma Oy/Mars NASA tajribasi yaratilmagan.
Planned-only corpus “No matching...” beradi; kerakli metadata yo'q bo'lsa “Insufficient...”.
Claim verdictlari SUPPORTED/CONTRADICTED esa boshqa API; gap statusi bilan aralashtirilmaydi.
Oldingi0.1paketdagi vaqtinchalik gap taxonomiyasi shu exact4statusga almashtirildi.

## 30%+O2 query: natija korpusga va o'lchov joyiga bog'liq
|Corpus/location|Natija|
|---|---|
|BASS_THREE/chamber_atmosphere|0/3|
|CFIG_NORMAL/chamber_atmosphere|115/179;max39.97%|
|CFIG_INVERSE/burner_flow|115/154;max85%|
|CFIG_INVERSE/chamber_atmosphere|Insufficient metadata;count=null|

Inverse CSVdagi1015parsed rowdan861tasi bo'sh;154nomlangan numeric record bor.
Core parseCSV bo'sh CSVrecordlarni tashlab ketadi; raw file o'zgarmagan.
Normal raw column “ XO2 before test”, inverse “XO2”; “O2 flow rate(mg/s)” konsentratsiya emas.
CFI-G report PDF3,22 inverse kamerasi fuel+N2, burner oqimiO2+N2 ekanini asoslaydi.
Direct query result faqat shu concentration/location filteriga moslik:
SIBAL yoki Oy/Mars xavfsizligi tasdig'i emas.

## AI va bajarilgan ish dalili
checkBoundedClaim — faqat aniq claim_keylar uchun deterministik guard.
T20/T21 O2harxil → CONTRADICTED; NEW yoki arbitrary risk percentage → INSUFFICIENT_EVIDENCE.
Live API NOT_IMPLEMENTED_NOT_TESTED; erkin tabiiy tilni tushunish yoki ishonchlilik foizi
sinovdan o'tdi deyilmaydi. Shu D ishlari uchun maxfiy kalit kerak emas.
Barcha xulosalar source row yoki source-registryga bog'langan.
Z02 erkin qidiruv/ranking va Bk UI boshqa rol scopeida qoladi.

## Yakuniy holat
D01 source/data/Z-import va D02 source registry/gap/query fixtures tayyor va testlangan.
23original+21Dtest=44pass. Seed2+T25import1+repeat0, reload3.
Dependency install va Vitebuild bu muhitda o'tdi; oldingi Z loglar tarixiy.
Z core, oldingi tests/atlas/import.test.js, App/model, package.json/lock o'zgarmadi.

Analyzer mustaqil qabul/PM approval, browser UI hookup va jonli AI bu deliveryda bajarilgan
deb ko'rsatilmaydi. Manba jadvali Analyzer handoff papkasida.
Tashqi qabul qiluvchi kanal berilmagani uchun shaxsiy xabar yuborilmadi.
Repo push amalga oshirilmagan; o'zgarishlar lokal commit va yuklab olinadigan patch bilan topshiriladi.
