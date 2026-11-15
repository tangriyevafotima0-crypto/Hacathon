import {readFile,stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,sep,extname} from 'node:path';

// Only verified manifest-listed public NASA files are exposed; user uploads stay private.
const types={'.pdf':'application/pdf','.mp4':'video/mp4','.webm':'video/webm','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json','.zip':'application/zip'};
export function createNasaFiles(root){
 const empty={files:[],downloadState:'NOT_CONFIGURED',indexed:false};
 let cachedInventory=null,expiresAt=0;
 function currentInventory(){if(!cachedInventory||Date.now()>=expiresAt){expiresAt=Date.now()+2000;cachedInventory=inventory().catch(error=>{cachedInventory=null;throw error;});}return cachedInventory;}
 async function inventory(){
  if(!root)return empty;
  let data;try{data=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));}catch{return {...empty,downloadState:'MANIFEST_UNAVAILABLE'};}
  const resolvedRoot=await realpath(root);const files=[];
  for(const row of data.files||[]){
   if(row.status!=='VERIFIED'||!row.name||!/^[a-f0-9]{64}$/i.test(row.sha256||''))continue;
   try{const path=await realpath(row.path);if(!path.toLowerCase().startsWith((resolvedRoot+sep).toLowerCase()))continue;const info=await stat(path);if(!info.isFile()||info.size!==row.bytes)continue;
    files.push({id:row.study_id+'-'+row.sha256,name:row.name,title:row.title,fileVersion:row.file_version,media:types[extname(row.name).toLowerCase()]||'application/octet-stream',studyId:row.study_id,doi:row.doi,version:row.study_version,bytes:info.size,sha256:row.sha256,url:'/api/nasa-files/'+row.study_id+'-'+row.sha256,sourceUrl:row.source_url,indexed:false,path});
   }catch{/* Incomplete or missing files are never advertised as available. */}
  }
  return {files,downloadState:data.state,indexed:false};
 }
 return async function handle(req,res,next){
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/nasa-files'))return next();
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(!['GET','HEAD'].includes(req.method))return json(405,{error:'METHOD_NOT_ALLOWED'});
  try{
   const list=await currentInventory();
   if(url.pathname==='/api/nasa-files')return json(200,{...list,files:list.files.map(({path,...f})=>f)});
   const id=url.pathname.slice('/api/nasa-files/'.length);const file=list.files.find(f=>f.id===id);if(!file)return json(404,{error:'NOT_FOUND'});
   const headers={'Content-Type':file.media,'Content-Disposition':/^(application\/pdf|image\/|video\/|text\/)/.test(file.media)?'inline':'attachment','Accept-Ranges':'bytes','Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'};
   let start=0,end=file.bytes-1,status=200;
   if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);start=Number(m?.[1]);end=m?.[2]?Math.min(Number(m[2]),end):end;
    if(!m||start>end||start>=file.bytes){res.writeHead(416,{'Content-Range':'bytes */'+file.bytes});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${file.bytes}`;
   }
   headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();
   const stream=createReadStream(file.path,{start,end});res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{return json(503,{error:'NASA_FILES_UNAVAILABLE'});}
 };
}
