import React,{useEffect,useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import Atlas,{download} from './Atlas.jsx';
import {BASS_THREE} from '../data/index.js';
import {Menu,Plus,LibraryBig,MessageSquare,Settings,Sun,Moon,ArrowUp,PanelLeftClose,Search,Copy,Pencil,Sparkles,SlidersHorizontal,BookOpen} from 'lucide-react';
import './workspace.css';

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
  return messages[code]?.[language==='uz'?0:1]||code;
}

async function copyText(text){
  if(navigator.clipboard)return navigator.clipboard.writeText(text);
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
  function inspect(sources){setEvidenceFocus({sources,id:requestId()});setPage('library');requestAnimationFrame(()=>document.getElementById('evidence-reader')?.scrollIntoView({block:'start'}));}
  const [settings,setSettings]=useState(false),[chatAction,setChatAction]=useState(null),[handoff,setHandoff]=useState(null);
  const uz=language==='uz';
  useEffect(()=>{void api('session','POST',{}).then(()=>setReady(true)).catch(e=>setFailure(e.message));},[]);
  useEffect(()=>{try{localStorage.setItem('forge-theme',theme);localStorage.setItem('forge-language',language);}catch{}},[theme,language]);
  useEffect(()=>{const media=matchMedia('(max-width:700px)');const changed=()=>{if(media.matches)setCollapsed(true);};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
  useEffect(()=>{if(!settings)return;const previous=document.activeElement;const dialog=document.querySelector('.settings-sheet');dialog?.querySelector('button')?.focus();function key(e){if(e.key==='Escape')setSettings(false);if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button,select,a,input')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}}document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};},[settings]);
  function ask(question){setHandoff({question,id:requestId()});setPage('chat');}
  return <div className={'forge-workspace '+(collapsed?'sidebar-collapsed':'')} data-theme={theme}>
    <header className="forge-topbar"><button className="icon-button" aria-label={uz?'Menyuni ochish':'Toggle menu'} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}><Menu size={20}/></button>
      <strong>SKYFORGE <span>Fire Atlas</span></strong>
      <nav aria-label="Workspace">{[['chat','Hybrid AI'],['library','Library']].map(([key,title])=><button key={key} aria-pressed={page===key} onClick={()=>setPage(key)}>{title}</button>)}</nav>
      <div className="top-actions"><button className="icon-button" aria-label="Notes and tools" onClick={()=>setPage('tools')}><BookOpen size={19}/></button>
      <button className="icon-button" aria-label={theme==='dark'?'Day mode':'Night mode'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}</button>
      <a href="https://psi.nasa.gov/physci/repo" target="_blank" rel="noreferrer" className="nasa-wordmark">NASA ↗</a></div>
    </header>
    <aside className="forge-sidebar" aria-label="Main menu"><div className="sidebar-brand">F<span>FIRE ATLAS</span><button className="icon-button" aria-label="Collapse sidebar" onClick={()=>setCollapsed(true)}><PanelLeftClose size={18}/></button></div>
      <button className="sidebar-new" disabled={!ready} onClick={()=>{setPage('chat');setChatAction({id:requestId()});}}><Plus size={18}/> New Chat</button>
      <button className={'sidebar-nav '+(page==='library'?'active':'')} onClick={()=>setPage('library')}><LibraryBig size={18}/> Library</button>
      <button className={'sidebar-nav '+(page==='tools'?'active':'')} onClick={()=>setPage('tools')}><SlidersHorizontal size={18}/> Tools</button>
      <div id="forge-history-slot" className="history-slot"/>
      <button className="sidebar-settings" onClick={()=>setSettings(!settings)}><Settings size={18}/>{uz?'Sozlamalar':'Settings'}</button>
    </aside>
    <main className="forge-main">
    {!ready?<section className="forge-pane connection-state"><h2>{failure?'Ulanishda xato':'Fire Atlas'}</h2><p>{failure||'Ulanmoqda…'}</p>{failure&&<button onClick={()=>location.reload()}>Qayta ulanish</button>}</section>:<>
      {selected.length>0&&<div className="selection-strip">{uz?'Tanlangan sinovlar':'Selected trials'} · {selected.join(', ')}<button onClick={()=>setSelected([])}>{uz?'Tozalash':'Clear'}</button></div>}
      <div hidden={page!=='chat'}><Chat language={language} selected={selected} navigate={setPage} action={chatAction} handoff={handoff} collapsed={collapsed} inspect={inspect} onEvidence={setEvidenceFocus}/></div>
      <div hidden={page!=='library'}><Library language={language} selected={selected} setSelected={setSelected} ask={ask} evidenceFocus={evidenceFocus} visible={page==='library'}/><details className="forge-pane legacy-atlas"><summary>{uz?'O‘lchovlar, import va Notebook':'Measurements, import and Notebook'}</summary><Atlas/></details></div>
      <div hidden={page!=='tools'}><Tools language={language} trials={selected} setTrials={setSelected}/></div>
    </>}
    </main>
    {settings&&<div className="settings-backdrop" onClick={()=>setSettings(false)}><section className="settings-sheet forge-pane" role="dialog" aria-modal="true" aria-label="Settings" onClick={e=>e.stopPropagation()}>
      <header><h2>{uz?'Sozlamalar':'Settings'}</h2><button onClick={()=>setSettings(false)} aria-label="Close settings">×</button></header>
      <label>{uz?'Til':'Language'}<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="uz">O‘zbekcha</option><option value="en">English</option></select></label>
      <label>{uz?'Ko‘rinish':'Appearance'}<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="dark">Night</option><option value="light">Day</option></select></label>
      <button onClick={()=>{setPage('library');setSettings(false);}}>Library · Import</button>
      <p>{uz?'Fire Atlas — mustaqil loyiha. NASA ma’lumotlaridan foydalanadi; NASA mahsuloti emas. Javoblarda AI qo‘llanadi, dalillar Library’da tekshiriladi.':'Fire Atlas is an independent project using NASA data, not a NASA product. AI is used for answers; verify evidence in Library.'}</p>
      <p>{uz?'Xotirani chat ichidagi boshqaruvdan ko‘rish va o‘chirish mumkin.':'Memory can be reviewed and removed inside each chat.'}</p>
    </section></div>}
  </div>;
}

function Chat({language,selected,navigate,action,handoff,collapsed,inspect,onEvidence}){
  const uz=language==='uz';
  const [history,setHistory]=useState([]),[chat,setChat]=useState(null),[q,setQ]=useState(''),[draft,setDraft]=useState('');
  const [pending,setPending]=useState(null),[error,setError]=useState(''),[archived,setArchived]=useState(false);
  const [progress,setProgress]=useState('');
  const [creating,setCreating]=useState(false);
  const [memory,setMemory]=useState([]),[memo,setMemo]=useState(''),[kind,setKind]=useState('goal');
  const [showMemory,setShowMemory]=useState(false);
  const active=useRef(null);
  const bottom=useRef(null),composer=useRef(null),fileInput=useRef(null);
  const [attachments,setAttachments]=useState([]),[uploading,setUploading]=useState(false);
  useEffect(()=>{if(!attachments.some(a=>['QUEUED','RUNNING'].includes(a.state)))return;const timer=setInterval(()=>api('assets').then(items=>setAttachments(old=>old.map(a=>items.find(b=>b.id===a.id)||a))).catch(report),1500);return()=>clearInterval(timer);},[attachments]);
  async function attach(files){setUploading(true);setError('');try{for(const file of [...files].slice(0,3-attachments.length)){if(file.size>8000000)throw Error('Fayl 8 MB dan kichik bo‘lishi kerak');const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('FILE_READ_FAILED'));reader.readAsDataURL(file);});const item=await api('assets','POST',{name:file.name,base64});setAttachments(old=>[...old.filter(a=>a.id!==item.id),item]);}}catch(e){report(e);}finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}}
  const attachmentBusy=uploading||attachments.some(a=>['QUEUED','RUNNING','FAILED'].includes(a.state)||a.chunk_count===0);
  const [editing,setEditing]=useState(false);
  useEffect(()=>{if(action&&!active.current){setAttachments([]);void create().catch(report);}},[action]);
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
    if(ids.length){const items=await api('assets');setAttachments(items.filter(a=>ids.includes(a.id)));}
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
  async function send(event){
    event.preventDefault();
    if(active.current||!draft.trim()||attachmentBusy)return;
    const previous=lastRequest.current;
    const signature=attachments.map(a=>a.id).join(',');
    const job=previous?.question===draft&&previous.chat===chat?.id&&previous.signature===signature?previous:{id:requestId(),chat:chat?.id,question:draft,signature};
    lastRequest.current=job;
    active.current=job;setError('');setPending(job);
    try{
      job.chat??=(await create()).id;
      const result=await api('chats/'+job.chat+'/turns','POST',{question:draft,language,request_id:job.id,trials:selected,asset_ids:attachments.map(a=>a.id)},
        event=>setProgress(event==='retrieval.ready'?(uz?'Dalillar tekshirildi':'Evidence checked'):event==='run.started'?(uz?'Qidirilmoqda…':'Searching…'):''));
      if(result.state==='FAILED')setError(readableError({message:result.error},language));
      if(result.state!=='RUNNING')lastRequest.current=null;
      setDraft('');await select(job.chat);await refresh();
    }catch(e){report(e);}
    finally{active.current=null;setPending(null);}
  }
  async function loadMemory(){setMemory(await api('memory'));}
  useEffect(()=>{const result=chat?.turns?.filter(t=>t.result).at(-1);onEvidence(result?{sources:result.result.evidence,id:result.id}:null);},[chat?.id,chat?.turns?.length]);
  const empty=!chat?.turns?.length&&!pending;
  const historyPanel=<div className="chat-history"><p className="eyebrow">{uz?'Suhbatlar':'Recent chats'}</p>
      <label>{uz?'Tarixdan qidirish':'Search history'}<input value={q} onChange={e=>setQ(e.target.value)}/></label>
      <label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>{uz?'Arxiv':'Archive'}</label>
      {history.map(item=><button key={item.id} disabled={!!pending} aria-pressed={chat?.id===item.id} onClick={()=>{setAttachments([]);void select(item.id).catch(report);}}>{item.title}</button>)}
      {history.length>=100&&<button onClick={()=>void api('chats?'+new URLSearchParams({q,archived:archived?'1':'0',cursor:history.at(-1).id})).then(items=>setHistory([...history,...items])).catch(report)}>Load more</button>}
    </div>;
  return <section className={'forge-chat '+(empty&&!draft.trim()?'is-empty':'has-messages')}>
    {document.getElementById('forge-history-slot')&&createPortal(historyPanel,document.getElementById('forge-history-slot'))}
    <div className="chat-canvas">
      {empty&&<div className="welcome"><a className="welcome-mark nasa-source-mark" href="https://psi.nasa.gov/physci/repo" target="_blank" rel="noreferrer" aria-label="NASA data source"><img src="/nasa-logo.svg" alt="NASA"/></a><p className="eyebrow">NASA EVIDENCE · YOUR CURIOSITY</p><h1>{uz?'Savolingizdan boshlaymiz.':'Start with a question.'}</h1><p>{uz?'Tadqiqotlarni izlang. Dalillarni solishtiring. Birgalikda tushuning.':'Explore research. Compare evidence. Understand together.'}</p></div>}
      {error&&<p role="alert">{error}</p>}
      {chat&&<header className="chat-toolbar"><h2>{chat.title}</h2><button onClick={()=>setEditing(!editing)} aria-expanded={editing}>{uz?'Suhbat sozlamalari':'Chat settings'}</button><div hidden={!editing}>
        <form onSubmit={event=>{event.preventDefault();void update({title:new FormData(event.currentTarget).get('title')}).catch(report);}}>
          <input key={chat.id+chat.version} name="title" aria-label={uz?'Chat nomi':'Chat title'} defaultValue={chat.title} maxLength={120}/>
          <button disabled={!!pending}>{uz?'Nomni saqlash':'Save name'}</button>
        </form>
        <button disabled={!!pending} onClick={()=>void update({archived:!chat.archived}).catch(report)}>{chat.archived?'Restore':'Archive'}</button>
        <button disabled={!!pending} onClick={()=>{if(window.confirm(uz?'Chat o‘chirilsinmi?':'Delete chat?'))void api('chats/'+chat.id,'DELETE').then(()=>{setChat(null);return refresh();}).catch(report);}}>{uz?'O‘chirish':'Delete'}</button>
        <label><input type="checkbox" checked={chat.memory} disabled={!!pending} onChange={e=>void update({memory:e.target.checked}).catch(report)}/>{uz?'Shu chatda xotira':'Memory in this chat'}</label>
      </div></header>}
      {chat?.summary&&<details><summary>{uz?'Suhbat konteksti':'Thread context'}</summary><pre>{JSON.stringify(chat.summary.entries,null,2)}</pre></details>}
      <button className="memory-toggle" onClick={()=>{setShowMemory(!showMemory);if(!showMemory)void loadMemory().catch(report);}}>{uz?'Xotirani boshqarish':'Manage memory'}</button>
      {showMemory&&<div>
        <button onClick={()=>void api('memory','DELETE').then(loadMemory).catch(report)}>{uz?'Barcha xotirani unutish':'Forget all memory'}</button>
        <form onSubmit={e=>{e.preventDefault();void api('memory','POST',{kind,text:memo,consent:true}).then(()=>{setMemo('');return loadMemory();}).catch(report);}}>
          <select value={kind} onChange={e=>setKind(e.target.value)} aria-label="Memory type">{['goal','language','format','conditions'].map(k=><option key={k}>{k}</option>)}</select>
          <input aria-label="Memory" value={memo} onChange={e=>setMemo(e.target.value)} required maxLength={400}/>
          <button>{uz?'Xotiraga saqlash':'Remember'}</button>
        </form>
        {memory.map(item=><form key={item.id+item.version} onSubmit={e=>{
          e.preventDefault();const data=new FormData(e.currentTarget);
          void api('memory/'+item.id,'PATCH',{kind:item.kind,text:data.get('text'),enabled:data.has('enabled'),version:item.version}).then(loadMemory).catch(report);
        }}><label>{item.kind}<input name="text" defaultValue={item.text}/></label>
          <label><input name="enabled" type="checkbox" defaultChecked={item.enabled}/>{uz?'Faol':'Enabled'}</label>
          <button>{uz?'Saqlash':'Save'}</button>
          <button type="button" onClick={()=>void api('memory/'+item.id,'DELETE').then(loadMemory).catch(report)}>{uz?'Unutish':'Forget'}</button>
        </form>)}
      </div>}
      <div className="forge-turns" aria-live="polite">
        
        {chat?.turns?.map(turn=><article key={turn.id} className="chat-turn"><div className="user-message"><p>{turn.question}</p><div className="message-actions"><button aria-label="Copy question" onClick={()=>void copyText(turn.question).catch(report)}><Copy size={14}/></button><button aria-label="Edit question" disabled={!!pending} onClick={()=>{setDraft(turn.question);composer.current?.focus();}}><Pencil size={14}/></button></div></div><div className="assistant-message">
          {turn.result?<><div className="answer-heading"><span className="answer-mark">F</span><strong>Fire Atlas</strong><small>{turn.result.duration_ms?`${(turn.result.duration_ms/1000).toFixed(1)} s`:turn.result.model?'AI':'Local'} · {turn.result.status}</small></div>
            {turn.result.status==='INSUFFICIENT_EVIDENCE'&&<p>{uz?'Ulangan manbalarda ushbu savolga javob berish uchun yetarli dalil yo‘q. Boshqa sinov yoki sharoitni tanlang.':'The connected corpus has insufficient evidence for this question. Select another trial or condition.'}</p>}
            {turn.result.claims.map((claim,i)=><p key={i}>{claim.kind&&<small>{claim.kind==='AI_INTERPRETATION'?(uz?'AI rasm talqini':'AI visual interpretation'):claim.kind==='USER_REPORTED'?(uz?'Yuklangan manba':'Uploaded source'):claim.kind==='SOURCE_FINDING'?(uz?'Manbali natija':'Source finding'):claim.kind} · </small>}{claim.text} {claim.evidence_ids.map(id=><a key={id} href={'#'+turn.id+'-'+id}
              onClick={()=>{const detail=document.getElementById(turn.id+'-'+id);if(detail)detail.open=true;}}>[{turn.result.evidence.findIndex(source=>source.id===id)+1}] </a>)}</p>)}
            <AnswerExtras evidence={turn.result.evidence}/>
            {turn.result.evidence.map(source=><details key={source.id} id={turn.id+'-'+source.id}><summary>{source.studyId} · {source.locator}</summary><pre>{source.text}</pre><button onClick={()=>inspect([source])}>{uz?'Library’da belgilab ko‘rish':'Highlight in Library'}</button><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.kind==='USER_UPLOAD'?'Uploaded source':'NASA'}</a></details>)}
            <small>{turn.corpus_snapshot_id.slice(0,12)} · {turn.result.model||'Local'} · {turn.memory_ids?.length||0} {uz?'xotira bandi':'memory items'}</small>
            <button onClick={()=>void copyText(turn.result.claims.map(claim=>claim.text+' '+claim.evidence_ids.map(id=>{const source=turn.result.evidence.find(s=>s.id===id);return source?'['+source.locator+']('+source.sourceUrl+')':'';}).join(' ')).join('\n\n')).catch(report)}>Copy</button>
            <button onClick={()=>inspect(turn.result.evidence)}>Library · {uz?'Dalilni tekshirish':'Verify evidence'}</button>
            <button onClick={()=>navigate('tools')}>Tools</button>
          </>:<p>{turn.state} {readableError({message:turn.error},language)}</p>}
          {['FAILED','CANCELLED','INTERRUPTED'].includes(turn.state)&&<button onClick={()=>setDraft(turn.question)}>{uz?'Qayta urinish':'Retry'}</button>}
        </div></article>)}
        {pending&&<article className="chat-turn pending-turn"><div className="user-message"><p>{pending.question}</p></div><div className="assistant-message"><p role="status" className="thinking"><span/>{progress|| (uz?'Manbalar ko‘rib chiqilmoqda…':'Reviewing sources…')}</p></div></article>}
        <div ref={bottom}/>
      </div>
      <form className="chat-composer" onSubmit={send}>
        <input ref={fileInput} type="file" hidden multiple accept=".pdf,.docx,.txt,.csv,.json,.png,.jpg,.jpeg" onChange={e=>void attach(e.target.files)}/>
        {attachments.length>0&&<div className="attachment-list">{attachments.map(a=><div key={a.id}><strong>{a.name}</strong><small>{a.state==='READY'?'Tayyor':a.state==='PARTIAL'?'Qisman tayyor':a.state==='FAILED'?'Xato':'Ingestion…'} {a.error||''}</small><button type="button" disabled={!!pending} aria-label={'Remove '+a.name} onClick={()=>setAttachments(old=>old.filter(b=>b.id!==a.id))}>×</button></div>)}</div>}
        {uploading&&<p role="status">{uz?'Fayl yuklanmoqda…':'Uploading file…'}</p>}

        <label>{uz?'Tadqiqot haqida savol':'Ask about an experiment'}
          <textarea ref={composer} placeholder={uz?'Savolingizni yozing…':'Write your question…'} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={300} required disabled={!!pending||creating||chat?.archived}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form.requestSubmit();}}}/>
        </label>
        <div className="composer-bottom"><button type="button" className="icon-button" aria-label="Attach files" disabled={uploading||!!pending||attachments.length>=3} onClick={()=>fileInput.current?.click()}><Plus size={20}/></button><small>{attachments.length?(uz?'Biriktirilgan fayllar bo‘yicha · rasmlar AI orqali tahlil qilinadi':'Attached sources only · images analyzed with AI'):(uz?'Javoblar ulangan manbalarga asoslanadi':'Answers grounded in connected sources')}</small><button className="send-button" aria-label={uz?'Yuborish':'Send'} disabled={!draft.trim()||!!pending||creating||attachmentBusy||chat?.archived}><ArrowUp size={19}/></button></div>
        {pending&&<button type="button" onClick={()=>{const job=active.current;if(job?.chat)void api('chats/'+job.chat+'/cancel','POST',{request_id:job.id}).catch(report);}}>{uz?'To‘xtatish':'Stop'}</button>}
      </form>
    </div>
  </section>;
}

function AnswerExtras({evidence}){
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
    {comparison&&<div className="answer-comparison"><p>Manbali taqqoslash · Table 7.1</p><table><thead><tr><th>O‘lchov</th>{comparison.trials.map(t=><th key={t.trial_id}>{t.trial_id}</th>)}</tr></thead><tbody>{comparison.rows.map(row=><tr key={row.field}><th>{row.field}</th>{row.values.map((value,i)=><td key={i}>{value??'Unknown'}</td>)}</tr>)}<tr><th>Natija</th>{comparison.trials.map(t=><td key={t.trial_id}><a href={t.sources[0].url} target="_blank" rel="noreferrer">{t.outcome.raw_display}</a></td>)}</tr></tbody></table></div>}
  </>;
}

function EvidenceReader({focus,language}){
  const [current,setCurrent]=useState(0),[part,setPart]=useState(null),[error,setError]=useState('');
  useEffect(()=>{setCurrent(0);},[focus]);
  const source=focus?.sources?.[current];
  useEffect(()=>{setPart(null);setError('');if(!source)return;const id=(source.fileUrl||source.sourceUrl||'').match(/assets\/([0-9a-f]+)\//)?.[1];if(!id)return;let live=true;api('assets/'+id+'/excerpt?'+new URLSearchParams({locator:source.locator})).then(p=>{if(live)setPart(p);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[source]);
  if(!focus)return null;
  const text=part?.text||source?.text||'';
  const start=source?text.indexOf(source.text):-1;
  return <section id="evidence-reader" className="evidence-reader" tabIndex={-1}><p className="eyebrow">{language==='uz'?'JAVOB → ASL DALIL':'ANSWER → SOURCE EVIDENCE'}</p><h2>{language==='uz'?'Dalilni tekshiring':'Verify the evidence'}</h2><button onClick={()=>download('evidence.json',JSON.stringify({sources:focus.sources},null,2))}>{language==='uz'?'Dalillarni eksport qilish':'Export evidence'}</button>
    {!source?<p>{language==='uz'?'Bu javobga manba biriktirilmagan.':'No source attached to this answer.'}</p>:<>
    <nav aria-label="Answer sources">{focus.sources.map((s,i)=><button key={s.id} aria-pressed={i===current} onClick={()=>setCurrent(i)}>{s.file||s.studyId} · {s.locator}</button>)}</nav>
    <h3>{part?.name||source.file||source.studyId}</h3><details><summary>Evidence ID</summary><code>{source.id}</code></details><p>{source.locator}</p>
    <p>{language==='uz'?'Sariq belgi — javobga dalil bo‘lgan ajratilgan matn. Asl faylni quyidagi havoladan solishtiring.':'Yellow marks the extracted passage used as evidence. Compare it with the original file below.'}</p>
    {source.interpretation&&<p>{language==='uz'?'AI rasm talqini — asl rasm bilan tekshiring; bu o‘lchangan ilmiy natija emas.':'AI visual interpretation — verify against the original image; this is not a measured finding.'}</p>}
    {error&&<p role="alert">{error}</p>}
    <pre>{start>=0?<>{text.slice(0,start)}<mark>{source.text}</mark>{text.slice(start+source.text.length)}</>:<mark>{source.text}</mark>}</pre>
    <a href={source.sourceUrl} target="_blank" rel="noreferrer">{language==='uz'?'Asl fayl va sahifani ochish':'Open original file and page'} ↗</a>
    {part?.mime==='application/pdf'&&<details><summary>{language==='uz'?'Asl PDF sahifasini shu yerda ochish':'View original PDF here'}</summary><iframe title={part.name+' '+source.locator} src={source.sourceUrl} loading="lazy" style={{width:'100%',height:500,border:0}}/></details>}
    {part?.mime?.startsWith('image/')&&<img src={part.original} alt={part.name}/>}
    </>}
  </section>;
}

const trialOptions=BASS_THREE.rows.map(row=>({id:row.study_id+':'+row.trial_id,title:row.trial_id}));
function TrialPicker({selected,onChange}){
  return <fieldset><legend>Trials</legend>{trialOptions.map(({id,title})=><label key={id}><input type="checkbox" checked={selected.includes(id)}
    onChange={e=>onChange(e.target.checked?[...selected,id]:selected.filter(item=>item!==id))}/>{title}</label>)}</fieldset>;
}

function Library({language,selected,setSelected,ask,evidenceFocus,visible}){
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
    if(file.size>8_000_000){setError('ASSET_SIZE_LIMIT_8MB');return;}
    setAssetBusy(true);setError('');
    try{
      const base64=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('FILE_READ_FAILED'));reader.readAsDataURL(file);
      });
      await api('assets','POST',{name:file.name,base64});await refresh();
    }catch(error){report(error);}finally{setAssetBusy(false);}
  }
  return <section className="forge-pane">
    <EvidenceReader focus={evidenceFocus} language={language}/><div className="library-heading"><p className="eyebrow">YOUR RESEARCH SPACE</p><h1>Library</h1><p>{language==='uz'?'Manbalarni o‘zingiz o‘rganing. Har bir dalilning aslini ko‘ring.':'Explore the research yourself. See the source behind every claim.'}</p></div>{error&&<p role="alert">{error}</p>}
    <form className="library-search" onSubmit={event=>{event.preventDefault();void api('search','POST',{query:find}).then(data=>setFound(data.results)).catch(report);}}>
      <label>{language==='uz'?'Tajriba nomi yoki PSI ID bo‘yicha qidirish':'Search experiment name or PSI ID'}<input value={find} onChange={e=>setFind(e.target.value)} maxLength={300} required/></label>
      <button>{language==='uz'?'Qidirish':'Search'}</button><button type="button" onClick={()=>{setFind('');setFound(null);setStudyOpen(null);}}>{language==='uz'?'Tozalash':'Clear'}</button>
    </form>
    <div className="library-filters">{[['all','Barchasi'],['experiment','Tajribalar'],['model','Modellar']].map(([id,label])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}<button onClick={()=>ask(find||'Ulangan tadqiqotlar haqida tushuntiring')}>Hybrid AI’dan so‘rash ↗</button></div>
    {found?.length===0&&<p>{language==='uz'?'Ulangan korpusda mos dalil topilmadi.':'No matching evidence in the connected corpus.'}</p>}
    {found?.map(source=><details key={source.id}><summary>{source.studyId} · {source.trialId||source.locator}</summary>
      <pre>{source.text}</pre><a href={source.fileUrl||source.sourceUrl} target="_blank" rel="noreferrer">{source.locator}</a>
    </details>)}
    <h3>{language==='uz'?'Ulangan tadqiqotlar':'Connected studies'} · {studies.length}</h3><p className="corpus-note">{language==='uz'?'Bu — tanlangan metadata, jadvallar va media to‘plami. Tadqiqotlarning barcha fayllari yuklangan emas.':'Selected metadata, tables and media; these are not complete downloads of every study.'}</p>
    <div className="study-grid">{visibleStudies.map(study=><button key={study.id} className="study-card" onClick={()=>setStudyOpen(study.id)}>
      <div className="study-cover">{study.files.some(f=>f.media?.startsWith('image/'))?<img src={study.files.find(f=>f.media?.startsWith('image/')).url} alt={study.title}/>:<BookOpen size={34}/>}<span>{study.kind==='GROUND_CFD'?'MODEL':'EXPERIMENT'}</span></div>
      <div className="study-card-body"><small>{study.id} · v{study.version}</small><h3>{study.title}</h3><p>{study.description}</p><span>{study.files.length} files · {language==='uz'?'O‘rganish':'Explore'} ↗</span></div>
    </button>)}</div>
    {visibleStudies.length===0&&<div className="empty-library"><p>{language==='uz'?'Bu nom bilan tajriba topilmadi. Boshqa nom yoki PSI ID kiriting.':'No experiment matches this name. Try another name or PSI ID.'}</p><button onClick={()=>ask(find)}>Hybrid AI’dan so‘rash ↗</button></div>}
    {studyOpen&&studies.filter(s=>s.id===studyOpen).map(study=><section className="study-detail" key={study.id}>
      <button onClick={()=>setStudyOpen(null)}>← Library</button><p className="eyebrow">{study.id} · {study.kind}</p><h2>{study.title}</h2>
      <div className="study-detail-layout"><div>{study.files.filter(file=>file.media).map(file=><figure key={file.name}>{file.media.startsWith('image/')?<img src={file.url} alt={file.name}/>:file.media.startsWith('video/')?<video controls src={file.url}/>:null}<figcaption>{file.name}</figcaption></figure>)}</div><div><h3>{language==='uz'?'Tadqiqot haqida':'About the study'}</h3><p>{study.description}</p><h3>{language==='uz'?'Metodika':'Method'}</h3><p>{study.approach}</p></div></div>
      <a href={study.sourceUrl} target="_blank" rel="noreferrer">NASA · DOI {study.doi} · v{study.version}</a>
      <ul>{study.files.map(file=><li key={file.name}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a> · {file.bytes.toLocaleString()} bytes</li>)}</ul>
      <button onClick={()=>ask(study.title+' tadqiqotining maqsadi va natijalarini manbalari bilan tushuntiring')}>Hybrid AI’dan so‘rash ↗</button>
    </section>)}
    <h3>{language==='uz'?'Mening hujjatlarim':'My documents'}</h3><p>{language==='uz'?'8 MB gacha. PDF matni va dastlabki 3 ta ichki rasm tahlil qilinadi; cheklovlar faylda ko‘rsatiladi. AI talqinlari mustaqil tekshirilmagan.':'Up to 8 MB. PDF text and up to 3 embedded images are analyzed; file limitations are shown. AI interpretations are unverified.'}</p>
    <label>{language==='uz'?'Fayl import qilish':'Import document'} · 8 MB
      <input type="file" disabled={assetBusy} accept=".pdf,.docx,.txt,.csv,.json,.jpg,.jpeg,.png,.mp4,.webm"
        onChange={e=>void upload(e.target.files[0])}/>
    </label>
    {assets.map(asset=><details key={asset.id}>
      <summary>{asset.name} · {asset.state} · {asset.chunk_count}</summary>
      {asset.error&&<p>{asset.error}</p>}
      {asset.limit&&<p>{asset.limit}</p>}
      <a href={'/api/workspace/assets/'+asset.id+'/original'} target="_blank" rel="noreferrer">Original</a>
      {asset.mime.startsWith('image/')&&<img width="240" src={'/api/workspace/assets/'+asset.id+'/original'} alt={asset.name}/>}
      {asset.mime.startsWith('video/')&&<><video width="320" controls preload="metadata" src={'/api/workspace/assets/'+asset.id+'/original'}
        onError={event=>{event.currentTarget.nextElementSibling.hidden=false;}}/>
        <p hidden>{language==='uz'?'Videoni shu brauzerda ijro etib bo‘lmadi. Asl faylni yuklab oching.':'This browser could not play the video. Download the original file.'}</p></>}
      {asset.extraction.map((part,index)=><p key={index}>{part.locator} · {part.status}</p>)}
      <button onClick={()=>void api('assets/'+asset.id,'DELETE').then(refresh).catch(report)}>{language==='uz'?'O‘chirish':'Delete'}</button>
    </details>)}
    <h3>BASS-II · PSI-25</h3><TrialPicker selected={selected} onChange={setSelected}/>
    <div>{selected.map(id=><button key={id} onClick={()=>{
      const pin=pins.find(item=>item.trial===id);
      void (pin?api('pins/'+pin.id,'DELETE'):api('pins','POST',{trial:id})).then(refresh).catch(report);
    }}>{pins.some(item=>item.trial===id)?'Unpin':'Pin'} {id}</button>)}</div>
    <button disabled={!selected.length} onClick={()=>void api('compare','POST',{trials:selected}).then(setComparison).catch(report)}>Compare</button>
    {comparison&&<div><table><thead><tr><th>Measurement</th><th>Status</th>{comparison.trials.map(t=><th key={t.trial_id}>{t.trial_id}</th>)}</tr></thead>
      <tbody>{comparison.rows.map(row=><tr key={row.field}><th>{row.field}</th><td>{row.status}</td>{row.values.map((v,i)=><td key={i}>{v||'Unknown'}</td>)}</tr>)}
        <tr><th>Outcome</th><td></td>{comparison.trials.map(t=><td key={t.trial_id}>{t.outcome.raw_display} <a href={t.sources[0].url}>NASA</a></td>)}</tr></tbody></table>
      <button onClick={()=>download('comparison.json',JSON.stringify(comparison,null,2))}>Export JSON</button></div>}
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
      {proposal.candidates.map((item,index)=><p key={index}>{item.id} · {item.kind} · {item.applicability} · {item.locator}</p>)}
    </details>}
    {shelves.map(shelf=><details key={shelf.id}><summary>{shelf.name} · {shelf.mode} · {shelf.members.length}</summary>
      {shelf.stale&&<p>Stale · <button onClick={()=>void api('shelves/'+shelf.id,'PATCH',{...shelf}).then(refresh).catch(report)}>Refresh membership</button></p>}
      <ul>{shelf.members.map(id=><li key={id}>{id} <button onClick={()=>void api('shelves/'+shelf.id,'PATCH',{...shelf,exclusions:[...shelf.exclusions,id]}).then(refresh).catch(report)}>Exclude</button></li>)}</ul>
      {shelf.reasons.map((reason,i)=><p key={i}>{reason.trial} · {reason.kind} · {reason.locator}</p>)}
    </details>)}
  </section>;
}

function Tools({language,trials,setTrials}){
  const [tool,setTool]=useState('ranking'),[target,setTarget]=useState(''),[assumptions,setAssumptions]=useState('');
  const [runs,setRuns]=useState([]),[current,setCurrent]=useState(null),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),[weights,setWeights]=useState({domain:25,fuel:25,atmosphere:25,unit_family:25});
  const [proposal,setProposal]=useState(null);
  const report=e=>setError(readableError(e,language));
  useEffect(()=>{void api('runs').then(setRuns).catch(report);},[]);
  async function run(e){
    e.preventDefault();setBusy(true);setError('');
    try{
      const form=new FormData(e.currentTarget);
      const synthetic=form.has('synthetic')?{n:Number(form.get('n')),k:Number(form.get('k')),a:Number(form.get('a')),b:Number(form.get('b'))}:undefined;
      const definition=await api('analyses','POST',{tool,target,assumptions:assumptions.split('\n').filter(Boolean),trials,weights,synthetic,
        entity_type:form.get('entity_type'),rank_mode:form.get('rank_mode')});
      const result=await api('analyses/'+definition.id+'/run','POST',{request_id:requestId()});
      setCurrent(result);setRuns(await api('runs'));
    }catch(e){report(e);}finally{setBusy(false);}
  }
  const uz=language==='uz';
  return <section className="forge-pane"><h2>Tools</h2>{error&&<p role="alert">{error}</p>}
    <form onSubmit={run}>
      <label>{uz?'Tahlil turi':'Tool'}<select value={tool} onChange={e=>setTool(e.target.value)}>
        <option value="ranking">Evidence Rank</option><option value="estimation">Estimate Lab</option><option value="scenario">Scenario Lab</option>
      </select></label>
      <label>{uz?'Maqsad':'Target'}<input value={target} onChange={e=>setTarget(e.target.value)} maxLength={500} required/></label>
      <button type="button" disabled={busy||!target.trim()} onClick={async()=>{
        setBusy(true);
        try{
          const plan=await api('analysis-preview','POST',{tool,target,language});
          setProposal(plan);setWeights(plan.weights);setAssumptions(plan.assumptions.join('\n'));
        }catch(error){report(error);}finally{setBusy(false);}
      }}>{uz?'AI bilan sozlamani tayyorlash':'Prepare configuration with AI'}</button>
      {proposal&&<p>{proposal.explanation}</p>}
      {tool==='ranking'&&<><label>Entity<select name="entity_type"><option>TRIAL</option><option>STUDY</option><option>MATERIAL</option></select></label>
        <label>Rank mode<select name="rank_mode"><option>RESEARCH_USEFULNESS</option><option>MEASURED_PERFORMANCE</option></select></label>
        {Object.entries(weights).map(([key,value])=><label key={key}>{key}<input type="number" min="0" max="100" value={value} onChange={e=>setWeights({...weights,[key]:Number(e.target.value)})}/></label>)}</>}
      {tool==='estimation'&&<fieldset><legend>Synthetic Beta-binomial exercise</legend>
        <label><input name="synthetic" type="checkbox"/>Use synthetic inputs</label>
        {Object.entries({n:10,k:3,a:1,b:1}).map(([key,value])=><label key={key}>{key}<input name={key} type="number" defaultValue={value}/></label>)}
      </fieldset>}
      {tool==='scenario'&&<><TrialPicker selected={trials} onChange={setTrials}/><label>{uz?'Farazlar':'Assumptions'}<textarea value={assumptions} onChange={e=>setAssumptions(e.target.value)}/></label></>}
      <button disabled={busy}>{uz?'Hisoblash va saqlash':'Run and save'}</button>
    </form>
    <label>{uz?'Saqlangan natijalar':'Saved runs'}<select value={current?.id??''} onChange={e=>{
      if(!e.target.value){setCurrent(null);return;}
      void api('runs/'+e.target.value).then(setCurrent).catch(report);
    }}>
      <option value="">—</option>{runs.map(item=><option key={item.id} value={item.id}>{item.definition.tool} · {item.definition.target}</option>)}
    </select></label>
    {current&&<article><h3>{current.result.synthetic?'Synthetic exercise · ':''}{current.result.status} · {current.result.method}</h3><p>{current.definition.target}</p>
      {current.stale&&<p>Stale · {current.corpus_snapshot_id.slice(0,12)}</p>}
      <button disabled={busy} onClick={()=>void api('analyses/'+current.analysis+'/run','POST',{request_id:requestId()})
        .then(async result=>{setCurrent(result);setRuns(await api('runs'));}).catch(report)}>Run again</button>
      {current.result.results?<table><thead><tr><th>Trial</th><th>Tier</th><th>Alignment score</th><th>Evidence</th></tr></thead><tbody>
        {current.result.results.map(item=><tr key={item.id}><th>{item.id}</th><td>{item.tier}</td><td>{item.score}%</td>
          <td><details><summary>Why this rank</summary><p>{item.tier_reason}</p><pre>{JSON.stringify(item.checklist,null,2)}</pre>
            {item.sources.map(s=><a key={s.source_ref_id} href={s.url}>{s.row_id}</a>)}</details></td></tr>)}
      </tbody></table>:current.result.scenarios?<div>
        <p>{current.result.notice}</p>
        {current.result.observations.map(observation=><p key={observation.trial}>
          <strong>{observation.trial}</strong> · {observation.outcome}{' '}
          {observation.sources.map(source=><a key={source.source_ref_id} href={source.url} target="_blank" rel="noreferrer">
            Table {source.table} · {source.row_id}
          </a>)}
        </p>)}
        {current.result.scenarios.map((scenario,index)=><article key={index}>
          <h4>{scenario.assumption}</h4><p>{scenario.outcome}</p><p>{scenario.rationale}</p>
          <p><strong>{uz?'Keyingi o‘lchov':'Next measurement'}</strong> · {scenario.next_measurement}</p>
          <p>{uz?'Miqdoriy ehtimolni hisoblash uchun mos model va mustaqil tajribalar kerak.':'A quantitative probability requires an applicable model and independent observations.'}</p>
        </article>)}
      </div>:<div>
        {current.result.synthetic&&<><p><strong>{uz?'Sintetik ma’lumot':'Synthetic data'}</strong> · k = {current.result.k}, n = {current.result.n}</p>
          <p>Beta({current.result.prior.alpha}, {current.result.prior.beta}) → Beta({current.result.posterior.alpha}, {current.result.posterior.beta})</p>
          <p>{uz?'Posterior o‘rtacha':'Posterior mean'} · {(100*current.result.estimate).toFixed(2)}%</p>
          <p>95% credible interval · {(100*current.result.interval[0]).toFixed(2)}% – {(100*current.result.interval[1]).toFixed(2)}%</p></>}
        {current.result.limitations?.map((limitation,index)=><p key={index}>{limitation}</p>)}
        {current.result.next_measurement&&<p><strong>{uz?'Keyingi o‘lchov':'Next measurement'}</strong> · {current.result.next_measurement}</p>}
      </div>}
      <details><summary>{uz?'Usul va hisob yozuvi':'Method and calculation record'}</summary><pre>{JSON.stringify(current.result,null,2)}</pre></details>
      <button onClick={async()=>{
        try{
          const latest=await api('runs/'+current.id);
          setCurrent(latest);
          download('analysis-run.json',JSON.stringify(latest,null,2));
        }catch(error){report(error);}
      }}>Export JSON</button>
    </article>}
  </section>;
}
