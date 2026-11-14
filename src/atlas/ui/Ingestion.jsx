import React,{useEffect,useState} from 'react';

export async function ingestionJSON(path,options) {
  const response=await fetch('/api/ingestion/'+path,options);
  if(!response.headers.get('content-type')?.includes('application/json')) throw new Error('INGESTION_UNAVAILABLE');
  const data=await response.json();
  if(!response.ok) throw new Error(data.error);
  return data;
}

export default function Ingestion({lang,importJob,retryImport}) {
  const uz=lang==='uz';
  const [studies,setStudies]=useState([]);
  const [job,setJob]=useState(null);
  const [query,setQuery]=useState('');
  const [study,setStudy]=useState('');
  const [results,setResults]=useState(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    async function refresh(){
      try {
        const {studies}=await ingestionJSON('studies');
        if(active)setStudies(studies);
        if(importJob?.id){
          const data=await ingestionJSON('jobs/'+importJob.id);
          if(active)setJob(data);
        }
      }catch{/* Existing Atlas stays available without the optional service. */}
    }
    void refresh();
    const timer=setInterval(refresh,2500);
    return ()=>{active=false;clearInterval(timer);};
  },[importJob?.id]);

  async function search(event){
    event.preventDefault();
    const params=new URLSearchParams({q:query});
    if(study)params.set('study',study);
    setBusy(true);setMessage('');setResults(null);
    try {setResults((await ingestionJSON('search?'+params)).results);}
    catch(error){setMessage(error.message);}
    finally{setBusy(false);}
  }

  if(!studies.length&&!importJob)return null;
  return <section aria-label="Ingestion">
    <h2>{uz?'NASA dalillari va vektor qidiruvi':'NASA evidence and vector search'}</h2>
    {importJob&&<p aria-live="polite">Ingestion · {importJob.error||((job?.id===importJob.id)&&job?.state)||'QUEUED'}
      {job?.id===importJob.id&&job?.error&&' · '+job.error}
      {(importJob.error||job?.id===importJob.id&&job?.state==='FAILED')&&
        <button onClick={retryImport}>{uz?'Qayta urinish':'Retry'}</button>}
    </p>}
    <form onSubmit={search}>
      <label>{uz?'NASA manbalaridan qidirish':'Search NASA evidence'}
        <input value={query} onChange={event=>setQuery(event.target.value)} maxLength={300} required/>
      </label>
      <label>{uz?'Tadqiqot':'Study'}
        <select value={study} onChange={event=>setStudy(event.target.value)}>
          <option value="">{uz?'Barcha indekslangan tadqiqotlar':'All indexed studies'}</option>
          {studies.map(item=><option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}
        </select>
      </label>
      <button disabled={busy||!query.trim()}>{uz?'Dalilni qidirish':'Find evidence'}</button>
    </form>
    {message&&<p role="alert">{message}</p>}
    {results?.length===0&&<p>{uz?'Ulangan korpusda mos dalil topilmadi.':'No matching evidence in the connected corpus.'}</p>}
    {!!results?.length&&<a href={'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(results,null,2))}
      download="skyforge-evidence.json">{uz?'Topilgan dalillarni eksport qilish':'Export retrieved evidence'}</a>}
    {results?.map(result=><details key={result.id}>
      <summary>{result.studyId} · {result.trialId||result.locator} · {result.kind}</summary>
      <p>{result.title} · {result.id}</p>
      <pre>{result.text}</pre>
      <a href={result.sourceUrl} target="_blank" rel="noreferrer">{uz?'Asl manba':'Original source'}</a>
      {result.fileUrl&&<p><a href={result.fileUrl} target="_blank" rel="noreferrer">{result.file} · {result.locator}</a></p>}
    </details>)}
    <h3>{uz?'Demo tadqiqotlari':'Demo studies'} · {studies.length}</h3>
    {studies.map(item=><details key={item.id}>
      <summary>{item.id} · {item.title} · {item.job?.state} ({item.job?.count ?? 0})</summary>
      <p>{item.kind} · DOI {item.doi} · v{item.version} · {uz?'Tanlangan fayllar':'Selected files'}</p>
      {item.job?.error&&<p role="alert">{item.job.error}</p>}
      <a href={item.sourceUrl} target="_blank" rel="noreferrer">NASA PSI</a>
      <ul>{item.files.map(file=><li key={file.name}>
        <a href={file.url}>{file.name}</a>{file.extractionError&&' · '+file.extractionError}
        {file.media?.startsWith('image/')&&<div><img src={file.url} alt={file.name} loading="lazy" width="320"/></div>}
        {file.media?.startsWith('video/')&&<div><video src={file.url} controls preload="none" width="320"/></div>}
      </li>)}</ul>
    </details>)}
  </section>;
}
