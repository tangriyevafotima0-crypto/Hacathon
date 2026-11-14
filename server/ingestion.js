import { createReadStream, mkdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCSV, readImport, extractRow } from '../src/atlas/core/index.js';
import { convert, number } from '../src/atlas/core/contract.js';
import { studyUrl, sha } from './nasa-pitch.js';
import studies from './pitch-studies.json' with { type: 'json' };

const MODEL = 'Xenova/multilingual-e5-small';
const REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78';
const INDEX = 'e5-q8-csv-metadata-v1';
const SIZE = 384;
const DOI = /^10\.\d{4,9}\/[\w.()/-]+$/i;
const mediaTypes = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', mp4:'video/mp4', webm:'video/webm' };

function json(res,status,data) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}

async function body(req) {
  const chunks=[];
  let size=0;
  for await (const bytes of req) {
    size+=bytes.length;
    if(size>5_000_000) throw new Error('IMPORT_TOO_LARGE');
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function metadataParts(study,record) {
  return ['title','description','objective','approach','hypothesis','researchImpacts'].flatMap(field=>{
    const value=record[field];
    if(typeof value!=='string'||!value.trim())return [];
    const blocks=value.match(/[\s\S]{1,700}(?:\s|$)|[\s\S]{1,700}/g) ?? [];
    return blocks.map((text,i)=>({
      studyId:study.id,title:study.title,sourceUrl:study.sourceUrl,doi:study.doi,
      file:'study.metadata.json',locator:`/${field} · ${i+1}`,kind:field==='approach'?'METHOD':field.toUpperCase(),text
    }));
  });
}

function trialPart(row) {
  const record=extractRow(row);
  const source=record.sources[0];
  const numeric=Object.fromEntries(record.parameters.filter(p=>p.status==='MEASURED').map(p=>[p.param_key,p.si.values]));
  return {
    studyId:record.study_id,trialId:record.trial_id,title:row.study||record.study_id,
    kind:'ATLAS_TRIAL',material:record.material,numeric,sourceUrl:source.url,file:'Atlas import',
    locator:[source.table && 'Table '+source.table,source.pdf_page && 'PDF '+source.pdf_page,source.row_id].filter(Boolean).join(' · '),
    text:Object.entries(row).filter(([k,v])=>k!=='source_url'&&v!==null&&String(v).trim()).map(([k,v])=>`${k}: ${v}`).join('\n'),
  };
}

function original(res,path,type,range) {
  const size=statSync(path).size;
  const headers={'Content-Type':type,'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  if (!range) {
    res.writeHead(200,{...headers,'Content-Length':size});
    return createReadStream(path).pipe(res);
  }
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  const start=match?.[1] ? Number(match[1]) : Math.max(0,size-Number(match?.[2]));
  const end=match?.[1]&&match[2] ? Math.min(size-1,Number(match[2])) : size-1;
  if (!match||start>end||start>=size||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)) {
    res.writeHead(416,{'Content-Range':`bytes */${size}`});
    return res.end();
  }
  res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${size}`});
  return createReadStream(path,{start,end}).pipe(res);
}

export async function createIngestion({root,runtime}) {
  const { DatabaseSync } = await import('node:sqlite');
  const { pipeline,env } = await import(pathToFileURL(join(resolve(runtime),'node_modules','@huggingface','transformers','src','transformers.js')).href);
  const corpus=join(root,'pitch-five');
  mkdirSync(root,{recursive:true});
  env.cacheDir=join(root,'model-cache');
  let model;
  async function embed(texts,role) {
    model ??= pipeline('feature-extraction',MODEL,{revision:REVISION,dtype:'q8',device:'cpu'});
    let extractor;
    try { extractor=await model; } catch(error) { model=null; throw error; }
    const tensor=await extractor(texts.map(text=>role+': '+text.slice(0,1400)),{pooling:'mean',normalize:true,truncation:true});
    if(tensor.dims.at(-1)!==SIZE) throw new Error('EMBEDDING_SIZE_MISMATCH');
    return tensor.tolist();
  }
  const db=new DatabaseSync(join(root,'ingestion.sqlite'));
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL, count INTEGER DEFAULT 0, error TEXT);
    CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, version TEXT NOT NULL, study_id TEXT NOT NULL, slot TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, embedding BLOB NOT NULL);
    UPDATE jobs SET state='QUEUED' WHERE state='RUNNING';
  `);
  const assets=new Map();
  function evidenceEntry(part) {
    const slot=JSON.stringify([part.studyId,part.trialId??part.file,part.trialId?part.kind:part.locator]);
    const payload=JSON.stringify(part);
    return {slot,payload,part,id:sha(INDEX+slot+payload).slice(0,32)};
  }
  const existing=db.prepare('SELECT 1 FROM evidence WHERE id=?');
  function queue(parts) {
    const id=sha(INDEX+JSON.stringify(parts)).slice(0,32);
    db.prepare("INSERT INTO jobs(id,payload,state) VALUES(?,?,'QUEUED') ON CONFLICT(id) DO UPDATE SET state='QUEUED',error=NULL WHERE jobs.state='FAILED'")
      .run(id,JSON.stringify(parts));
    if(parts.some(part=>!existing.get(evidenceEntry(part).id))) {
      db.prepare("UPDATE jobs SET state='QUEUED',count=0 WHERE id=? AND state='READY'").run(id);
    }
    return id;
  }
  const available=[];
  for (const config of studies) {
    try {
      const folder=join(corpus,config.id);
      const manifest=JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8'));
      const metadata=JSON.parse(readFileSync(join(folder,'study.metadata.json'),'utf8'));
      if (metadata.version!==config.version||metadata.doi!==config.doi||!DOI.test(metadata.doi)) continue;
      const study={...config,title:metadata.title,sourceUrl:studyUrl(config.id)};
      const parts=metadataParts(study,metadata);
      const files=[];
      const manifestFiles=[{name:'study.metadata.json',status:'VERIFIED',version:config.version},...manifest.files];
      for (const file of manifestFiles) {
        if(file.status!=='VERIFIED'||file.name!==basename(file.name))continue;
        const path=join(folder,file.name);
        const ext=file.name.split('.').at(-1).toLowerCase();
        const key=sha(config.id+':'+file.name).slice(0,32);
        const fileUrl='/api/ingestion/files/'+key;
        assets.set(key,{path,type:mediaTypes[ext]??(ext==='csv'?'text/csv; charset=utf-8':'application/json; charset=utf-8')});
        files.push({name:file.name,bytes:statSync(path).size,url:fileUrl,media:mediaTypes[ext]??null});
        if (ext!=='csv') continue;
        try {
          const records=parseCSV(readFileSync(path,'utf8'));
          records.forEach((row,i)=>parts.push({
            studyId:config.id,title:study.title,doi:study.doi,sourceUrl:study.sourceUrl,fileUrl,
            file:file.name,fileVersion:file.version,locator:'CSV record '+(i+2),kind:'SOURCE_TABLE',
            text:Object.entries(row).filter(([,value])=>value.trim()).map(([key,value])=>`${key}: ${value}`).join('\n'),
          }));
        } catch(error) { files.at(-1).extractionError=error.message; }
      }
      const metadataUrl=files.find(f=>f.name==='study.metadata.json')?.url;
      for (const part of parts) if(part.file==='study.metadata.json') { part.fileUrl=metadataUrl; part.fileVersion=config.version; }
      const job=queue(parts);
      available.push({...study,files,job});
    } catch(error) { console.error('Pitch source unavailable',config.id,error.message); }
  }

  let working=false;
  async function work() {
    if(working)return;
    working=true;
    let job;
    try {
      job=db.prepare("SELECT id,payload FROM jobs WHERE state='QUEUED' ORDER BY rowid LIMIT 1").get();
      if(!job)return;
      db.prepare("UPDATE jobs SET state='RUNNING' WHERE id=?").run(job.id);
      const parts=JSON.parse(job.payload);
      const insert=db.prepare(`INSERT INTO evidence VALUES(?,?,?,?,?,?) ON CONFLICT(slot) DO UPDATE SET
        id=excluded.id,version=excluded.version,payload=excluded.payload,embedding=excluded.embedding`);
      const changes=parts.map(evidenceEntry).filter(item=>!existing.get(item.id));
      const vectors=[];
      for(let i=0;i<changes.length;i+=12) {
        const batch=changes.slice(i,i+12);
        vectors.push(...await embed(batch.map(({part})=>part.title+'\n'+part.text),'passage'));
      }
      db.exec('BEGIN');
      try {
        for(const [i,{id,slot,part,payload}] of changes.entries()) {
          insert.run(id,INDEX,part.studyId,slot,payload,Buffer.from(Float32Array.from(vectors[i]).buffer));
        }
        db.prepare("UPDATE jobs SET state='READY',count=? WHERE id=?").run(parts.length,job.id);
        db.exec('COMMIT');
      } catch(error) { db.exec('ROLLBACK'); throw error; }
    } catch(error) {
      if(job) db.prepare("UPDATE jobs SET state='FAILED',error=? WHERE id=?").run(String(error.message).slice(0,300),job.id);
      console.error('Ingestion failed',error.message);
    } finally { working=false; }
  }
  const timer=setInterval(()=>void work(),1000);
  timer.unref();
  const jobState=id=>db.prepare('SELECT id,state,count,error FROM jobs WHERE id=?').get(id);

  return async (req,res,next) => {
    const url=new URL(req.url,'http://localhost');
    const parts=url.pathname.split('/');
    if(parts[1]!=='api'||parts[2]!=='ingestion')return next();
    try {
      if (req.method==='GET'&&parts[3]==='studies') {
        return json(res,200,{model:MODEL,revision:REVISION,dimensions:SIZE,index:INDEX,
          studies:available.map(({job,...study})=>({...study,job:jobState(job)}))});
      }
      if (req.method==='GET'&&parts[3]==='jobs') {
        const job=jobState(parts[4]??'');
        return json(res,job?200:404,job??{error:'JOB_NOT_FOUND'});
      }
      if (req.method==='GET'&&parts[3]==='files') {
        const file=assets.get(parts[4]);
        return file?original(res,file.path,file.type,req.headers.range):json(res,404,{error:'FILE_NOT_FOUND'});
      }
      if (req.method==='POST'&&parts[3]==='import') {
        if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`) {
          return json(res,403,{error:'INGESTION_ORIGIN'});
        }
        if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'INGESTION_JSON_REQUIRED'});
        const input=await body(req);
        const rows=readImport(JSON.stringify(input),'json');
        if(rows.length>200)return json(res,400,{error:'INGESTION_BATCH_LIMIT_200'});
        const entries=rows.map(trialPart);
        if(new Set(entries.map(p=>JSON.stringify([p.studyId,p.trialId]))).size!==entries.length) {
          return json(res,400,{error:'INGESTION_DUPLICATE_TRIAL'});
        }
        return json(res,202,{id:queue(entries)});
      }
      if (req.method==='GET'&&parts[3]==='search') {
        const query=url.searchParams.get('q')?.trim();
        if(!query||query.length>300)return json(res,400,{error:'QUERY_LENGTH'});
        if(/\b(?:moon|mars|martian|lunar|oy(?:da|dagi|ning)?|0[.,](?:16|38)\s*g)\b/iu.test(query)) {
          return json(res,200,{results:[]});
        }
        const study=url.searchParams.get('study');
        const trial=url.searchParams.get('trial');
        const material=url.searchParams.get('material')?.toLowerCase();
        let oxygen,flow;
        try {
          if(url.searchParams.has('oxygen')) oxygen=convert([number(url.searchParams.get('oxygen'))],'vol%','o2_concentration').values[0];
          if(url.searchParams.has('flow')) flow=convert([number(url.searchParams.get('flow'))],'cm/s','flow_velocity').values[0];
        } catch { return json(res,400,{error:'INVALID_NUMERIC_FILTER'}); }
        const [vector]=await embed([query],'query');
        const results=[];
        for(const row of db.prepare('SELECT id,payload,embedding FROM evidence WHERE version=? AND (? IS NULL OR study_id=?)').iterate(INDEX,study,study)) {
          const item=JSON.parse(row.payload);
          if(trial&&item.trialId!==trial||material&&!item.material?.toLowerCase().includes(material))continue;
          if(oxygen!==undefined&&item.numeric?.o2_concentration?.[0]!==oxygen)continue;
          if(flow!==undefined&&!item.numeric?.flow_velocity?.includes(flow))continue;
          const bytes=Buffer.from(row.embedding);
          let score=0;
          for(let i=0;i<SIZE;i++)score+=vector[i]*bytes.readFloatLE(i*4);
          results.push({...item,id:row.id,score});
        }
        return json(res,200,{results:results.sort((a,b)=>b.score-a.score).slice(0,8)});
      }
      return json(res,404,{error:'INGESTION_ROUTE_NOT_FOUND'});
    } catch(error) {
      console.error('Ingestion request failed',error.message);
      return json(res,parts[3]==='import'?400:503,{error:parts[3]==='import'?'INGESTION_IMPORT_INVALID':'INGESTION_UNAVAILABLE'});
    }
  };
}
