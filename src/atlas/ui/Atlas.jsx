import React, {useState, useRef, useEffect} from 'react';
import {openAtlasStore, activeRecords, fieldEvidence, exportJSON, exportArchive, exportReportCSV, exportReportJSON, trialKey, parseQuery, addFilter, rankTrials, updateFilter, removeFilter, skipClarification, createMetadataAdapter, detectEvidenceGap, proposeReevaluation, commitReevaluation, cancelReevaluation} from '../core/index.js';
import {BASS_SEED, assessEvidenceGap, fieldProof, sourceReview, checkBoundedClaim} from '../data/index.js';
import catalog from '../catalog.json';
import {convertNasaTable} from '../nasa-import.js';
import t25 from '../data/GMT216-T25.csv?raw';
import './atlas.css';
import {readNotebooks, NOTEBOOK_KEY} from './notebook.js';

export function download(name, text, type='application/json') {
  const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const key=r=>trialKey(r.study_id,r.trial_id);
const metadataAdapter = createMetadataAdapter({studies:{'PSI-25':{
  environment:'FLIGHT_0G', domain:'PREVENTION_SOLID', fuel_type:'SOLID_FABRIC',
}}});
async function requestJSON(url, options){
  const response=await fetch(url,options);
  const result=await response.json();
  if(!response.ok) throw new Error(result.error||'REQUEST_FAILED');
  return result;
}
export default function Atlas(){
  const [store]=useState(()=>{let s;try{s=localStorage;}catch{} return openAtlasStore(s);});
  const [loaded,setLoaded]=useState(()=>store.load());
  const [lang,setLang]=useState('uz'); const tr=(uz,en)=>lang==='uz'?uz:en;
  const [selected,setSelected]=useState([]),[query,setQuery]=useState(''),[material,setMaterial]=useState(''),[gravity,setGravity]=useState('microgravity');
  const [evidence,setEvidence]=useState(null),[text,setText]=useState(''),[format,setFormat]=useState('csv'),[preview,setPreview]=useState(null),[ack,setAck]=useState(false),[message,setMessage]=useState('');
  const [note,setNote]=useState(''),[notebookState,setNotebookState]=useState(()=>{try{return readNotebooks(localStorage);}catch(e){return {ok:false,entries:[],error:e.message};}});
  const notebooks=notebookState.entries;
  useEffect(()=>{document.documentElement.lang=lang;},[lang]);
  const [claim,setClaim]=useState('T20_T21_OXYGEN_SAME'); const evidenceRef=useRef(), lastField=useRef();
  const [queryState,setQueryState]=useState(()=>parseQuery(''));
  const [pending,setPending]=useState(null),[busy,setBusy]=useState(false);
  const requestVersion=useRef(0);
  function changeQuery(value){setQuery(value);setQueryState(parseQuery(value));}
  function clearProposal(){
    requestVersion.current++;
    if(pending) cancelReevaluation(pending);
    setPending(null);
  }
  const records=loaded.ok?activeRecords(loaded.database):[];
  const chosen=records.filter(r=>selected.includes(key(r)));
  const ranked=rankTrials(records,queryState,{metadataAdapter});
  const literal=query.trim().toLowerCase();
  const identityMatches=literal&&ranked.results.filter(({record:r})=>
    [r.trial_id,r.study_id,r.outcome.raw_display,r.raw_input.study||''].some(value=>value.toLowerCase().includes(literal)));
  const results=identityMatches?.length?identityMatches:literal&&queryState.filters.every(f=>f.status==='UNKNOWN')?[]:ranked.results;
  const matches=results.filter(({record:r})=>!material||r.material.toLowerCase().includes(material.toLowerCase())).map(item=>item.record);
  const groups=Object.groupBy(matches,r=>r.study_id);
  const gravityFilter={microgravity:'FLIGHT_0G',lunar:'PARTIAL_G_MOON',martian:'PARTIAL_G_MARS'}[gravity];
  const gapQuery=queryState.filters.some(f=>f.field==='environment')?queryState:
    addFilter(queryState.filters.some(f=>f.field==='material')?queryState:addFilter(queryState,{field:'material',value:material||'SIBAL'}),{field:'environment',value:gravityFilter});
  const scenarioGravity={PARTIAL_G_MOON:'lunar',PARTIAL_G_MARS:'martian',FLIGHT_0G:'microgravity'}[gapQuery.filters.find(f=>f.field==='environment')?.value]??gravity;
  const gap=detectEvidenceGap(records,gapQuery,{metadataAdapter,dRulesConnected:true});
  const coverage=assessEvidenceGap({phase:'solid',material:gapQuery.filters.find(f=>f.field==='material')?.value??(material||'SIBAL').toUpperCase(),gravity:scenarioGravity,
    setting:scenarioGravity==='microgravity'?'ISS':scenarioGravity==='lunar'?'lunar_surface':'martian_surface',
    ...(gapQuery.filters.some(f=>f.field==='o2_concentration')?{
      oxygen_fraction:gapQuery.filters.find(f=>f.field==='o2_concentration').si_value,
      oxygen_operator:gapQuery.filters.find(f=>f.field==='o2_concentration').operator,
      oxygen_location:gapQuery.filters.find(f=>f.field==='oxygen_location')?.value??'chamber_atmosphere',
    }:{})});
  async function fromNasa(){
    setBusy(true);
    try {
      const result=await requestJSON('/api/nasa/bass-ii');
      const next=convertNasaTable(result.csv);
      setText(next);setFormat('json');makePreview(next,'json');
    }catch(error){setMessage(error.message);}
    finally{setBusy(false);}
  }
  async function recheck(record){
    clearProposal();
    const version=requestVersion.current;
    setBusy(true);
    try{
      const adapter={name:'Gemini',evaluate:input=>requestJSON('/api/re-evaluate',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({study_id:input.study_id,trial_id:input.trial_id,field:input.field,
          source_ref_id:input.sources[0]?.source_ref_id,value:input.record.raw_input.sample_width_cm,language:lang}),
      })};
      const result=await proposeReevaluation(store,{study_id:record.study_id,trial_id:record.trial_id,field:'sample_width_cm'},{adapter});
      if(version!==requestVersion.current) return;
      if(result.status==='PROPOSAL_READY_FOR_CONFIRMATION')setPending(result);
      setMessage([result.error?.message||result.error?.code||result.status,result.rationale].filter(Boolean).join(' · '));
    }catch(error){setMessage(error.message);}
    finally{setBusy(false);}
  }
  async function applyProposal(){
    const apply=()=>{
      const result=commitReevaluation(store,pending,{confirmed:true,acknowledgeFlags:true});
      if(result.ok){setLoaded({ok:true,database:result.database});setPending(null);setMessage(tr('Tuzatish saqlandi','Correction saved'));}
      else{setMessage(result.error.code);clearProposal();}
    };
    if(navigator.locks) await navigator.locks.request('skyforge.atlas.write',apply); else apply();
  }
  function makePreview(value=text,fmt=format){clearProposal();setPreview(store.preview(value,fmt));setAck(false);setMessage('');}
  async function save(){
    const commit=()=>{const result=store.commit(preview,{confirmed:true,acknowledgeFlags:ack}); if(result.ok){setLoaded({ok:true,database:result.database});setPreview(null);setMessage(`${tr('Saqlandi','Saved')}: ${result.changes.length}; unchanged: ${result.unchanged}`);}else setMessage(result.error.code);};
    if(navigator.locks) await navigator.locks.request('skyforge.atlas.write',commit); else commit();
  }
  function toggle(r){const k=key(r);if(selected.includes(k))setSelected(selected.filter(x=>x!==k));else if(selected.length<3)setSelected([...selected,k]);else setMessage(tr('Eng ko‘pi 3 ta sinov','Select at most 3 trials'));}
  function proof(e,r,field){lastField.current=e.currentTarget;setEvidence({trial:r.trial_id,field,detail:fieldProof(r,field).evidence,...fieldEvidence(loaded.database,r.study_id,r.trial_id,field)});setTimeout(()=>evidenceRef.current?.focus(),0);}
  function closeProof(){setEvidence(null);lastField.current?.focus();}
  function saveNotebook(){
    try {
      const current=readNotebooks(localStorage);
      if(!current.ok){setNotebookState(current);setMessage(current.error);return;}
      const next=[...current.entries,{id:Date.now(),date:new Date().toISOString(),note,selected,query,material,gravity}];
      localStorage.setItem(NOTEBOOK_KEY,JSON.stringify(next));
      setNotebookState({ok:true,entries:next});setMessage(tr('Daftar saqlandi','Notebook saved'));
    }catch(e){setMessage(e.message);}
  }
  async function readFile(file){
    setPreview(null);
    if(!file)return;
    if(file.size>5_000_000){setMessage('IMPORT_FILE_TOO_LARGE');return;}
    try{setText(await file.text());setFormat(file.name.toLowerCase().endsWith('.json')?'json':'csv');setMessage('');}
    catch(e){setMessage(`IMPORT_FILE_READ_FAILED: ${e.message}`);}
  }
  return <div className="atlas-app"><header><a href="#main">SKYFORGE <small>FIRE ATLAS</small></a><span>{records.length} {tr('ulangan sinov','connected trials')} · {tr('NASA ma’lumotlari','NASA data')}</span><button onClick={()=>setLang(lang==='uz'?'en':'uz')}>{lang==='uz'?'English':'O‘zbekcha'}</button></header>
    <main id="main"><div className="intro"><p>NASA · BASS-II · PSI-25</p><h1>{tr('Savoldan dalilgacha.','From question to evidence.')}</h1><p>{tr('Sinovlarni solishtiring. Har bir qiymatning manbasini oching.','Compare trials. Open the source behind each value.')}</p></div>
    <p role="status" aria-live="polite">{message}</p>{!loaded.ok&&<p role="alert">{loaded.error.code}: {loaded.error.message}</p>}
    <section aria-labelledby="question"><h2 id="question">01 · {tr('Savol va talablar','Question and requirements')}</h2><label>{tr('Tajriba savoli yoki sinov IDsi','Experiment question or trial ID')}<input value={query} onChange={e=>changeQuery(e.target.value)} placeholder="BASS-II / T20 / Quenched"/></label><div className="controls"><label>Material<input value={material} onChange={e=>setMaterial(e.target.value)} placeholder="SIBAL"/></label><label>{tr('Gravitatsiya','Gravity')}<select value={gravity} onChange={e=>setGravity(e.target.value)}><option value="microgravity">ISS · microgravity</option><option value="lunar">Moon · 0.16g</option><option value="martian">Mars · 0.38g</option></select></label><button onClick={()=>{changeQuery('');setMaterial('');setGravity('microgravity');}}>{tr('Tozalash','Clear')}</button></div><div className="controls" aria-label="Query filters">{queryState.filters.map(f=><div key={f.filter_id} className="chip">
      <label>{f.field}{f.status==='UNKNOWN'?<span> · {String(f.value)}</span>:
        <input aria-label={f.field} defaultValue={Array.isArray(f.value)?f.value.join(' → '):f.value}
          key={JSON.stringify(f.value)} onBlur={e=>{
            const value=e.target.value;
            if(value===String(f.value)||value===f.value?.join?.(' → '))return;
            try{setQueryState(updateFilter(queryState,f.filter_id,{value}));}
            catch(error){e.target.value=String(f.value);setMessage(error.message);}
          }}/>}</label>
      <button aria-label={tr('Filtrni olib tashlash','Remove filter')+' '+f.field} onClick={()=>setQueryState(removeFilter(queryState,f.filter_id))}>×</button>
    </div>)}</div>
    {ranked.clarification.needed&&<p>{tr('Savolni aniqlashtirish uchun filtrlarni tahrirlang.','Edit the filters to narrow your question.')} <button onClick={()=>setQueryState(skipClarification(queryState))}>Skip</button></p>}
    {query.trim()&&<details><summary>{tr('Moslik va tekshiruvlar','Ranking and requirements')}</summary>
      {results.map(item=><div key={item.key}><strong>{item.trial_id} · Tier {item.tier} · {item.alignment_score_pct}%</strong>
        {item.sensitivity_warning&&<span> · ±10% weight sensitivity</span>}
        <ul>{item.checklist.items.map((check,index)=><li key={index}>{check.field} · {check.status}</li>)}</ul></div>)}
    </details>}
    <p><strong>{gap.status}</strong> · {gap.reason}</p>
    {coverage.source_ids.length>0&&<p>{tr('D korpusidagi dalillar','Evidence in D corpus')} · {coverage.evidence_ids.join(', ')}</p>}</section>
    <section><h2>02 · {tr('Kutubxona','Library')}</h2>{records.length===0&&loaded.ok&&<><p>{tr('D manbali T20/T21 seedini ko‘rib chiqing va tasdiqlang.','Preview and confirm D source-backed T20/T21 seed.')}</p><button onClick={()=>{setText(JSON.stringify(BASS_SEED));setFormat('json');makePreview(JSON.stringify(BASS_SEED),'json');}}>{tr('Seed preview','Preview seed')}</button></>}{Object.entries(groups).map(([id,rows])=><details key={id}><summary>{id} · {id==='PSI-25'?'BASS-II':id} ({rows.length})</summary>{rows.map(r=><label className="trial-choice" key={key(r)}><input type="checkbox" checked={selected.includes(key(r))} onChange={()=>toggle(r)}/>{r.trial_id} · {r.outcome.raw_display}</label>)}</details>)}{records.length>0&&!matches.length&&<p>{tr('Mos yozuv yo‘q','No matching records')}</p>}<details><summary>NASA PSI · {catalog.length} {tr('yonish tadqiqoti','combustion studies')}</summary>
      <ul>{catalog.filter(item=>!literal||[item.id,item.title,item.name].some(value=>String(value??'').toLowerCase().includes(literal))).map(item=>
        <li key={item.id}><a href={'https://psi.nasa.gov/physci/repo/data/investigations/'+item.id} target="_blank" rel="noreferrer">{item.id} · {item.title}</a></li>)}</ul>
    </details></section>
    <section><h2>03 · Atlas <small>{chosen.length}/3</small></h2>{!chosen.length&&<p>{tr('Study oching va 1–3 sinov tanlang.','Open a study and select 1–3 trials.')}</p>}<div className="comparison">{chosen.map(r=><article key={key(r)}><h3>{r.trial_id}</h3><h4>{tr('Pasport va cheklovlar','Passport and limitations')}</h4><p>{r.material} · {r.claim_type}</p><p>{r.sample_history.value||r.sample_history.status}</p><p className="chip">{sourceReview(r).status} · {r.review.scientific_verification}</p><h4>{tr('O‘lchovlar','Measurements')}</h4>{r.parameters.map(p=><div className="measurement" key={p.param_key}><span>{p.param_key}</span><button onClick={e=>proof(e,r,p.param_key)}>{p.raw_display}</button><small>SI: {p.si_display} · {p.direction} · {p.location} · {p.status}</small></div>)}<h4>{tr('Natija va gap','Outcome and gap')}</h4><button onClick={e=>proof(e,r,'outcome')}>{r.outcome.raw_display}</button><p>{gap.status}</p><h4>{tr('Dalil va workspace','Evidence and workspace')}</h4><p>{r.review.reasons.join(' · ')||'UNREVIEWED'}</p>{r.study_id==='PSI-25'&&<button disabled={busy} onClick={()=>recheck(r)}>{tr('Enni API orqali tekshirish','Check width with API')}</button>}<button onClick={e=>proof(e,r,'sample_history')}>{tr('Namuna tarixi dalili','Sample history evidence')}</button></article>)}</div><label>{tr('Chegaralangan xulosa tekshiruvi','Bounded conclusion check')}<select value={claim} onChange={e=>setClaim(e.target.value)}>{['T20_T21_OXYGEN_SAME','T20_T21_OXYGEN_DIFFERENT','T20_T21_NEW','T25_QUENCHED','BASS_ON_MOON','MOON_MARS_RISK_PERCENT'].map(x=><option key={x}>{x}</option>)}</select></label><p>{checkBoundedClaim(claim).verdict}: {checkBoundedClaim(claim).reason}</p></section>
    {evidence&&<aside className="proof" tabIndex="-1" ref={evidenceRef} aria-label="Evidence panel" onKeyDown={event=>{if(event.key==='Escape')closeProof();}}><button onClick={closeProof}>{tr('Yopish','Close')}</button><h2>Click-to-Prove · {evidence.trial}</h2><h3>{evidence.field}</h3><p>{evidence.revision_id}</p><p>{evidence.scientific_verification}</p>{evidence.detail&&<details><summary>Field provenance</summary><pre>{JSON.stringify(evidence.detail,null,2)}</pre></details>}{evidence.sources?.map(s=><div key={s.source_ref_id}><a href={s.url||s.source_url} target="_blank" rel="noreferrer">{s.document_id} · PDF {s.pdf_page} / {tr('bosma','printed')} {s.printed_page} · Table {s.table} · {s.row_id}</a><blockquote>{s.excerpt||s.source_excerpt}</blockquote><pre>{JSON.stringify(s,null,2)}</pre></div>)}</aside>}
    <section><h2>04 · Import / diff / confirm</h2><p>{tr('NASA jadvalini oling yoki CSV/JSON yuklang. Qiymatlarni saqlashdan oldin ko‘rib chiqing.','Fetch the NASA table or upload CSV/JSON. Review the values before saving.')}</p><button disabled={busy} onClick={fromNasa}>{tr('NASA’dan olish','Fetch from NASA')}</button>{busy&&<p role="status">{tr('So‘rov bajarilmoqda…','Request in progress…')}</p>}<input type="file" accept=".csv,.json" aria-label="Import file" onChange={e=>readFile(e.target.files[0])}/><label>Format<select value={format} onChange={e=>{setFormat(e.target.value);setPreview(null);}}><option>csv</option><option>json</option></select></label><label>{tr('Import matni','Import text')}<textarea value={text} onChange={e=>{setText(e.target.value);setPreview(null);}} rows="5"/></label><div className="controls"><button onClick={()=>{setText(t25);setFormat('csv');makePreview(t25,'csv');}}>T25 demo preview</button><button disabled={!loaded.ok} onClick={()=>makePreview()}>Preview</button></div>{preview&&<div><h3>Preview · {preview.ok?'READY':'ERROR'}</h3>{preview.error&&<p role="alert">{preview.error.code}</p>}{preview.errors?.map((e,i)=><p role="alert" key={i}>Row {e.row}: {e.message}</p>)}{preview.entries?.map((e,i)=><details key={i}><summary>{e.record.trial_id}: {e.action}</summary><p>{e.record.review.reasons.join(' · ')}</p><pre>{JSON.stringify({previous:records.find(r=>key(r)===key(e.record))?.raw_input||null,incoming:e.record.raw_input},null,2)}</pre></details>)}<label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>{tr('Bayroqlarni ko‘rdim, importni tasdiqlayman','I reviewed the flags and confirm this import')}</label><button disabled={!preview.ok||!ack} onClick={save}>{tr('Tasdiqlash va saqlash','Confirm and save')}</button><button onClick={()=>setPreview(null)}>{tr('Bekor qilish','Cancel')}</button></div>}</section>
    {pending&&<section aria-label="API correction"><h2>{tr('API tuzatish taklifi','API correction proposal')}</h2>
      <p>{pending.trial_id} · {pending.base_revision_id}</p>
      {pending.preview_entry?.record.sources.map(source=><a key={source.source_ref_id} href={source.url} target="_blank" rel="noreferrer">{source.document_id} · Table {source.table} · {source.row_id}</a>)}
      {pending.diffs.map(diff=><p key={diff.field}>{diff.field} · {diff.before} → {diff.after}</p>)}
      <button onClick={applyProposal}>{tr('Tuzatishni tasdiqlash','Confirm correction')}</button>
      <button onClick={clearProposal}>{tr('Rad etish','Reject correction')}</button>
    </section>}
    <section><h2>05 · Focus Corner / Notebook</h2><label>{tr('Izoh','Notes')}<textarea value={note} onChange={e=>setNote(e.target.value)} rows="4"/></label>{!notebookState.ok&&<p role="alert">NOTEBOOK_READ_FAILED: {notebookState.error}. {tr('Asl ma’lumot saqlandi; ustidan yozilmadi.','Original data preserved; no overwrite.')}</p>}<button disabled={!notebookState.ok} onClick={saveNotebook}>{tr('Daftarga saqlash','Save notebook')}</button>{notebooks.map(n=><div className="controls" key={n.id}><span>{n.date}</span><button onClick={()=>{setNote(n.note);setSelected(n.selected);changeQuery(n.query);setMaterial(n.material);setGravity(n.gravity);}}>{tr('Qayta ochish','Reopen')}</button><button onClick={()=>download(`notebook-${n.id}.json`,JSON.stringify(n,null,2))}>Download</button></div>)}</section>
    <section><h2>06 · Export</h2><p>{tr('Barcha faol yozuvlar, asl birliklar va manbalar. Archive barcha revisionlarni saqlaydi.','All active records with original units and sources. Archive retains every revision.')}</p><div className="controls"><button disabled={!loaded.ok} onClick={()=>download('atlas-report.json',exportReportJSON(loaded.database,{selection:chosen.map(r=>({study_id:r.study_id,trial_id:r.trial_id}))}))}>JSON</button><button disabled={!loaded.ok} onClick={()=>download('atlas-report.csv',exportReportCSV(loaded.database,{selection:chosen.map(r=>({study_id:r.study_id,trial_id:r.trial_id}))}),'text/csv')}>CSV</button><button disabled={!loaded.ok} onClick={()=>download('atlas-archive.json',exportArchive(loaded.database))}>Archive</button><button disabled={!loaded.ok} onClick={()=>download('atlas-exchange.json',exportJSON(loaded.database))}>Exchange JSON</button></div></section>
    </main></div>;
}
