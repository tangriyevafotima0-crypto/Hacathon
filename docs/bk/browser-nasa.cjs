const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
try{
 const page=await browser.newPage();
 const failures=[];
 page.on('pageerror',error=>failures.push(error.message));
 await page.goto(process.env.ATLAS_BASE_URL || 'http://127.0.0.1:4173');
 await page.getByRole('button',{name:'NASA’dan olish'}).click();
 await page.getByText('GMT216-T25: INSERT',{exact:true}).waitFor();
 await page.getByRole('checkbox',{name:/Bayroqlarni/}).check();
 await page.getByRole('button',{name:'Tasdiqlash va saqlash'}).click();
 await page.reload();
 await page.getByRole('textbox',{name:/Tajriba savoli/}).fill('GMT216-T25');
 await page.getByText('PSI-25 · BASS-II (1)',{exact:true}).click();
 await page.getByRole('checkbox',{name:/GMT216-T25/}).check();
 await page.getByRole('button',{name:'Enni API orqali tekshirish'}).click();
 await page.getByText('API_UNAVAILABLE',{exact:true}).waitFor();
 assert.deepEqual(failures,[]);
 console.log('PASS live NASA import, persisted query and API-unavailable fallback');
}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
