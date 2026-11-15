import React,{useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,ZoomIn,ZoomOut} from 'lucide-react';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=workerUrl;

// One active render per canvas; navigation cancels the previous render.
export default function PDFPages({url,name,language}){
 const uz=language==='uz',canvas=useRef(null),host=useRef(null);
 const [pdf,setPdf]=useState(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(600),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;setPdf(null);setPage(1);setZoom(1);setBusy(true);setError('');const task=getDocument({url});task.promise.then(doc=>{if(live)setPdf(doc);}).catch(()=>{if(live){setError(uz?'PDF ochilmadi. Asl fayl havolasini tekshiring.':'Could not open this PDF. Try the original file link.');setBusy(false);}});return()=>{live=false;void task.destroy();};},[url,uz]);
 useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));observer.observe(host.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!pdf)return;let live=true,render;setBusy(true);setError('');(async()=>{const source=await pdf.getPage(page);if(!live)return;const base=source.getViewport({scale:1}),scale=Math.min((width-32)/base.width,2)*zoom,viewport=source.getViewport({scale:Math.max(.1,scale)}),ratio=Math.min(window.devicePixelRatio||1,2),el=canvas.current;el.width=Math.ceil(viewport.width*ratio);el.height=Math.ceil(viewport.height*ratio);el.style.width=viewport.width+'px';el.style.height=viewport.height+'px';render=source.render({canvasContext:el.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});await render.promise;if(live)setBusy(false);})().catch(e=>{if(live&&e.name!=='RenderingCancelledException'){setError(uz?'Sahifani ko‘rsatib bo‘lmadi. Boshqa sahifani tanlang.':'Could not display this page. Try another page.');setBusy(false);}});return()=>{live=false;render?.cancel();};},[pdf,page,width,zoom,uz]);
 const move=n=>setPage(Math.max(1,Math.min(pdf?.numPages||1,n)));
 return <div className="pdf-pages" aria-label={name}>
  <div className="pdf-page-controls">
   <button type="button" aria-label={uz?'Oldingi sahifa':'Previous page'} disabled={!pdf||page===1} onClick={()=>move(page-1)}><ChevronLeft size={18}/></button>
   <label>{uz?'Sahifa':'Page'} <input aria-label={uz?'PDF sahifasi':'PDF page'} type="number" min="1" max={pdf?.numPages||1} value={page} disabled={!pdf} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>0)move(n);}}/> / {pdf?.numPages||'—'}</label>
   <button type="button" aria-label={uz?'Keyingi sahifa':'Next page'} disabled={!pdf||page===pdf.numPages} onClick={()=>move(page+1)}><ChevronRight size={18}/></button>
   <button type="button" aria-label={uz?'Kichraytirish':'Zoom out'} disabled={zoom<=.5} onClick={()=>setZoom(z=>Math.max(.5,z-.25))}><ZoomOut size={18}/></button>
   <span>{Math.round(zoom*100)}%</span><button type="button" aria-label={uz?'Kattalashtirish':'Zoom in'} disabled={zoom>=2} onClick={()=>setZoom(z=>Math.min(2,z+.25))}><ZoomIn size={18}/></button>
  </div>
  <div className="pdf-page-stage" ref={host} aria-busy={busy}>
   {busy&&!error&&<p role="status">{uz?'Sahifa yuklanmoqda…':'Loading page…'}</p>}
   {error&&<p role="alert">{error}</p>}
   <canvas ref={canvas} role="img" aria-label={`${name} · ${uz?'sahifa':'page'} ${page}`} style={{visibility:busy||error?'hidden':'visible'}}/>
  </div>
 </div>;
}

