import React,{useEffect,useState,useRef} from 'react';
import Atlas,{download} from './Atlas.jsx';
import {BASS_THREE} from '../data/index.js';
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

export default function Workspace(){
  const [ready,setReady]=useState(false),[page,setPage]=useState('library'),[language,setLanguage]=useState('uz');
  const [selected,setSelected]=useState([]);
  useEffect(()=>{void api('session','POST',{}).then(()=>setReady(true)).catch(()=>{});},[]);
  if(!ready)return <Atlas/>;
  return <div className="forge-workspace">
    <header><strong>SKYFORGE <span>Fire Atlas</span></strong><nav aria-label="Workspace">
      {[['chat','Ask AI'],['library','Library'],['tools','Tools']].map(([key,title])=><button key={key} aria-pressed={page===key} onClick={()=>setPage(key)}>{title}</button>)}
      <button onClick={()=>setLanguage(language==='uz'?'en':'uz')}>{language==='uz'?'English':'O‘zbekcha'}</button>
    </nav></header>
    <p className="forge-pane">{language==='uz'?'Tanlangan sinovlar':'Selected trials'} · {selected.join(', ')||'—'}
      {selected.length>0&&<button onClick={()=>setSelected([])}>{language==='uz'?'Tozalash':'Clear'}</button>}</p>
    <div hidden={page!=='chat'}><Chat language={language} selected={selected} navigate={setPage}/></div>
    <div hidden={page!=='library'}><Library language={language} selected={selected} setSelected={setSelected}/>
      <details className="forge-pane"><summary>{language==='uz'?'Atlas, import va Notebook':'Measurement Atlas, import and Notebook'}</summary><Atlas/></details>
    </div>
    <div hidden={page!=='tools'}><Tools language={language} trials={selected} setTrials={setSelected}/></div>
  </div>;
}

function Chat({language,selected,navigate}){
  const uz=language==='uz';
  const [history,setHistory]=useState([]),[chat,setChat]=useState(null),[q,setQ]=useState(''),[draft,setDraft]=useState('');
  const [pending,setPending]=useState(null),[error,setError]=useState(''),[archived,setArchived]=useState(false);
  const [progress,setProgress]=useState('');
  const [creating,setCreating]=useState(false);
  const [memory,setMemory]=useState([]),[memo,setMemo]=useState(''),[kind,setKind]=useState('goal');
  const [showMemory,setShowMemory]=useState(false);
  const active=useRef(null);
  const lastRequest=useRef(null);
  const report=e=>setError(e.message);
  function refresh(){
    return api('chats?'+new URLSearchParams({q,archived:archived?'1':'0'})).then(setHistory);
  }
  useEffect(()=>{void refresh().catch(report);},[q,archived]);
  async function select(id){
    const selected=await api('chats/'+id);
    setChat(selected);setError('');
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
    if(active.current||!draft.trim())return;
    const previous=lastRequest.current;
    const job=previous?.question===draft&&previous.chat===chat?.id?previous:{id:requestId(),chat:chat?.id,question:draft};
    lastRequest.current=job;
    active.current=job;setError('');setPending(job);
    try{
      job.chat??=(await create()).id;
      const result=await api('chats/'+job.chat+'/turns','POST',{question:draft,language,request_id:job.id,trials:selected},
        event=>setProgress(event==='retrieval.ready'?(uz?'Dalillar tekshirildi':'Evidence checked'):event==='run.started'?(uz?'Qidirilmoqda…':'Searching…'):''));
      if(result.state==='FAILED')setError(result.error);
      if(result.state!=='RUNNING')lastRequest.current=null;
      setDraft('');await select(job.chat);await refresh();
    }catch(e){report(e);}
    finally{active.current=null;setPending(null);}
  }
  async function loadMemory(){setMemory(await api('memory'));}
  return <section className="forge-pane forge-chat">
    <aside><h2>Ask AI</h2><button disabled={!!pending||creating} onClick={()=>void create().catch(report)}>New Chat</button>
      <label>{uz?'Tarixdan qidirish':'Search history'}<input value={q} onChange={e=>setQ(e.target.value)}/></label>
      <label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>{uz?'Arxiv':'Archive'}</label>
      {history.map(item=><button key={item.id} disabled={!!pending} aria-pressed={chat?.id===item.id} onClick={()=>void select(item.id).catch(report)}>{item.title}</button>)}
      {history.length>=100&&<button onClick={()=>void api('chats?'+new URLSearchParams({q,archived:archived?'1':'0',cursor:history.at(-1).id})).then(items=>setHistory([...history,...items])).catch(report)}>Load more</button>}
    </aside>
    <div>
      {error&&<p role="alert">{error}</p>}
      {chat&&<header><h2>{chat.title}</h2>
        <form onSubmit={event=>{event.preventDefault();void update({title:new FormData(event.currentTarget).get('title')}).catch(report);}}>
          <input key={chat.id+chat.version} name="title" aria-label={uz?'Chat nomi':'Chat title'} defaultValue={chat.title} maxLength={120}/>
          <button disabled={!!pending}>{uz?'Nomni saqlash':'Save name'}</button>
        </form>
        <button disabled={!!pending} onClick={()=>void update({archived:!chat.archived}).catch(report)}>{chat.archived?'Restore':'Archive'}</button>
        <button disabled={!!pending} onClick={()=>{if(window.confirm(uz?'Chat o‘chirilsinmi?':'Delete chat?'))void api('chats/'+chat.id,'DELETE').then(()=>{setChat(null);return refresh();}).catch(report);}}>{uz?'O‘chirish':'Delete'}</button>
        <label><input type="checkbox" checked={chat.memory} disabled={!!pending} onChange={e=>void update({memory:e.target.checked}).catch(report)}/>{uz?'Shu chatda xotira':'Memory in this chat'}</label>
      </header>}
      {chat?.summary&&<details><summary>{uz?'Suhbat konteksti':'Thread context'}</summary><pre>{JSON.stringify(chat.summary.entries,null,2)}</pre></details>}
      <button onClick={()=>{setShowMemory(!showMemory);if(!showMemory)void loadMemory().catch(report);}}>{uz?'Xotirani boshqarish':'Manage memory'}</button>
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
        {pending&&<p role="status">{progress|| (uz?'So‘rov bajarilmoqda…':'Request running…')}</p>}
        {chat?.turns?.map(turn=><article key={turn.id}><h3>{turn.question}</h3>
          {turn.result?<><p>{turn.result.status}</p>
            {turn.result.status==='INSUFFICIENT_EVIDENCE'&&<p>{uz?'Ulangan manbalarda ushbu savolga javob berish uchun yetarli dalil yo‘q. Boshqa sinov yoki sharoitni tanlang.':'The connected corpus has insufficient evidence for this question. Select another trial or condition.'}</p>}
            {turn.result.claims.map((claim,i)=><p key={i}>{claim.kind&&<small>{claim.kind} · </small>}{claim.text} {claim.evidence_ids.map(id=><a key={id} href={'#'+turn.id+'-'+id}
              onClick={()=>{const detail=document.getElementById(turn.id+'-'+id);if(detail)detail.open=true;}}>[{id.slice(0,6)}] </a>)}</p>)}
            {turn.result.evidence.map(source=><details key={source.id} id={turn.id+'-'+source.id}><summary>{source.studyId} · {source.locator}</summary><pre>{source.text}</pre><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.kind==='USER_UPLOAD'?'Uploaded source':'NASA'}</a></details>)}
            <small>{turn.corpus_snapshot_id.slice(0,12)} · {turn.result.model||'Local'} · {turn.memory_ids?.length||0} {uz?'xotira bandi':'memory items'}</small>
            <button onClick={()=>void copyText(turn.result.claims.map(claim=>claim.text).join('\n')).catch(report)}>Copy</button>
            <button onClick={()=>navigate('library')}>Library</button>
            <button onClick={()=>navigate('tools')}>Tools</button>
          </>:<p>{turn.state} {turn.error}</p>}
          {['FAILED','CANCELLED','INTERRUPTED'].includes(turn.state)&&<button onClick={()=>setDraft(turn.question)}>{uz?'Qayta urinish':'Retry'}</button>}
        </article>)}
      </div>
      <form onSubmit={send}>
        <label>{uz?'Tadqiqot haqida savol':'Ask about an experiment'}
          <textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={300} required disabled={!!pending||creating||chat?.archived}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form.requestSubmit();}}}/>
        </label>
        <button disabled={!!pending||creating||chat?.archived}>{uz?'Yuborish':'Send'}</button>
        {pending&&<button type="button" onClick={()=>{const job=active.current;if(job?.chat)void api('chats/'+job.chat+'/cancel','POST',{request_id:job.id}).catch(report);}}>{uz?'To‘xtatish':'Stop'}</button>}
      </form>
    </div>
  </section>;
}

const trialOptions=BASS_THREE.rows.map(row=>({id:row.study_id+':'+row.trial_id,title:row.trial_id}));
function TrialPicker({selected,onChange}){
  return <fieldset><legend>Trials</legend>{trialOptions.map(({id,title})=><label key={id}><input type="checkbox" checked={selected.includes(id)}
    onChange={e=>onChange(e.target.checked?[...selected,id]:selected.filter(item=>item!==id))}/>{title}</label>)}</fieldset>;
}

function Library({language,selected,setSelected}){
  const [shelves,setShelves]=useState([]),[pins,setPins]=useState([]),[comparison,setComparison]=useState(null);
  const [name,setName]=useState(''),[query,setQuery]=useState(''),[error,setError]=useState('');
  const [autoUpdate,setAutoUpdate]=useState(false);
  const [proposal,setProposal]=useState(null),[proposing,setProposing]=useState(false);
  const [assets,setAssets]=useState([]),[assetBusy,setAssetBusy]=useState(false);
  const [studies,setStudies]=useState([]);
  const [find,setFind]=useState(''),[found,setFound]=useState(null);
  const report=e=>setError(e.message);
  async function refresh(){const [s,p,a]=await Promise.all([api('shelves'),api('pins'),api('assets')]);setShelves(s);setPins(p);setAssets(a);}
  useEffect(()=>{void refresh().catch(report);},[]);
  useEffect(()=>{
    void fetch('/api/ingestion/studies').then(response=>response.json()).then(data=>setStudies(data.studies??[])).catch(()=>{});
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
    <h2>Library · Shelves and comparison</h2>{error&&<p role="alert">{error}</p>}
    <form onSubmit={event=>{event.preventDefault();void api('search','POST',{query:find}).then(data=>setFound(data.results)).catch(report);}}>
      <label>{language==='uz'?'Manbadan qidirish':'Find research'}<input value={find} onChange={e=>setFind(e.target.value)} maxLength={300} required/></label>
      <button>{language==='uz'?'Qidirish':'Search'}</button>
    </form>
    {found?.length===0&&<p>{language==='uz'?'Ulangan korpusda mos dalil topilmadi.':'No matching evidence in the connected corpus.'}</p>}
    {found?.map(source=><details key={source.id}><summary>{source.studyId} · {source.trialId||source.locator}</summary>
      <pre>{source.text}</pre><a href={source.fileUrl||source.sourceUrl} target="_blank" rel="noreferrer">{source.locator}</a>
    </details>)}
    <h3>{language==='uz'?'Ulangan tadqiqotlar':'Connected studies'} · {studies.length}</h3>
    {studies.map(study=><details key={study.id}>
      <summary>{study.id} · {study.title} · {study.kind}</summary>
      <p>{study.description}</p><p>{study.approach}</p>
      <a href={study.sourceUrl} target="_blank" rel="noreferrer">NASA · DOI {study.doi} · v{study.version}</a>
      <ul>{study.files.map(file=><li key={file.name}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a>
        {file.media?.startsWith('image/')&&<img src={file.url} width="240" alt={file.name}/>}
      </li>)}</ul>
    </details>)}
    <h3>BASS-II · PSI-25</h3>
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
    <TrialPicker selected={selected} onChange={setSelected}/>
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
  const report=e=>setError(e.message);
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
