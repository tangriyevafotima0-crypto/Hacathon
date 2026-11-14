# Ilmiy va qamrov auditi — D01/D02
Original DOCXlar o'zgartirilmadi. Locatorlar document.xml paragraph tartibi bo'yicha1-based.
Referenslarda kelgan, lekin ushbu repoda yo'q eski HTML/master fayllarni ko'rdim deb da'vo qilinmaydi.

|ID|Fayl/locator|Da'vo yoki xatar|Dalil / tuzatish|Holat|
|---|---|---|---|---|
|D-F01|SKYFORGE_1_Odam_Tili_Toliq_Plan_Sabab_Natija_Oqibat_Dalil.docx ¶113|LUCI/FM2 birga “kutilmoqda”, partial-g tajribasi umuman yo'qdek bayon|LUCI flown Feb4,2025; NTRS20250010653; NTRS20260001966 PDF21 aircraft0.165g observation|LUCI qismi eskirgan; simulated partial-g mavjud, lunar-surface result bilan aralashmasin|
|D-F02|shu DOCX ¶44|offline100%,0mskechikish|Testlar ma'lum kod yo'lini tekshiradi;0ms yoki hosted offline app-shell evidence yo'q|UNSUPPORTED PERFORMANCE GUARANTEE|
|D-F03|SKYFORGE_2_AI_Professional_Master_Prompt_Harakatma_Harakat.docx ¶11|confidence<0.85 ilmiy verification threshold|Kalibratsiya manbasi yo'q; src/atlas/core/import.js reviewRecord explicit reasons ishlatadi|Threshold qabul qilinmadi; score chiqarilmadi|
|D-F04|SKYFORGE_Fire_Atlas_Audit_va_BASS2_Hisoboti.docx ¶40|NASA thickness0.3175mm deb juda aniq berilgan|NASA/TM20210011385 PDF102/bosma94 “about0.32mm”|UNJUSTIFIED PRECISION; sidecar about0.32mm|
|D-F05|shu audit ¶48|PSI25da130qator “sinov” sifatida talqin qilinishi mumkin|Raw CSV129data row+1header; src/atlas/data/sources/PSI-25-table-0.csv|COUNTING SCOPE CLARIFIED|
|D-F06|shu audit ¶44|NTRS manbasi butun PSI partial-g mavjud emasligini isbotlaydigandek|NTRS20260001966 manbasi individual ilmiy ish, exhaustive PSI inventory emas|GLOBAL ABSENCE NOT ESTABLISHED|
|D-F07|birinchi DOCX ¶25,¶120,ikkinchi DOCX ¶28|100%UI/API journey ishlaydi degan talabni statusga aylantirish xatari|src/App.jsx:3model.jsimport; :58disclaimer; :66RULE-BASED DEMO; Atlas UI baselinega ulanmagan|NOT IMPLEMENTED IN BASELINE; Dcore demosi UI approval emas|
|D-F08|src/model.js:1,15-20|invented weights/riskindexni haqiqiy ilmiy probability sifatida ishlatish xatari|Faylning o'zi invented educational deb belgilaydi; NASA Table7.1 uncalibrated formula bermaydi|Existing toy unchanged; Ddata/APIga ulanmadi|
|D-F09|docs/z01/HANDOFF.md:Observed checks|oldingi buildFAILni hozirgi status deb takrorlash|D rerun npmci/test/build exit0, evidence logs|HISTORICAL STATUS SUPERSEDED; original log saqlandi|
|D-F10|oldingi SKYFORGE_D01_D02_v0.1.0 fixtures/planet-verdicts.json|claim-verdict enum gapstatus o'rnida provisional ishlatilgan|Endi master prompt ¶46 exact4label,8fixture|CORRECTED IN v0.2.0|
|D-F11|FM2 eski2024CP21poster vs2026NTRS PDF5-10|turli conceptversiyalaridan bitta “measured burn” yozuvi yasash|2026requirements37/33/29/25%O2 at8.2psia; planned|VERSIONED OBJECTIVES; actual outcome emas|

T20/T21 Z seed allaqachon NOT_PROVIDED edi; Z fixtureda NEW xatosi bor deb aytilmaydi.
T25 Z originalCSV sonlari ham to'g'ri. Dning o'zgarishi — tasdiqlangan excerpt/document/location
va context dalilini qo'shish; asl Z fixture byte-for-byte saqlangan.
Source tabledagi E-FIELD/BRE attribution rasmiy mission sahifalari bilan tekshirildi:
NTRS20160010073 title aynan “A Burning Rate Emulator(BRE) for Study in Microgravity”.

## Texnik chegaralar
Z fieldEvidence saqlangan revisionning source chainini beradi; series-level O2 location,
spatial concurrent flow, tarkib/pressure/thickness dalili D fieldProof sidecarida.
Dsidecar Zcore persisted recordiga yangi normallashtirilmagan “measurement” kiritmaydi.
SourceReview user-modified physics/provenancega D_SOURCE_CHECKED bermaydi.
