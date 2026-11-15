import React,{useEffect,useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import Atlas,{download} from './Atlas.jsx';
import {BASS_THREE} from '../data/index.js';
import {Menu,Plus,LibraryBig,MessageSquare,Settings,Sun,Moon,ArrowUp,Search,Copy,Pencil,Sparkles,SlidersHorizontal,BookOpen,MoreHorizontal,Pin,Share2,Archive,Trash2,Link,Brain,Square} from 'lucide-react';
import './workspace.css';
import ToolApps from './ToolApps.jsx';
import PDFViewer from './PDFViewer.jsx';
import PDFPages from './PDFPages.jsx';
import ServerPDFLibrary from './ServerPDFLibrary.jsx';
import {ui} from './i18n.js';

async function api(path,method='GET',data,onProgress){
  const response=await fetch('/api/workspace/'+path,{method,headers:{'Content-Type':'application/json',
    ...(onProgress?{Accept:'text/event-stream'}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  if(response.headers.get('content-type')?.includes('text/event-stream')){
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let buffer='',result;
    while(true){
      const {value,done}=await reader.read();
      buffer+=decoder.decode(value,{stream:!done});
      let end;
      while((end=buffer.indexOf('\n\n'))>=0){
        const block=buffer.slice(0,end);buffer=buffer.slice(end+2);
        const name=block.match(/^event: (.+)$/m)?.[1],data=block.match(/^data: (.+)$/m)?.[1];
        if(data){
          const parsed=JSON.parse(data);
          onProgress(name,parsed);
          if(['response.validated','run.cancelled','run.failed','run.state'].includes(name))result=parsed;
        }
      }
      if(done)break;
    }
    if(!result)throw Error('STREAM_INTERRUPTED');
    if(result.http_status>=400)throw Error(result.error?.code??'WORKSPACE_ERROR');
    return result;
  }
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('WORKSPACE_UNAVAILABLE');
  const value=await response.json();
  if(!response.ok)throw Error(value.error?.code??'WORKSPACE_ERROR');
  return value;
}

function readableError(error,language){
  const code=error?.message||'';
  const messages={
ASSET_SIZE_LIMIT_8MB:["Fayl 8 MB dan oshmasligi kerak.", "File must not exceed 8 MB."],
STALE_VERSION:["Bu ma’lumot boshqa joyda yangilangan. Qayta ochib urinib ko‘ring.", "This record changed elsewhere. Reopen it and try again."],
SESSION_REQUIRED:["Sessiya tugagan. Sahifani yangilang.", "Your session expired. Reload the page."],
NOT_FOUND:["Ma’lumot topilmadi yoki o‘chirilgan.", "The record was not found or was removed."],
EXTRACTION_FAILED:["Fayldan matn ajratib bo‘lmadi. Formatni tekshiring.", "Text extraction failed. Check the file format."],
FILE_READ_FAILED:["Faylni o‘qib bo‘lmadi. Qayta tanlang.", "Could not read the file. Select it again."],
INVALID_SYNTHETIC_INPUT:["Sinovlar soni musbat, hodisalar soni esa 0 dan sinovlar sonigacha bo‘lishi kerak. Prior qiymatlari musbat bo‘lsin.", "Use a positive trial count, an event count between zero and the trial count, and positive prior values."],
INVALID_WEIGHTS:["Vaznlar 0–100 oralig‘ida bo‘lsin; kamida bittasi musbat bo‘lishi kerak.", "Use weights from 0 to 100 with at least one positive weight."],
INVALID_NOTE:["Qayd matnini kiriting (20 000 belgigacha).", "Enter note text (up to 20,000 characters)."],
STREAM_INTERRUPTED:["Ulanish uzildi. Suhbatni qayta oching yoki qayta urinib ko‘ring.", "The connection was interrupted. Reopen the chat or retry."],
OPENROUTER_NOT_CONFIGURED:["AI ulanishi sozlanmagan.", "The AI connection is not configured."],
OPENROUTER_AUTH:["AI xizmatiga ulanish tasdiqlanmadi.", "AI service authentication failed."],
API_PROVIDER_FAILED:["AI xizmati javob bermadi. Keyinroq qayta urinib ko‘ring.", "The AI service failed. Try again later."],
    BUDGET_LIMIT:['Bugungi AI xarajat chegarasi tugadi. Library va mahalliy tahlil ishlashda davom etadi.','The daily AI budget is exhausted. Library and local analysis remain available.'],
    API_DEMO_LIMIT:['AI hozir band. Birozdan so‘ng qayta urinib ko‘ring.','AI is busy. Try again shortly.'],
    ATTACHMENT_NOT_READY:['Fayl tahlili hali tayyor emas. Ingestion holatini tekshiring.','The attachment is not ready. Check its ingestion status.'],
    UPSTREAM_TIMEOUT:['AI javobi vaqtida kelmadi. Savolingiz saqlandi; qayta urinishingiz mumkin.','AI timed out. Your question is retained; you can retry.'],
    OPENROUTER_CREDIT:['AI xizmatida kredit yetarli emas. Library’dan manbalarni ochishingiz mumkin.','The AI service has insufficient credit. Sources remain available in Library.'],
    API_UNSUPPORTED_NUMBER:['Javobdagi son manba bilan tasdiqlanmadi. Manbani Library’da tekshiring yoki savolni aniqlashtiring.','A number in the answer was not supported by the source. Inspect Library or refine the question.'],
    API_INVALID_RESPONSE:['AI javobi tekshiruvdan o‘tmadi. Qayta urinib ko‘ring.','The AI response failed validation. Please retry.'],
    WORKSPACE_UNAVAILABLE:['Serverga ulanib bo‘lmadi. Ulanishni tekshirib sahifani yangilang.','Cannot connect to the server. Check the connection and reload.'],
    SOURCE_WITHDRAWN:['Javob manbasi o‘chirilgan. Yangi manba tanlang.','The source was removed. Select a new source.']
  };
  return messages[code]?.[language==='uz'?0:1]||(/^[A-Z][A-Z0-9_]+$/.test(code)?(language==='uz'?'Amal bajarilmadi. Ma’lumotlarni tekshiring va qayta urinib ko‘ring.':'The action could not be completed. Check your input and try again.'):code);
}

async function copyText(text){
  if(navigator.clipboard){try{await navigator.clipboard.writeText(text);return;}catch{/* Fall back when browser clipboard permission is unavailable. */}}
  const previous=document.activeElement;
  const input=document.createElement('textarea');
  input.value=text;
  input.style.position='fixed';
  input.style.left='-10000px';
  document.body.append(input);
  input.select();
  const copied=document.execCommand('copy');
  input.remove();
  previous?.focus();
  if(!copied)throw Error('COPY_UNAVAILABLE');
}
function requestId(){
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
}

function preference(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
export default function Workspace(){
  const [ready,setReady]=useState(false),[failure,setFailure]=useState(''),[page,setPage]=useState('chat'),[language,setLanguage]=useState(()=>preference('forge-language','uz'));
  const [selected,setSelected]=useState([]),[collapsed,setCollapsed]=useState(()=>matchMedia('(max-width:700px)').matches),[theme,setTheme]=useState(()=>preference('forge-theme','dark'));
  const [evidenceFocus,setEvidenceFocus]=useState(null);
  function inspect(sources,claims=[]){setEvidenceFocus({sources,claims,id:requestId()});setPage('library');requestAnimationFrame(()=>document.getElementById('evidence-reader')?.scrollIntoView({block:'start'}));}
  const [settings,setSettings]=useState(false),[chatAction,setChatAction]=useState(null),[handoff,setHandoff]=useState(null);
  const uz=language==='uz';
  useEffect(()=>{document.documentElement.lang=language;},[language]);
  const sharedId=new URLSearchParams(location.search).get('share');
  useEffect(()=>{void api('session','POST',{}).then(()=>setReady(true)).catch(e=>setFailure(e.message));},[]);
  useEffect(()=>{try{localStorage.setItem('forge-theme',theme);localStorage.setItem('forge-language',language);}catch{}},[theme,language]);
  useEffect(()=>{const media=matchMedia('(max-width:700px)');const changed=()=>{if(media.matches)setCollapsed(true);};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
  useEffect(()=>{if(!settings)return;const previous=document.activeElement;const dialog=document.querySelector('.settings-sheet');dialog?.querySelector('button')?.focus();function key(e){if(e.key==='Escape')setSettings(false);if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button,select,a,input')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}}document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};},[settings]);
  function ask(question){setHandoff({question,id:requestId()});setPage('chat');}
  if(sharedId)return <SharedChat id={sharedId}/>;
  return <div className={'forge-workspace '+(collapsed?'sidebar-collapsed':'')} data-theme={theme}>
    <header className="forge-topbar"><button className="icon-button" aria-label={uz?'Menyuni ochish':'Toggle menu'} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}><Menu size={20}/></button>
      <strong>SKYFORGE <span>Fire Atlas</span></strong>
      <nav aria-label={ui(language,"Workspace")}>{[['chat',ui(language,'Hybrid AI')],['library',ui(language,'Library')]].map(([key,title])=><button key={key} aria-pressed={page===key} onClick={()=>{setEvidenceFocus(null);setPage(key);}}>{title}</button>)}</nav>
      <div className="top-actions"><button className="icon-button" aria-label={ui(language,'Notes')} onClick={()=>setPage('notes')}><BookOpen size={19}/></button>
      <button className="icon-button" aria-label={theme==='dark'?(uz?'Kunduzgi rejim':'Day mode'):(uz?'Tungi rejim':'Night mode')} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}</button>
      <a href="https://psi.nasa.gov/physci/repo" target="_blank" rel="noreferrer" className="nasa-wordmark">NASA ↗</a></div>
    </header>
    <aside className="forge-sidebar" aria-label={ui(language,"Main menu")}><div className="sidebar-brand">F<span>FIRE ATLAS</span></div>
      <button className="sidebar-new" disabled={!ready} onClick={()=>{setPage('chat');setChatAction({id:requestId()});}}><Plus size={18}/> {ui(language,"New Chat")}</button>
      <button className={'sidebar-nav '+(page==='library'?'active':'')} onClick={()=>{setEvidenceFocus(null);setPage('library');}}><LibraryBig size={18}/> {ui(language,"Library")}</button>
      <button className={'sidebar-nav '+(page==='tools'?'active':'')} onClick={()=>setPage('tools')}><SlidersHorizontal size={18}/> {ui(language,"Tools")}</button>
      <div id="forge-history-slot" className="history-slot"/>
      <button className="sidebar-settings" onClick={()=>setSettings(!settings)}><Settings size={18}/>{uz?'Sozlamalar':'Settings'}</button>
    </aside>
    <main className="forge-main">
    {!ready?<section className="forge-pane connection-state"><h2>{failure?(uz?'Ulanishda xato':'Connection error'):'Fire Atlas'}</h2><p>{failure|| (uz?'Ulanmoqda…':'Connecting…')}</p>{failure&&<button onClick={()=>location.reload()}>{uz?'Qayta ulanish':'Reconnect'}</button>}</section>:<>
      {selected.length>0&&<div className="selection-strip">{uz?'Tanlangan sinovlar':'Selected trials'} · {selected.join(', ')}<button onClick={()=>setSelected([])}>{uz?'Tozalash':'Clear'}</button></div>}
      <div hidden={page!=='chat'}><Chat language={language} selected={selected} navigate={setPage} action={chatAction} handoff={handoff} collapsed={collapsed} inspect={inspect} /></div>
      <div hidden={page!=='library'}><Library language={language} selected={selected} setSelected={setSelected} ask={ask} evidenceFocus={evidenceFocus} closeEvidence={()=>setEvidenceFocus(null)} visible={page==='library'}/><details className="forge-pane legacy-atlas"><summary>{uz?'O‘lchovlar, import va Notebook':'Measurements, import and Notebook'}</summary><Atlas language={language} onLanguageChange={setLanguage}/></details></div>
      <div hidden={page!=='notes'}><Notes language={language} visible={page==='notes'}/></div>
      <div hidden={page!=='tools'}><ToolApps language={language} trials={selected} setTrials={setSelected} api={api} readableError={readableError} download={download}/></div>
    </>}
    </main>
    {settings&&<div className="settings-backdrop" onClick={()=>setSettings(false)}><section className="settings-sheet forge-pane" role="dialog" aria-modal="true" aria-label={ui(language,"Settings")} onClick={e=>e.stopPropagation()}>
      <header><h2>{uz?'Sozlamalar':'Settings'}</h2><button onClick={()=>setSettings(false)} aria-label={ui(language,"Close settings")}>×</button></header>
      <label>{uz?'Til':'Language'}<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="uz">O‘zbekcha</option><option value="en">English</option></select></label>
      <label>{uz?'Ko‘rinish':'Appearance'}<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="dark">{uz?'Tungi':'Night'}</option><option value="light">{uz?'Kunduzgi':'Day'}</option></select></label>
      <button onClick={()=>{setPage('library');setSettings(false);}}>{uz?'Kutubxona · Import':'Library · Import'}</button>
      <p>{uz?'Fire Atlas — mustaqil loyiha. NASA ma’lumotlaridan foydalanadi; NASA mahsuloti emas. Javoblarda AI qo‘llanadi, dalillar Library’da tekshiriladi.':'Fire Atlas is an independent project using NASA data, not a NASA product. AI is used for answers; verify evidence in Library.'}</p>
      <p>{uz?'Xotirani chat ichidagi boshqaruvdan ko‘rish va o‘chirish mumkin.':'Memory can be reviewed and removed inside each chat.'}</p>
    </section></div>}
  </div>;
}

function SharedChat({id}){
 const [language,setLanguage]=useState(()=>preference('forge-language','uz'));const uz=language==='uz';
 const [chat,setChat]=useState(null),[error,setError]=useState('');
 useEffect(()=>{api('shared/'+encodeURIComponent(id)).then(setChat).catch(()=>setError(uz?'Havola topilmadi yoki ulashish to‘xtatilgan.':'Link not found or sharing has stopped.'));},[id,language]);
 return <div className="forge-workspace" data-theme="light"><main className="shared-chat forge-pane"><a href="/">← Fire Atlas</a><button onClick={()=>setLanguage(uz?'en':'uz')}>{uz?'English':'O‘zbekcha'}</button><h1>{chat?.title||(uz?'Ulashilgan suhbat':'Shared chat')}</h1><p>{uz?'Faqat o‘qish · Ulashilgan suhbat nusxasi':'Read-only · Shared conversation snapshot'}</p>{error&&<p role="alert">{error}</p>}{chat?.turns.map((t,i)=><article key={i}><h2>{t.question}</h2>{t.claims.map((c,j)=><p key={j}>{c.kind&&<small>{ui(language,c.kind)} · </small>}{c.text} {c.evidence_ids?.map(id=><a key={id} href={'#shared-'+i+'-'+id}>[{t.evidence.findIndex(e=>e.id===id)+1}] </a>)}</p>)}{t.evidence.map(e=><details key={e.id} id={'shared-'+i+'-'+e.id}><summary>{e.studyId} · {e.locator}</summary><p>{e.interpretation?(uz?'AI talqini · mustaqil tekshirilmagan':'AI interpretation · independently unverified'):e.kind==='USER_UPLOAD'?(uz?'Foydalanuvchi manbasi':'User-supplied source'):(uz?'Keltirilgan manba':'Cited source')}</p><pre>{e.text}</pre>{e.sourceUrl&&<a href={e.sourceUrl} target="_blank" rel="noreferrer">{ui(language,"Original")}</a>}</details>)}</article>)}</main></div>;
}
function Notes({language,visible}){
 const [items,setItems]=useState([]),[current,setCurrent]=useState(null),[title,setTitle]=useState(''),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const uz=language==='uz';const refresh=()=>api('notes').then(setItems);
 useEffect(()=>{if(visible)void refresh().catch(e=>setError(readableError(e,language)));},[visible]);
 return <section className="forge-pane notes-pane"><h1>{ui(language,"Notes")}</h1><p>{uz?'Tadqiqot qaydlaringiz shu yerda saqlanadi.':'Keep your research notes here.'}</p>{error&&<p role="alert">{error}</p>}
 <button onClick={()=>{setCurrent(null);setTitle('');setText('');}}>{uz?'Yangi qayd':'New note'}</button><div className="notes-layout"><nav aria-label={ui(language,"Saved notes")}>{items.map(n=><button key={n.id} onClick={()=>{setCurrent(n);setTitle(n.title);setText(n.text);}}>{n.title}</button>)}{!items.length&&<p>{uz?'Hali qaydlar yo‘q.':'No notes yet.'}</p>}</nav>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const n=await api('notes'+(current?'/'+current.id:''),current?'PATCH':'POST',{title,text,version:current?.version});setCurrent(n);await refresh();}catch(e){setError(readableError(e,language));}finally{setBusy(false);}}}>
 <label>{uz?'Sarlavha':'Title'}<input aria-label={ui(language,"Note title")} value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/></label><label>{uz?'Qayd':'Note'}<textarea aria-label={ui(language,"Note text")} value={text} onChange={e=>setText(e.target.value)} maxLength={20000} required rows={14}/></label>
 <button disabled={busy||!text.trim()}>{uz?'Saqlash':'Save note'}</button>{current&&<button type="button" disabled={busy} onClick={async()=>{try{await api('notes/'+current.id,'DELETE');setCurrent(null);setTitle('');setText('');await refresh();}catch(e){setError(readableError(e,language));}}}>{uz?'O‘chirish':'Delete note'}</button>}</form></div></section>;
}

function Chat({language,selected,navigate,action,handoff,collapsed,inspect}){
  const uz=language==='uz';
  const [history,setHistory]=useState([]),[chat,setChat]=useState(null),[q,setQ]=useState(''),[draft,setDraft]=useState('');
  const [pending,setPending]=useState(null),[error,setError]=useState(''),[archived,setArchived]=useState(false);
  const [progress,setProgress]=useState(''),[stopping,setStopping]=useState(false);
  const [creating,setCreating]=useState(false);
  const [memory,setMemory]=useState([]),[memo,setMemo]=useState(''),[kind,setKind]=useState('goal');
  const [showMemory,setShowMemory]=useState(false);
  const active=useRef(null);

  const bottom=useRef(null),composer=useRef(null),fileInput=useRef(null);
  const [attachments,setAttachments]=useState([]),[uploading,setUploading]=useState(false);
  useEffect(()=>{if(!attachments.some(a=>['QUEUED','RUNNING'].includes(a.state)))return;const timer=setInterval(()=>api('assets').then(items=>setAttachments(old=>old.map(a=>items.find(b=>b.id===a.id)||a))).catch(report),1500);return()=>clearInterval(timer);},[attachments]);
  async function attach(files){setUploading(true);setError('');try{for(const file of [...files].slice(0,3-attachments.length)){if(file.size>8000000)throw Error(uz?'Fayl 8 MB dan kichik bo‘lishi kerak':'File must be smaller than 8 MB');const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('FILE_READ_FAILED'));reader.readAsDataURL(file);});const item=await api('assets','POST',{name:file.name,base64});setAttachments(old=>[...old.filter(a=>a.id!==item.id),item]);}}catch(e){report(e);}finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}}
  const attachmentBusy=uploading||attachments.some(a=>['QUEUED','RUNNING','FAILED'].includes(a.state)||a.chunk_count===0);
  const [deleteTarget,setDeleteTarget]=useState(null),[deleting,setDeleting]=useState(false);
  const deleteDialog=useRef(null),deleteTrigger=useRef(null);
  const [actionNotice,setActionNotice]=useState('');
  const [rowMenu,setRowMenu]=useState(null),[renaming,setRenaming]=useState(null),[renameTitle,setRenameTitle]=useState('');
  const [shareLink,setShareLink]=useState(''),[shareCopied,setShareCopied]=useState(false);
  useEffect(()=>{setShareLink('');},[chat?.id]);
  useEffect(()=>{if(action&&!active.current){setAttachments([]);setChat(null);setDraft('');setError('');}},[action]);
  useEffect(()=>{if(handoff){setDraft(handoff.question);requestAnimationFrame(()=>composer.current?.focus());}},[handoff]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:'end',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[chat?.turns?.length,pending]);
  const lastRequest=useRef(null);
  const report=e=>setError(readableError(e,language));
  function refresh(){
    return api('chats?'+new URLSearchParams({q,archived:archived?'1':'0'})).then(setHistory);
  }
  useEffect(()=>{void refresh().catch(report);},[q,archived]);
  async function select(id){
    const selected=await api('chats/'+id);
    setChat(selected);setError('');
    const ids=selected.turns?.at(-1)?.asset_ids??[];
    if(ids.length){const items=await api('assets');setAttachments(items.filter(a=>ids.includes(a.id)));}else setAttachments([]);
  }
  useEffect(()=>{
    if(!chat?.turns?.some(t=>t.state==='RUNNING'))return;
    const timer=setInterval(()=>void select(chat.id).catch(report),1500);
    return ()=>clearInterval(timer);
  },[chat]);
  async function create(){
    setCreating(true);
    try{
      const item=await api('chats','POST',{});
      setChat({...item,turns:[]});setDraft('');await refresh();return item;
    }finally{setCreating(false);}
  }
  async function update(patch){
    await api('chats/'+chat.id,'PATCH',{version:chat.version,...patch});
    await select(chat.id);await refresh();
  }
  useEffect(()=>{if(!rowMenu)return;function close(e){if(e.key==='Escape'||e.type==='pointerdown'&&!e.target.closest('.history-menu')&&!e.target.closest('.history-more'))setRowMenu(null);}function moved(){setRowMenu(null);}document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);window.addEventListener('resize',moved);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);window.removeEventListener('resize',moved);};},[rowMenu]);
  async function rowAction(item,action){
    setRowMenu(null);setError('');setActionNotice('');navigate('chat');
    try{
      const latest=await api('chats/'+item.id);
      if(action==='rename'){setRenaming(latest);setRenameTitle(latest.title);return;}
      if(action==='share'){const shared=await api('chats/'+item.id+'/share','POST',{});const link=location.origin+location.pathname+'?share='+shared.id;setShareLink(link);try{await copyText(link);setShareCopied(true);}catch{setShareCopied(false);}}
      else if(action==='revoke'){await api('chats/'+item.id+'/share','DELETE');setShareLink('');setActionNotice(uz?'Ulashish to‘xtatildi.':'Sharing stopped.');}
      else if(action==='copy'){await copyText(latest.turns.map(t=>t.question+'\n'+(t.result?.claims||[]).map(c=>c.text).join('\n')).join('\n\n'));setActionNotice(uz?'Suhbat nusxalandi.':'Conversation copied.');}
      else if(action==='delete'){deleteTrigger.current=document.querySelector('.history-more[aria-expanded="true"]')||document.activeElement;setDeleteTarget(latest);return;}
      else if(action==='memory'){await select(item.id);setShowMemory(true);await loadMemory();requestAnimationFrame(()=>document.getElementById('chat-memory')?.scrollIntoView({block:'start',behavior:'smooth'}));}
      else await api('chats/'+item.id,'PATCH',{version:latest.version,...(action==='pin'?{pinned:!latest.pinned}:{archived:!latest.archived})});
      if(chat?.id===item.id&&action!=='delete')await select(item.id);
      await refresh();
    }catch(e){report(e);}
  }
  useEffect(()=>{if(!deleteTarget)return;deleteDialog.current?.querySelector('button')?.focus();function key(e){if(e.key==='Escape'&&!deleting)setDeleteTarget(null);if(e.key==='Tab'){const buttons=[...deleteDialog.current.querySelectorAll('button:not(:disabled)')];if(!buttons.length){e.preventDefault();return;}const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);deleteTrigger.current?.focus();};},[deleteTarget,deleting]);
  useEffect(()=>{if(!shareLink&&!renaming)return;const previous=document.activeElement;const dialog=document.querySelector('.chat-action-dialog');dialog?.querySelector('input,button')?.focus();function key(e){if(e.key==='Escape'){setShareLink('');setRenaming(null);}if(e.key==='Tab'){const items=[...dialog.querySelectorAll('input,button:not(:disabled)')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}}document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};},[!!shareLink,!!renaming]);
  async function confirmDelete(){if(deleting||!deleteTarget)return;setDeleting(true);try{await api('chats/'+deleteTarget.id,'DELETE');if(chat?.id===deleteTarget.id){setChat(null);setAttachments([]);setDraft('');lastRequest.current=null;}await refresh();setDeleteTarget(null);}catch(e){report(e);}finally{setDeleting(false);}}
  async function send(event){
    event.preventDefault();
    if(active.current||!draft.trim()||attachmentBusy)return;
    const previous=lastRequest.current;
    const signature=attachments.map(a=>a.id).join(',');
    const job=previous?.question===draft&&previous.chat===chat?.id&&previous.signature===signature?previous:{id:requestId(),chat:chat?.id,question:draft,signature};
    lastRequest.current=job;
    active.current=job;setError('');setPending(job);setDraft('');setStopping(false);
    try{
      job.chat??=(await create()).id;
      if(job.cancelRequested){lastRequest.current=null;return;}
      const result=await api('chats/'+job.chat+'/turns','POST',{question:job.question,language,request_id:job.id,trials:selected,asset_ids:attachments.map(a=>a.id)},
        event=>{if(job.cancelRequested)return;setProgress(event==='retrieval.ready'?(uz?'Dalillar tekshirildi':'Evidence checked'):event==='run.started'?(uz?'Qidirilmoqda…':'Searching…'):'');});
      if(result.state==='FAILED')setError(readableError({message:result.error},language));
      if(result.state!=='RUNNING')lastRequest.current=null;
      setDraft('');await select(job.chat);await refresh();
    }catch(e){report(e);setDraft(job.question);}
    finally{active.current=null;setPending(null);setStopping(false);}
  }
  async function loadMemory(){setMemory(await api('memory'));}

  const empty=!chat?.turns?.length&&!pending;
  const historyPanel=<div className="chat-history"><p className="eyebrow">{uz?'Suhbatlar':'Recent chats'}</p>
      <label>{uz?'Tarixdan qidirish':'Search history'}<input value={q} onChange={e=>setQ(e.target.value)}/></label>
      <label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>{uz?'Arxiv':'Archive'}</label>
      {history.map(item=><div key={item.id} className={'history-row '+(chat?.id===item.id?'is-current':'')}><button className="history-select" disabled={!!pending} aria-pressed={chat?.id===item.id} onClick={()=>{setAttachments([]);setRowMenu(null);void select(item.id).catch(report);}}>{item.pinned&&<Pin size={12}/>}<span>{item.title}</span></button><button className="history-more" aria-label={(uz?'Chat menyusi: ':'Chat menu: ')+item.title} aria-haspopup="menu" aria-expanded={rowMenu?.item.id===item.id} disabled={!!pending} onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();setRowMenu(rowMenu?.item.id===item.id?null:{item,left:Math.max(8,Math.min(rect.right+8,innerWidth-252)),top:Math.max(8,Math.min(rect.top,innerHeight-350))});}}><MoreHorizontal size={17}/></button></div>)}
      {history.length>=100&&<button onClick={()=>void api('chats?'+new URLSearchParams({q,archived:archived?'1':'0',cursor:history.at(-1).id})).then(items=>setHistory([...history,...items])).catch(report)}>{ui(language,"Load more")}</button>}
    </div>;
  return <section className={'forge-chat '+(empty&&!draft.trim()?'is-empty':'has-messages')}>
    {document.getElementById('forge-history-slot')&&createPortal(historyPanel,document.getElementById('forge-history-slot'))}
    <div className="chat-canvas">
      {empty&&<div className="welcome"><a className="welcome-mark nasa-source-mark" href="https://psi.nasa.gov/physci/repo" target="_blank" rel="noreferrer" aria-label="NASA data source"><img src="/nasa-logo.svg" alt="NASA"/></a><p className="eyebrow">{uz?'NASA DALILLARI · SIZNING IZLANISHINGIZ':'NASA EVIDENCE · YOUR CURIOSITY'}</p><h1>{uz?'Savolingizdan boshlaymiz.':'Start with a question.'}</h1><p>{uz?'Tadqiqotlarni izlang. Dalillarni solishtiring. Birgalikda tushuning.':'Explore research. Compare evidence. Understand together.'}</p></div>}
      {error&&<p role="alert">{error}</p>}
      {actionNotice&&<div className="action-toast" role="status">{actionNotice}<button aria-label={uz?'Xabarni yopish':'Dismiss notification'} onClick={()=>setActionNotice('')}>×</button></div>}
      {chat&&<header className="chat-toolbar"><h2>{chat.title}</h2></header>}
      {rowMenu&&createPortal(<div className="forge-workspace menu-portal" data-theme={document.querySelector('.forge-workspace')?.dataset.theme||'dark'}><div className="history-menu" role="menu" aria-label={ui(language,"Chat actions")} style={{left:rowMenu.left,top:rowMenu.top}} onKeyDown={e=>{const buttons=[...e.currentTarget.querySelectorAll('button')];const index=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}}} ref={node=>{if(node&&!node.contains(document.activeElement))node.querySelector('button')?.focus();}}>
        {[[Pencil,'rename',uz?'Nomini o‘zgartirish':'Rename'],[Pin,'pin',rowMenu.item.pinned?(uz?'Pinni olish':'Unpin'):(uz?'Pin qilish':'Pin')],[Share2,'share',ui(language,'Share')],[Copy,'copy',uz?'Suhbatni nusxalash':'Copy conversation'],...(rowMenu.item.share_id?[[Link,'revoke',uz?'Ulashishni to‘xtatish':'Stop sharing']]:[]),[Brain,'memory',uz?'Xotira':'Memory'],[Archive,'archive',rowMenu.item.archived?(uz?'Arxivdan chiqarish':'Restore'):(uz?'Arxivlash':'Archive')],[Trash2,'delete',uz?'O‘chirish':'Delete']].map(([Icon,action,label])=><button role="menuitem" key={action} className={action==='delete'?'menu-delete':''} onClick={()=>void rowAction(rowMenu.item,action)}><Icon size={16}/><span>{label}</span></button>)}
      </div></div>,document.body)}
      {deleteTarget&&<div className="settings-backdrop" onClick={()=>{if(!deleting)setDeleteTarget(null);}}><section ref={deleteDialog} className="settings-sheet forge-pane delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-chat-title" aria-describedby="delete-chat-description" aria-busy={deleting} onClick={e=>e.stopPropagation()}><h2 id="delete-chat-title">{uz?'Chatni o‘chirish':'Delete chat'}</h2><p id="delete-chat-description">{uz?'Ushbu suhbat o‘chiriladi. Uni qayta tiklab bo‘lmaydi.':'This conversation will be deleted. This cannot be undone.'}</p><div className="dialog-actions"><button disabled={deleting} onClick={()=>setDeleteTarget(null)}>{ui(language,"Cancel")}</button><button className="confirm-delete" disabled={deleting} onClick={()=>void confirmDelete()}>{deleting?(uz?'O‘chirilmoqda…':'Deleting…'):ui(language,'Confirm')}</button></div></section></div>}
      {renaming&&<div className="settings-backdrop" onClick={()=>setRenaming(null)}><form className="settings-sheet forge-pane chat-action-dialog" role="dialog" aria-modal="true" aria-label={ui(language,"Rename chat")} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setRenaming(null);}} onSubmit={async e=>{e.preventDefault();try{await api('chats/'+renaming.id,'PATCH',{version:renaming.version,title:renameTitle});if(chat?.id===renaming.id)await select(renaming.id);await refresh();setRenaming(null);}catch(e){report(e);}}}><h2>{uz?'Chat nomini o‘zgartirish':'Rename chat'}</h2><input autoFocus aria-label={ui(language,"Chat title")} value={renameTitle} onChange={e=>setRenameTitle(e.target.value)} maxLength={120} required/><button disabled={!renameTitle.trim()}>{uz?'Saqlash':'Save'}</button><button type="button" onClick={()=>setRenaming(null)}>{uz?'Bekor qilish':'Cancel'}</button></form></div>}
      {shareLink&&<div className="settings-backdrop" onClick={()=>setShareLink('')}><section className="settings-sheet forge-pane chat-action-dialog share-panel" role="dialog" aria-modal="true" aria-label={uz?'Suhbatni ulashish':'Share conversation'} onClick={e=>e.stopPropagation()}><h2>{uz?'Suhbatni ulashish':'Share conversation'}</h2><p>{uz?'Havolasi bor odam suhbatning ulashilgan nusxasini o‘qiy oladi.':'Anyone with the link can read the shared snapshot.'}</p><input aria-label={ui(language,'Share link')} readOnly value={shareLink} onFocus={e=>e.target.select()}/><p role="status">{shareCopied?(uz?'Havola nusxalandi.':'Link copied.'):(uz?'Havolani nusxalang yoki maydondan tanlab oling.':'Copy the link or select it from the field.')}</p><div className="dialog-actions"><button onClick={()=>setShareLink('')}>{uz?'Yopish':'Close'}</button><button onClick={async()=>{try{await copyText(shareLink);setShareCopied(true);}catch{setShareCopied(false);}}}>{uz?'Havolani nusxalash':'Copy link'}</button></div></section></div>}


      {chat?.summary&&<details><summary>{uz?'Suhbat konteksti':'Thread context'}</summary><pre>{JSON.stringify(chat.summary.entries,null,2)}</pre></details>}

      {showMemory&&<div id="chat-memory"><header className="memory-heading"><h2>{uz?'Chat xotirasi':'Chat memory'}</h2><button onClick={()=>setShowMemory(false)}>{uz?'Yopish':'Close'}</button></header><label><input type="checkbox" checked={!!chat?.memory} disabled={!chat||!!pending} onChange={e=>void update({memory:e.target.checked}).catch(report)}/>{uz?'Shu chatda xotirani ishlatish':'Use memory in this chat'}</label>
        <button onClick={()=>void api('memory','DELETE').then(loadMemory).catch(report)}>{uz?'Barcha xotirani unutish':'Forget all memory'}</button>
        <form onSubmit={e=>{e.preventDefault();void api('memory','POST',{kind,text:memo,consent:true}).then(()=>{setMemo('');return loadMemory();}).catch(report);}}>
          <select value={kind} onChange={e=>setKind(e.target.value)} aria-label={ui(language,"Memory type")}>{['goal','language','format','conditions'].map(k=><option key={k} value={k}>{ui(language,k)}</option>)}</select>
          <input aria-label={ui(language,"Memory")} value={memo} onChange={e=>setMemo(e.target.value)} required maxLength={400}/>
          <button>{uz?'Xotiraga saqlash':'Remember'}</button>
        </form>
        {memory.map(item=><form key={item.id+item.version} onSubmit={e=>{
          e.preventDefault();const data=new FormData(e.currentTarget);
          void api('memory/'+item.id,'PATCH',{kind:item.kind,text:data.get('text'),enabled:data.has('enabled'),version:item.version}).then(loadMemory).catch(report);
        }}><label>{ui(language,item.kind)}<input name="text" defaultValue={item.text}/></label>
          <label><input name="enabled" type="checkbox" defaultChecked={item.enabled}/>{uz?'Faol':'Enabled'}</label>
          <button>{uz?'Saqlash':'Save'}</button>
          <button type="button" onClick={()=>void api('memory/'+item.id,'DELETE').then(loadMemory).catch(report)}>{uz?'Unutish':'Forget'}</button>
        </form>)}
      </div>}
      <div className="forge-turns" aria-live="polite">
        
        {chat?.turns?.map(turn=><article key={turn.id} className="chat-turn"><div className="user-message"><p>{turn.question}</p><div className="message-actions"><button aria-label={ui(language,"Copy question")} onClick={()=>void copyText(turn.question).catch(report)}><Copy size={14}/></button><button aria-label={ui(language,"Edit question")} disabled={!!pending} onClick={()=>{setDraft(turn.question);composer.current?.focus();}}><Pencil size={14}/></button></div></div><div className="assistant-message">
          {turn.result?<><div className="answer-heading"><span className="answer-mark">F</span><strong>Fire Atlas</strong><small>{turn.result.duration_ms?`${(turn.result.duration_ms/1000).toFixed(1)} s`:turn.result.status==='GENERAL'?(uz?'Umumiy suhbat':'General conversation'):turn.result.status==='PRODUCT'?(uz?'Tizim haqida':'Workspace help'):turn.result.model?'AI':ui(language,'Local')} · {ui(language,turn.result.status)}</small></div>
            {turn.result.status==='INSUFFICIENT_EVIDENCE'&&<p>{uz?'Bu ma’lumot ulangan bazamizda topilmadi. Mos manbani yuklang yoki boshqa savol bering.':'This information was not found in our connected database. Add a relevant source or ask another question.'}</p>}
            {turn.result.claims.map((claim,i)=><p key={i}>{claim.kind&&<small>{claim.kind==='AI_INTERPRETATION'?(uz?'AI rasm talqini':'AI visual interpretation'):claim.kind==='USER_REPORTED'?(uz?'Yuklangan manba':'Uploaded source'):claim.kind==='SOURCE_FINDING'?(uz?'Manbali natija':'Source finding'):ui(language,claim.kind)} · </small>}{claim.text} {claim.evidence_ids.map(id=><a key={id} href={'#'+turn.id+'-'+id}
              onClick={event=>{event.preventDefault();inspect(turn.result.evidence.filter(s=>s.id===id),[claim]);}}>[{turn.result.evidence.findIndex(source=>source.id===id)+1}] </a>)}</p>)}
            {turn.result.evidence.length>0&&<AnswerExtras language={language} evidence={turn.result.evidence}/>}

            <button onClick={()=>void copyText(turn.result.claims.map(claim=>claim.text+' '+claim.evidence_ids.map(id=>{const source=turn.result.evidence.find(s=>s.id===id);return source?'['+source.locator+']('+source.sourceUrl+')':'';}).join(' ')).join('\n\n')).catch(report)}>{ui(language,"Copy")}</button>
            {turn.result.evidence.length>0&&<button onClick={()=>inspect(turn.result.evidence,turn.result.claims)}>{ui(language,'Library')} · {uz?'Dalilni tekshirish':'Verify evidence'}</button>}
            <button onClick={()=>navigate('tools')}>{ui(language,"Tools")}</button>
          </>:<p>{ui(language,turn.state)} {readableError({message:turn.error},language)}</p>}
          {['FAILED','CANCELLED','INTERRUPTED'].includes(turn.state)&&<button onClick={()=>setDraft(turn.question)}>{uz?'Qayta urinish':'Retry'}</button>}
        </div></article>)}
        {pending&&!chat?.turns?.some(t=>t.id===pending.chat+':'+pending.id)&&<article className="chat-turn pending-turn"><div className="user-message"><p>{pending.question}</p></div><div className="assistant-message"><p role="status" className="thinking"><span/>{progress|| (uz?'Manbalar ko‘rib chiqilmoqda…':'Reviewing sources…')}</p></div></article>}
        <div ref={bottom}/>
      </div>
      <form className="chat-composer" onSubmit={send}>
        <input ref={fileInput} type="file" hidden multiple accept=".pdf,.docx,.txt,.csv,.json,.png,.jpg,.jpeg" onChange={e=>void attach(e.target.files)}/>
        {attachments.length>0&&<div className="attachment-list">{attachments.map(a=><div key={a.id}><strong>{a.name}</strong><small>{a.state==='READY'?(uz?'Tayyor':'Ready'):a.state==='PARTIAL'?(uz?'Qisman tayyor':'Partially ready'):a.state==='FAILED'?(uz?'Xato':'Failed'):'Ingestion…'} {a.error||''}</small><button type="button" disabled={!!pending} aria-label={'Remove '+a.name} onClick={()=>setAttachments(old=>old.filter(b=>b.id!==a.id))}>×</button></div>)}</div>}
        {uploading&&<p role="status">{uz?'Fayl yuklanmoqda…':'Uploading file…'}</p>}

        <label>{uz?'Tadqiqot haqida savol':'Ask about an experiment'}
          <textarea ref={composer} placeholder={uz?'Savolingizni yozing…':'Write your question…'} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={300} required disabled={!!pending||creating||chat?.archived}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form.requestSubmit();}}}/>
        </label>
        <div className="composer-bottom"><button type="button" className="icon-button" aria-label={ui(language,"Attach files")} disabled={uploading||!!pending||attachments.length>=3} onClick={()=>fileInput.current?.click()}><Plus size={20}/></button><small>{attachments.length?(uz?'Biriktirilgan fayllar bo‘yicha · rasmlar AI orqali tahlil qilinadi':'Attached sources only · images analyzed with AI'):(uz?'Javoblar ulangan manbalarga asoslanadi':'Answers grounded in connected sources')}</small>{pending?<button type="button" className="send-button stop-generation" aria-label={uz?'Javobni to‘xtatish':'Stop response'} title={uz?'Javobni to‘xtatish':'Stop response'} disabled={stopping} onClick={async()=>{const job=active.current;if(!job)return;job.cancelRequested=true;setStopping(true);setProgress(uz?'To‘xtatilmoqda…':'Stopping…');if(job.chat)try{await api('chats/'+job.chat+'/cancel','POST',{request_id:job.id});}catch(e){job.cancelRequested=false;setStopping(false);report(e);}}}><Square size={14} fill="currentColor" strokeWidth={0}/></button>:<button className="send-button" aria-label={uz?'Yuborish':'Send'} disabled={!draft.trim()||creating||attachmentBusy||chat?.archived}><ArrowUp size={19}/></button>}</div>

      </form>
    </div>
  </section>;
}

function AnswerExtras({evidence,language}){
  const [comparison,setComparison]=useState(null),[media,setMedia]=useState([]);
  useEffect(()=>{
    let valid=true;
    const ids=[...new Set(evidence.filter(e=>e.studyId==='PSI-25'&&e.trialId).map(e=>e.studyId+':'+e.trialId))].filter(id=>trialOptions.some(t=>t.id===id));
    if(ids.length>1&&ids.length<=3)void api('compare','POST',{trials:ids}).then(data=>{if(valid)setComparison(data);}).catch(()=>{});
    const studies=new Set(evidence.map(e=>e.studyId));
    void fetch('/api/ingestion/studies').then(r=>r.json()).then(data=>{if(valid)setMedia((data.studies??[]).filter(s=>studies.has(s.id)).flatMap(s=>s.files.filter(f=>f.media).map(f=>({...f,study:s.id}))));}).catch(()=>{});
    return()=>{valid=false;};
  },[evidence]);
  return <>{media.length>0&&<div className="answer-media">{media.map(file=><figure key={file.url}>{file.media.startsWith('image/')?<img src={file.url} alt={file.name}/>:file.media.startsWith('video/')?<video controls preload="metadata" src={file.url}/>:null}<figcaption><a href={file.url} target="_blank" rel="noreferrer">{file.study} · {file.name}</a></figcaption></figure>)}</div>}
    {comparison&&<div className="answer-comparison"><p>{language==='uz'?'Manbali taqqoslash · Jadval 7.1':'Source comparison · Table 7.1'}</p><table><thead><tr><th>{language==='uz'?'O‘lchov':'Measurement'}</th>{comparison.trials.map(t=><th key={t.trial_id}>{t.trial_id}</th>)}</tr></thead><tbody>{comparison.rows.map(row=><tr key={ui(language,row.field)}><th>{ui(language,row.field)}</th>{row.values.map((value,i)=><td key={i}>{value??ui(language,'Unknown')}</td>)}</tr>)}<tr><th>{language==='uz'?'Natija':'Outcome'}</th>{comparison.trials.map(t=><td key={t.trial_id}><a href={t.sources[0].url} target="_blank" rel="noreferrer">{t.outcome.raw_display}</a></td>)}</tr></tbody></table></div>}
  </>;
}

function readableEvidence(text,language){
  const uz=language==='uz';
  // Deterministic presentation of original values, with no new scientific inference.
  const fields=Object.fromEntries(text.split('\n').map(line=>{const i=line.indexOf(':');return i>0?[line.slice(0,i).trim(),line.slice(i+1).trim()]:[];}).filter(pair=>pair.length));
  if(fields.trial_id&&fields.material){
    const result=[uz?`${fields.study||fields.study_id} tadqiqotining ${fields.trial_id} sinovida ${fields.material} materiali ishlatilgan.`:`Trial ${fields.trial_id} in ${fields.study||fields.study_id} used ${fields.material}.`];
    if(fields.sample_width_cm)result.push(uz?`Namunaning eni ${fields.sample_width_cm} cm. Bu en o‘lchovi; qalinlik sifatida talqin qilinmaydi.`:`The sample width is ${fields.sample_width_cm} cm. This measures width, not thickness.`);
    if(fields.flow_raw)result.push(uz?`Havo oqimi manbada ${fields.flow_raw} ${fields.flow_unit||''} tartibida berilgan.`:`The source reports airflow in the order ${fields.flow_raw} ${fields.flow_unit||''}.`);
    for(const [key,value] of Object.entries(fields)){if(/outcome|result|oxygen|o2|gravity/i.test(key))result.push(`${({outcome:uz?'Kuzatilgan natija':'Observed outcome',outcome_raw:uz?'Kuzatilgan natija':'Observed outcome',gravity:uz?'Gravitatsiya':'Gravity',o2_concentration:uz?'Kislorod konsentratsiyasi':'Oxygen concentration'})[key]||key.replaceAll('_',' ')}: ${value}.`);}
    return result;
  }
  return text.split(/\n\s*\n/).filter(Boolean);
}

function EvidenceReader({focus,language,close}){
  const [current,setCurrent]=useState(0),[part,setPart]=useState(null),[error,setError]=useState('');
  useEffect(()=>{setCurrent(0);},[focus]);
  const source=focus?.sources?.[current];
  useEffect(()=>{setPart(null);setError('');if(!source)return;const id=(source.fileUrl||source.sourceUrl||'').match(/assets\/([0-9a-f]+)\//)?.[1];if(!id)return;let live=true;api('assets/'+id+'/excerpt?'+new URLSearchParams({locator:source.locator})).then(p=>{if(live)setPart(p);}).catch(e=>{if(live)setError(readableError(e,language));});return()=>{live=false;};},[source]);
  if(!focus)return null;
  const text=source?.text||'';
  return <section id="evidence-reader" className="evidence-reader" tabIndex={-1}><p className="eyebrow">{language==='uz'?'JAVOB → ASL DALIL':'ANSWER → SOURCE EVIDENCE'}</p><h2>{language==='uz'?'Dalilni tekshiring':'Verify the evidence'}</h2><button onClick={()=>download('evidence.json',JSON.stringify({sources:focus.sources},null,2))}>{language==='uz'?'Dalillarni eksport qilish':'Export evidence'}</button>
    {!source?<p>{language==='uz'?'Bu javobga manba biriktirilmagan.':'No source attached to this answer.'}</p>:<>
    <nav aria-label={ui(language,"Answer sources")}>{focus.sources.map((s,i)=><button key={s.id} aria-pressed={i===current} onClick={()=>setCurrent(i)}>{s.file||s.studyId} · {s.locator}</button>)}</nav>
    <button onClick={close}>{language==='uz'?'Yopish':'Close'}</button>
    <h3>{part?.name||source.file||source.studyId}</h3><p>{source.locator}</p>
    <p>{language==='uz'?'Javobni qo‘llab-quvvatlovchi mazmun quyida ajratilgan. Asl hujjatdagi sahifa bilan solishtiring.':'The supporting content is highlighted below. Compare it with the cited page in the original document.'}</p>
    {source.interpretation&&<p>{language==='uz'?'Bu rasmning AI talqini; asl rasm bilan tekshiring.':'AI image interpretation; verify against the original image.'}</p>}
    {error&&<p role="alert">{error}</p>}
    <div className="readable-evidence">{readableEvidence(text,language).map((paragraph,i)=><p key={i}><mark>{paragraph}</mark></p>)}</div>
    <a href={source.sourceUrl} target="_blank" rel="noreferrer">{language==='uz'?'Asl fayl va sahifani ochish':'Open original file and page'} ↗</a>
    {(part?.mime==='application/pdf'||/\.pdf(?:#|$|\?)/i.test(source.sourceUrl||''))&&<div className="original-page"><h3>{language==='uz'?'Asl hujjat · tegishli sahifa':'Original document · cited page'}</h3><iframe title={source.file+' '+source.locator} src={source.sourceUrl} loading="lazy" style={{width:'100%',height:550,border:0}}/></div>}

    {part?.mime?.startsWith('image/')&&<img src={part.original} alt={part.name}/>}
    </>}
  </section>;
}

const trialOptions=BASS_THREE.rows.map(row=>({id:row.study_id+':'+row.trial_id,title:row.trial_id}));
function TrialPicker({selected,onChange,language}){
  return <fieldset><legend>{ui(language,"Trials")}</legend>{trialOptions.map(({id,title})=><label key={id}><input type="checkbox" checked={selected.includes(id)}
    onChange={e=>onChange(e.target.checked?[...selected,id]:selected.filter(item=>item!==id))}/>{title}</label>)}</fieldset>;
}

function Library({language,selected,setSelected,ask,evidenceFocus,closeEvidence,visible}){
  const previewHost=useRef(null);
  const [previewPdf,setPreviewPdf]=useState(null);
  useEffect(()=>{if(previewPdf)previewHost.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});},[previewPdf]);
  const [pdf,setPdf]=useState(null),[serverPdfs,setServerPdfs]=useState([]),[downloadState,setDownloadState]=useState(''),[pdfError,setPdfError]=useState('');
  useEffect(()=>{if(!visible)return;let live=true;const refresh=()=>fetch('/api/nasa-files').then(r=>{if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw Error();return r.json();}).then(data=>{if(live){setServerPdfs(data.files||[]);setDownloadState(data.downloadState||'');setPdfError('');}}).catch(()=>{if(live)setPdfError(language==='uz'?'Server PDF ro‘yxatini olib bo‘lmadi.':'Could not load the server PDF list.');});void refresh();const timer=setInterval(refresh,15000);return()=>{live=false;clearInterval(timer);};},[visible,language]);
  const [shelves,setShelves]=useState([]),[pins,setPins]=useState([]),[comparison,setComparison]=useState(null);
  const [name,setName]=useState(''),[query,setQuery]=useState(''),[error,setError]=useState('');
  const [autoUpdate,setAutoUpdate]=useState(false);
  const [proposal,setProposal]=useState(null),[proposing,setProposing]=useState(false);
  const [assets,setAssets]=useState([]),[assetBusy,setAssetBusy]=useState(false);
  const [studies,setStudies]=useState([]);
  const [find,setFind]=useState(''),[found,setFound]=useState(null);
  const [category,setCategory]=useState('all'),[studyOpen,setStudyOpen]=useState(null);
  const visibleStudies=studies.filter(study=>(category==='all'||(category==='model'?study.kind==='GROUND_CFD':study.kind==='FLIGHT_EXPERIMENT'))&&(!find.trim()||[study.id,study.title,study.description].join(' ').toLowerCase().includes(find.toLowerCase())));
  const report=e=>setError(readableError(e,language));
  async function refresh(){const [s,p,a]=await Promise.all([api('shelves'),api('pins'),api('assets')]);setShelves(s);setPins(p);setAssets(a);}
  useEffect(()=>{if(visible)void refresh().catch(report);},[visible]);
  useEffect(()=>{
    void fetch('/api/ingestion/studies').then(response=>response.json()).then(data=>setStudies(data.studies??[])).catch(report);
  },[]);
  useEffect(()=>{
    if(!assets.some(asset=>['QUEUED','RUNNING'].includes(asset.state)))return;
    const timer=setInterval(()=>void refresh().catch(report),2000);
    return ()=>clearInterval(timer);
  },[assets]);
  async function upload(file){
    if(!file)return;
    if(file.size>8_000_000){report(Error('ASSET_SIZE_LIMIT_8MB'));return;}
    setAssetBusy(true);setError('');
    try{
      const base64=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('FILE_READ_FAILED'));reader.readAsDataURL(file);
      });
      await api('assets','POST',{name:file.name,base64});await refresh();
    }catch(error){report(error);}finally{setAssetBusy(false);}
  }
  return <section className="forge-pane">
    <EvidenceReader focus={evidenceFocus} language={language} close={closeEvidence}/><div className="library-heading"><p className="eyebrow">{language==='uz'?'TADQIQOT ISH MAYDONI':'YOUR RESEARCH SPACE'}</p><h1>{ui(language,"Library")}</h1><p>{language==='uz'?'Manbalarni o‘zingiz o‘rganing. Har bir dalilning aslini ko‘ring.':'Explore the research yourself. See the source behind every claim.'}</p></div>{error&&<p role="alert">{error}</p>}
    <form className="library-search" onSubmit={event=>{event.preventDefault();void api('search','POST',{query:find}).then(data=>setFound(data.results)).catch(report);}}>
      <label>{language==='uz'?'Tajriba nomi yoki PSI ID bo‘yicha qidirish':'Search experiment name or PSI ID'}<input value={find} onChange={e=>setFind(e.target.value)} maxLength={300} required/></label>
      <button>{language==='uz'?'Qidirish':'Search'}</button><button type="button" onClick={()=>{setFind('');setFound(null);setStudyOpen(null);}}>{language==='uz'?'Tozalash':'Clear'}</button>
    </form>
    <div className="library-filters">{[['all',language==='uz'?'Barchasi':'All'],['experiment',language==='uz'?'Tajribalar':'Experiments'],['model',language==='uz'?'Modellar':'Models']].map(([id,label])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}<button onClick={()=>ask(find||(language==='uz'?'Ulangan tadqiqotlar haqida tushuntiring':'Explain the connected studies'))}>{language==='uz'?'Gibrid AI’dan so‘rash ↗':'Ask Hybrid AI ↗'}</button></div>
    {found?.length===0&&<p>{language==='uz'?'Ulangan korpusda mos dalil topilmadi.':'No matching evidence in the connected corpus.'}</p>}
    {found?.map(source=><details key={source.id}><summary>{source.studyId} · {source.trialId||source.locator}</summary>
      <pre>{source.text}</pre><a href={source.fileUrl||source.sourceUrl} target="_blank" rel="noreferrer">{source.locator}</a>
    </details>)}
    <h3>{language==='uz'?'Ulangan tadqiqotlar':'Connected studies'} · {studies.length}</h3><p className="corpus-note">{language==='uz'?'Bu — tanlangan metadata, jadvallar va media to‘plami. Tadqiqotlarning barcha fayllari yuklangan emas.':'Selected metadata, tables and media; these are not complete downloads of every study.'}</p>
    <div className="study-grid">{visibleStudies.map(study=><button key={study.id} className="study-card" onClick={()=>setStudyOpen(study.id)}>
      <div className="study-cover">{study.files.some(f=>f.media?.startsWith('image/'))?<img src={study.files.find(f=>f.media?.startsWith('image/')).url} alt={study.title}/>:<BookOpen size={34}/>}<span>{ui(language,study.kind==='GROUND_CFD'?'MODEL':'EXPERIMENT')}</span></div>
      <div className="study-card-body"><small>{study.id} · v{study.version}</small><h3>{study.title}</h3><p>{study.description}</p><span>{study.files.length} {language==='uz'?'fayl':'files'} · {language==='uz'?'O‘rganish':'Explore'} ↗</span></div>
    </button>)}</div>
    {visibleStudies.length===0&&<div className="empty-library"><p>{language==='uz'?'Bu nom bilan tajriba topilmadi. Boshqa nom yoki PSI ID kiriting.':'No experiment matches this name. Try another name or PSI ID.'}</p><button onClick={()=>ask(find)}>{language==='uz'?'Gibrid AI’dan so‘rash ↗':'Ask Hybrid AI ↗'}</button></div>}
    {studyOpen&&studies.filter(s=>s.id===studyOpen).map(study=><section className="study-detail" key={study.id}>
      <button onClick={()=>setStudyOpen(null)}>← {ui(language,'Library')}</button><p className="eyebrow">{study.id} · {ui(language,study.kind)}</p><h2>{study.title}</h2>
      <div className="study-detail-layout"><div>{study.files.filter(file=>file.media).map(file=><figure key={file.name}>{file.media.startsWith('image/')?<img src={file.url} alt={file.name}/>:file.media.startsWith('video/')?<video controls src={file.url}/>:file.media==='application/pdf'?<PDFPages url={file.url} name={file.name} language={language}/>:null}<figcaption>{file.name}</figcaption></figure>)}</div><div><h3>{language==='uz'?'Tadqiqot haqida':'About the study'}</h3><p>{study.description}</p><h3>{language==='uz'?'Metodika':'Method'}</h3><p>{study.approach}</p></div></div>
      <a href={study.sourceUrl} target="_blank" rel="noreferrer">NASA · DOI {study.doi} · v{study.version}</a>
      <ul>{study.files.map(file=><li key={file.name}><a href={file.url} target="_blank" rel="noreferrer" onClick={e=>{if(file.name.toLowerCase().endsWith('.pdf')){e.preventDefault();setPdf({...file,studyId:study.id,indexed:true});}}}>{file.name}</a> · {file.bytes.toLocaleString(language==='uz'?'uz-UZ':'en-US')} {language==='uz'?'bayt':'bytes'}</li>)}</ul>
      <button onClick={()=>ask(language==='uz'?study.title+' tadqiqotining maqsadi va natijalarini manbalari bilan tushuntiring':'Explain the objectives and findings of '+study.title+' with sources')}>{language==='uz'?'Gibrid AI’dan so‘rash ↗':'Ask Hybrid AI ↗'}</button>
    </section>)}
    <ServerPDFLibrary files={serverPdfs} downloadState={downloadState} error={pdfError} language={language} onOpen={setPreviewPdf} onFolderChange={()=>setPreviewPdf(null)}>
    {previewPdf&&<section ref={previewHost} className="library-inline-pdf"><header><div><h3>{previewPdf.name}</h3></div><button onClick={()=>setPreviewPdf(null)}>{language==='uz'?'Yopish':'Close'}</button></header><PDFPages url={previewPdf.url} name={previewPdf.name} language={language}/><button onClick={()=>setPdf(previewPdf)}>{language==='uz'?'Katta oynada ochish':'Expand viewer'}</button></section>}
    </ServerPDFLibrary>
    {pdf&&<PDFViewer key={pdf.url} document={pdf} language={language} onClose={()=>setPdf(null)}/>}
    <h3>{language==='uz'?'Mening hujjatlarim':'My documents'}</h3><p>{language==='uz'?'8 MB gacha. PDF matni va dastlabki 3 ta ichki rasm tahlil qilinadi; cheklovlar faylda ko‘rsatiladi. AI talqinlari mustaqil tekshirilmagan.':'Up to 8 MB. PDF text and up to 3 embedded images are analyzed; file limitations are shown. AI interpretations are unverified.'}</p>
    <label>{language==='uz'?'Fayl import qilish':'Import document'} · 8 MB
      <input type="file" disabled={assetBusy} aria-label={ui(language,'Upload file')} accept=".pdf,.docx,.txt,.csv,.json,.jpg,.jpeg,.png,.mp4,.webm"
        onChange={e=>void upload(e.target.files[0])}/>
    </label>
    {assets.map(asset=><details key={asset.id}>
      <summary>{asset.name} · {ui(language,asset.state)} · {asset.chunk_count}</summary>
      {asset.error&&<p>{readableError({message:asset.error},language)}</p>}
      {asset.limit&&<p>{ui(language,asset.limit)}</p>}
      <a href={'/api/workspace/assets/'+asset.id+'/original'} target="_blank" rel="noreferrer" onClick={e=>{if(asset.mime==='application/pdf'){e.preventDefault();setPdf({name:asset.name,url:'/api/workspace/assets/'+asset.id+'/original',indexed:asset.chunk_count>0});}}}>{ui(language,"Original")}</a>
      {asset.mime==='application/pdf'&&<PDFPages url={'/api/workspace/assets/'+asset.id+'/original'} name={asset.name} language={language}/>}
      {asset.mime.startsWith('image/')&&<img width="240" src={'/api/workspace/assets/'+asset.id+'/original'} alt={asset.name}/>}
      {asset.mime.startsWith('video/')&&<><video width="320" controls preload="metadata" src={'/api/workspace/assets/'+asset.id+'/original'}
        onError={event=>{event.currentTarget.nextElementSibling.hidden=false;}}/>
        <p hidden>{language==='uz'?'Videoni shu brauzerda ijro etib bo‘lmadi. Asl faylni yuklab oching.':'This browser could not play the video. Download the original file.'}</p></>}
      {asset.extraction.map((part,index)=><p key={index}>{part.locator} · {ui(language,part.status)}</p>)}
      <button onClick={()=>void api('assets/'+asset.id,'DELETE').then(refresh).catch(report)}>{language==='uz'?'O‘chirish':'Delete'}</button>
    </details>)}
    <h3>BASS-II · PSI-25</h3><TrialPicker language={language} selected={selected} onChange={setSelected}/>
    <div>{selected.map(id=><button key={id} onClick={()=>{
      const pin=pins.find(item=>item.trial===id);
      void (pin?api('pins/'+pin.id,'DELETE'):api('pins','POST',{trial:id})).then(refresh).catch(report);
    }}>{ui(language,pins.some(item=>item.trial===id)?'Unpin':'Pin')} {id}</button>)}</div>
    <button disabled={!selected.length} onClick={()=>void api('compare','POST',{trials:selected}).then(setComparison).catch(report)}>{ui(language,"Compare")}</button>
    {comparison&&<div><table><thead><tr><th>{ui(language,"Measurement")}</th><th>{ui(language,"Status")}</th>{comparison.trials.map(t=><th key={t.trial_id}>{t.trial_id}</th>)}</tr></thead>
      <tbody>{comparison.rows.map(row=><tr key={ui(language,row.field)}><th>{ui(language,row.field)}</th><td>{ui(language,row.status)}</td>{row.values.map((v,i)=><td key={i}>{v??ui(language,'Unknown')}</td>)}</tr>)}
        <tr><th>{ui(language,"Outcome")}</th><td></td>{comparison.trials.map(t=><td key={t.trial_id}>{t.outcome.raw_display} <a href={t.sources[0].url}>NASA</a></td>)}</tr></tbody></table>
      <button onClick={()=>download('comparison.json',JSON.stringify(comparison,null,2))}>{ui(language,"Export JSON")}</button></div>}
    <form onSubmit={e=>{e.preventDefault();void api('shelves','POST',{name,mode:query.trim()?'smart':'manual',query,members:selected,auto_update:autoUpdate}).then(()=>{setName('');return refresh();}).catch(report);}}>
      <label>{language==='uz'?'Javon nomi':'Shelf name'}<input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></label>
      <label>{language==='uz'?'Smart javon savoli':'Smart shelf query'}<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={300}/></label>
      <button type="button" disabled={proposing||!query.trim()} onClick={async()=>{
        setProposing(true);
        try{const result=await api('shelf-preview','POST',{query,language});setProposal(result);setName(result.name);}
        catch(error){report(error);}finally{setProposing(false);}
      }}>{language==='uz'?'AI javon taklifi':'AI shelf proposal'}</button>
      <label><input type="checkbox" checked={autoUpdate} onChange={e=>setAutoUpdate(e.target.checked)}/>{language==='uz'?'Yangi korpusda avtomatik yangilash':'Auto-update on new corpus'}</label>
      <button>{language==='uz'?'Javonni saqlash':'Save shelf'}</button>
    </form>
    {proposal&&<details open><summary>{proposal.name}</summary><p>{proposal.explanation}</p>
      {proposal.candidates.map((item,index)=><p key={index}>{item.id} · {ui(language,item.kind)} · {item.applicability} · {item.locator}</p>)}
    </details>}
    {shelves.map(shelf=><details key={shelf.id}><summary>{shelf.name} · {ui(language,shelf.mode)} · {shelf.members.length}</summary>
      {shelf.stale&&<p>{ui(language,'Stale')} · <button onClick={()=>void api('shelves/'+shelf.id,'PATCH',{...shelf}).then(refresh).catch(report)}>{ui(language,"Refresh membership")}</button></p>}
      <ul>{shelf.members.map(id=><li key={id}>{id} <button onClick={()=>void api('shelves/'+shelf.id,'PATCH',{...shelf,exclusions:[...shelf.exclusions,id]}).then(refresh).catch(report)}>{ui(language,"Exclude")}</button></li>)}</ul>
      {shelf.reasons.map((reason,i)=><p key={i}>{reason.trial} · {ui(language,reason.kind)} · {reason.locator}</p>)}
    </details>)}
  </section>;
}
