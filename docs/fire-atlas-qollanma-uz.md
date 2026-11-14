# SKYFORGE Fire Atlas · Ishga tushirish va taqdimot

## 1. GitHub’dagi versiyani ishga tushiring

Windows’da PowerShell oching. Node.js kamida 22.12 bo‘lishi kerak. Repo papkasi mavjud bo‘lsa, unga kiring va `main`ni yangilang. Birinchi marta olayotgan bo‘lsangiz, `git clone https://github.com/tangrbiyevafotima0-crypto/Hacathon.git` bajaring.

```powershell
cd Hacathon
git status --short
git switch main
git pull --ff-only
git rev-parse --short HEAD
node --version
npm ci
npm test
node scripts/d01-d02-integrity.mjs
npm run build
npm run preview -- --port 4190 --strictPort
```

`git status --short` chiqishida o‘zgarishlaringiz bo‘lsa, tarmoqni almashtirishdan oldin ularni jamoa tarmog‘ida saqlang. Checksum yangi checkoutdagi fayllarning asl baytlarini tekshiradi. Eski checkoutda CRLF sababli `HASH_MISMATCH` chiqsa, yangi papkaga klon qilib takrorlang. Terminalni ochiq qoldiring va Chrome’da [lokal Atlas](http://127.0.0.1:4190/) sahifasini oching.

## 2. NASA ma’lumotini ulang va tekshiring

1. **Import / diff / confirm → NASA’dan olish** tugmasini bosing. Server PSI-25 BASS-II jadvalini NASA’dan oladi, dastur uchta sinovni ajratadi.
2. `GMT190-T20`, `GMT190-T21`, `GMT216-T25` qatorlarini ochib kiruvchi qiymatlarni ko‘ring. Bayroqlar katagiga belgi qo‘yib **Tasdiqlash va saqlash**ni bosing.
3. **Kutubxona → PSI-25 · BASS-II** bo‘limida T20 va T21 ni tanlang. En **1.2 cm**, kislorod **17.2 vol%**. Oqim T20 da **11 → 3 cm/s**, T21 da **11 → 47 cm/s**. Natijalari mos ravishda **Quenched** va **Blow-off**.
4. En qiymatini bosing. Ochilgan dalilda **NASA/TM-20210011385 · Table 7.1 · PDF 104 / bosma 96** va sinov qatorini ko‘rsating. T25 uchun **2.2 cm**, **20.8 vol%**, **5 → 2.5 cm/s** hamda namuna qayta ishlatilganini tekshiring.
5. Sahifani yangilang. Uch sinov saqlanib turishi kerak. **Focus Corner / Notebook** orqali izohni saqlang va **Qayta ochish** bilan tekshiring.

### Fayllarni qayerga qo‘yish kerak

| Ish | Joyi va amali |
| --- | --- |
| NASA’ga onlayn ulanish | **NASA’dan olish** tugmasini bosing. Server jadvalni o‘zi oladi. |
| Mahalliy yoki oldindan tayyorlangan demo | **Seed preview** bilan T20/T21 ni, so‘ng **T25 demo preview** bilan T25 ni import qilib tasdiqlang. Xuddi shu oqimda Atlas formatidagi CSV yoki JSON faylni yuklab, **Preview**ni bosing. |
| Jamoa boshqaradigan yangi manba | D kichik xom faylni `src/atlas/data/sources/` ostiga qo‘shadi, `src/atlas/data/source-registry.json`da manba URL’i, versiyasi va identifikatorini qayd etadi. Z manba ustunlarini Atlas formatiga moslaydi. Bk importni, D esa qiymat va dalil bog‘lanishini tekshiradi. |
| Boshqa qurilmaga ko‘chirish | **Exchange JSON** faol qatorlarni qayta import qilishga tayyor fayl beradi. **Archive** barcha tahrirlar tarixini eksport qiladi. **CSV/JSON** tugmalari taqdimot uchun hisobot beradi. |

Brauzer importi bitta faylda 10 000 qator va taxminan 5 MB bilan cheklangan, saqlash hajmi esa brauzerga bog‘liq. Import va daftar ma’lumotlari joriy brauzer profili hamda shu URL/portga tegishli. Demo uchun ishlatadigan qurilmada importni qayta tekshiring.

Taqdimotda **24 tadqiqotlik NASA katalogi, PSI-25 jadvaliga jonli ulanish va dalili bilan tekshirilgan 3 sinov**ni ko‘rsating. Bu ko‘lam uchun 12 TB yuklab olish talab qilinmaydi. Keyingi manba uchun PSI-159 dan kerakli fayl va aniq savolni tanlang. Bitta moslangan namunani import qilib, uning birliklari, muhit turi va manbasini tekshirgandan keyin ko‘lamni kengaytiring. [NASA PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25) · [NASA PSI-159](https://psi.nasa.gov/physci/repo/data/investigations/PSI-159)

## 3. Gemini API’ni ulang

1. Google AI Studio’da loyiha uchun kalit yarating. Bk jamoaning hisobida modelga ruxsat va billing holatini tekshiradi. [Google AI Studio API kaliti](https://aistudio.google.com/docs/api-key)
2. Repo papkasida quyidagilarni bajaring. Ochilgan faylda `GEMINI_API_KEY=` dan keyin kalitni yozing va saqlang.

   ```powershell
   if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
   notepad .env.local
   git check-ignore .env.local
   ```

3. Oldingi preview terminalida **Ctrl+C** bosing. `npm run preview -- --port 4190 --strictPort` bilan qayta ishga tushiring. Kalit serverda ishlatiladi. Uni GitHub, guruh chati yoki skrinshotga chiqarmang.
4. Saqlangan T25 ni tanlab **Enni API orqali tekshirish**ni bosing. 2.2 cm uchun `CONFIRMED` kutiladi. API uchta BASS-II sinovining namuna enini NASA jadvali bilan solishtiradi.
5. Jonli sinovda uchta javob turini va xarajatni hisoblash uchun kerak bo‘ladigan tokenlarni tekshiring. Quyidagi so‘rovlar brauzer ma’lumotini o‘zgartirmaydi.

   ```powershell
   $checks = @(
     @{ value = '2,2'; language = 'uz'; withhold_width = $false; expected = 'CONFIRMED' },
     @{ value = 3.3; language = 'en'; withhold_width = $false; expected = 'PROPOSED_CORRECTION' },
     @{ value = 3.3; language = 'uz'; withhold_width = $true; expected = 'INSUFFICIENT_EVIDENCE' }
   )
   foreach ($check in $checks) {
     $body = @{
       study_id = 'PSI-25'
       trial_id = 'GMT216-T25'
       field = 'sample_width_cm'
       source_ref_id = 'PSI-25:GMT216-T25:source'
       value = $check.value
       language = $check.language
       withhold_width = $check.withhold_width
     } | ConvertTo-Json
     $result = Invoke-RestMethod -Uri 'http://127.0.0.1:4190/api/re-evaluate' -Method Post -ContentType 'application/json' -Body $body
     if ($result.status -ne $check.expected) { throw "Unexpected status: $($result.status)" }
     $result | Select-Object status,model,duration_ms,usage,rationale,proposed_raw_patch | ConvertTo-Json -Depth 4
   }
   ```

   `withhold_width` dalil yetishmaydigan holatni sinash uchun yuboriladi. Jonli natija va tokenlarni Analyzer’ga bering. `API_UNAVAILABLE` chiqsa, fayl nomi, kalit nomi va server qayta ishga tushganini tekshiring. `API_QUOTA` chiqsa, Google loyihasining quota va billing holatini tekshiring. `API_PROVIDER_FAILED` chiqsa, kalitning loyihaga tegishliligi va modelga ruxsatni tekshiring.

6. Tuzatishning saqlanishini alohida brauzer profilida tekshiring. **Exchange JSON** eksportida T25 enini vaqtincha `3.3` ga almashtirib import qiling. API `3.3 → 2.2` taklifini chiqarishi kerak. Avval **Rad etish**ni bosib 3.3 saqlanganini tekshiring. Yana so‘rov yuboring va **Tuzatishni tasdiqlash**ni bosing. **Archive**da 3.3 yozuvi tarixda qolishi va faol qiymat 2.2 bo‘lishi kerak.

## 4. Jamoaning keyingi qadamlari

| Tartib | Kim | Yakunlash dalili |
| --- | --- | --- |
| 1 · Parallel | Bk | Kalitni ulaydi, uch jonli API javobi, tokenlar va vaqtni saqlaydi. |
| 1 · Parallel | H va BN | Tadbir ro‘yxati, mahalliy muddat, topshirish formati hamda H01 asl fayl va manifestini tasdiqlaydi. |
| 1 · Parallel | D va Z | Demo dalillarini tekshiradi. Qo‘shimcha manba so‘ralsa, avval kerakli fayl va Atlas ustunlarini kelishadi. |
| 2 · Bk tekshiruvidan keyin | Analyzer | Yangi checkoutda import, takroriy import, eksport, qayta yuklash va jonli API ssenariylarini takrorlaydi. Xatoni commit SHA va qayta bajarish qadamlari bilan qayd etadi. |
| 3 · Analyzer tekshiruvidan keyin | BN va Bk | Demo qurilmasida yakuniy mashq qiladi. Onlayn demo manzili kerak bo‘lsa, shu commitdagi UI va API’ni bir xil origin’da joylashtirib tekshiradi. |

Demo ketma-ketligi: **NASA’dan olish → uch qatorni tasdiqlash → T20/T21 taqqoslash → manba havolasini ochish → T25 ni topish → API yoki dalil qamrovini ko‘rsatish → hisobot eksporti**. T20/T21 ikki kuzatuvni ifodalaydi. Ular asosida umumiy ventilyatsiya chegarasi yoki Oy/Mars xavf foizi chiqarilmaydi.
