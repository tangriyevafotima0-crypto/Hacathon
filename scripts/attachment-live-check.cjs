const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Clearly synthetic fixture: not NASA evidence. Raster diagram embedded in a real PDF.
 await page.setContent('<div style="background:white;color:black;padding:30px;width:500px;font:24px Arial"><h2>SYNTHETIC TEST DIAGRAM</h2><div style="border:4px solid black;width:200px;height:80px">Sample A</div><p>Width: 2 cm</p></div>');
 const figure=await page.locator('body>div').screenshot();
 await page.setContent('<h1>Synthetic verification document</h1><p>This is a software test fixture, not NASA research. Sample A has width 2 cm. No combustion outcome was measured.</p><img width="400" src="data:image/png;base64,'+figure.toString('base64')+'">');
 const pdf=await page.pdf({format:'A4'});
 await page.goto(process.env.SKYFORGE_TEST_URL||'http://100.105.241.126:4191');await page.locator('.welcome').waitFor();
 await page.waitForFunction(()=>{const e=document.querySelector('.welcome img');return e?.complete&&e.naturalWidth>0;},{},{timeout:15000});
 const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Attach files',exact:true}).click();const chooser=await chooserPromise;
 await chooser.setFiles({name:'synthetic-evidence.pdf',mimeType:'application/pdf',buffer:pdf});
 await page.locator('.attachment-list').getByText('synthetic-evidence.pdf').waitFor();
 await page.locator('.chat-composer textarea').fill('What is Sample A width in the attached document?');
 await page.getByRole('button',{name:'Yuborish',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('.send-button').disabled,{},{timeout:120000});
 const records=await page.evaluate(async()=>await (await fetch('/api/workspace/assets')).json());
 const asset=records.find(a=>a.name==='synthetic-evidence.pdf');assert.ok(asset.extraction.some(p=>p.locator==='PDF page 1'&&p.status==='READY'));
 assert.ok(asset.extraction.some(p=>p.status==='AI_INTERPRETED'),JSON.stringify(asset));
 await page.getByRole('button',{name:'Yuborish',exact:true}).click();
 await page.locator('.answer-heading').waitFor({timeout:40000});await page.locator('.pending-turn').waitFor({state:'hidden'});
 assert.match(await page.locator('.assistant-message').innerText(),/2/);
 await page.locator('.assistant-message').getByRole('button',{name:/Library ·/}).click();
 await page.locator('#evidence-reader mark').waitFor();assert.match(await page.locator('#evidence-reader mark').innerText(),/Sample A/i);
 assert.match(await page.locator('#evidence-reader a').getAttribute('href'),/assets\/.*original#page=1/);
 await page.screenshot({path:'../../outputs/SKYFORGE-evidence-highlight.png',fullPage:true});
 const forbidden=await browser.newContext();const denied=await forbidden.request.get((process.env.SKYFORGE_TEST_URL||'http://100.105.241.126:4191')+'/api/workspace/assets/'+asset.id+'/excerpt?locator=PDF%20page%201');assert.ok([401,404].includes(denied.status()));await forbidden.close();
 await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Hybrid AI'}).click();
 await page.getByRole('button',{name:'New Chat',exact:true}).click();await page.locator('.welcome').waitFor();assert.equal(await page.locator('.attachment-list').count(),0);
 await page.getByRole('button',{name:'Day mode'}).click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 const report={time:new Date().toISOString(),synthetic:true,pdfText:'PASS',pdfEmbeddedImage:'PASS',attachButton:'PASS',scopedAnswer:'PASS',yellowExcerpt:'PASS',pageLink:'PASS',ownerIsolation:'PASS',newChatClearsAttachments:'PASS',mobile:'PASS',errors,extraction:asset.extraction};
 fs.writeFileSync('docs/skyforge-build/attachment-live-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

