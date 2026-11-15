import React,{useState} from 'react';
import {Folder,FileText,ChevronRight,ArrowLeft} from 'lucide-react';

export default function ServerPDFLibrary({files,downloadState,error,language,onOpen,onFolderChange,children}){
 const uz=language==='uz',[study,setStudy]=useState(null),[query,setQuery]=useState('');
 const groups=[...new Set(files.map(file=>file.studyId))].sort();
 const selected=files.filter(file=>file.studyId===study);
 const matches=selected.filter(file=>file.name.toLowerCase().includes(query.toLowerCase()));
 function openFolder(id){setStudy(id);setQuery('');onFolderChange();}
 return <section className="library-pdfs">
  <header><h2>{uz?'Serverdagi 5 GB to‘plam':'Server 5 GB collection'}</h2><span>{files.length} PDF · {groups.length} {uz?'tadqiqot':'studies'}</span></header>
  <p>{uz?'Serverdagi to‘plam bilan jonli bog‘langan. Tadqiqotni tanlang, keyin uning PDF hujjatlarini oching. Ro‘yxat har 15 soniyada yangilanadi.':'Connected to the server collection. Choose a study, then open its PDF documents. The list refreshes every 15 seconds.'}</p>
  {downloadState==='PARTIAL_FAILURE'&&<p role="status">{uz?'Ayrim fayllar yuklanmagan. Bu yerda faqat yuklanishi tekshirilgan PDFlar ko‘rsatiladi.':'Some downloads are incomplete. Only verified PDF downloads appear here.'}</p>}
  {error&&<p role="alert">{error}</p>}
  <nav className="pdf-breadcrumb" aria-label={uz?'PDF bo‘limlari':'PDF folders'}><button onClick={()=>openFolder(null)}>{uz?'5 GB to‘plam':'5 GB collection'}</button>{study&&<><ChevronRight size={15}/><span>{study}</span><ChevronRight size={15}/><span>PDF</span></>}</nav>
  {!study?<div className="pdf-study-folders">{groups.map(id=><button key={id} onClick={()=>openFolder(id)}><Folder size={24}/><span><strong>{id}</strong><small>{files.filter(f=>f.studyId===id).length} {uz?'PDF hujjat':'PDF documents'}</small></span><ChevronRight size={18}/></button>)}</div>:<>
   <button className="pdf-folder-back" onClick={()=>openFolder(null)}><ArrowLeft size={16}/>{uz?'Tadqiqotlarga qaytish':'Back to studies'}</button>
   <h3>{study} · {uz?'PDF hujjatlar':'PDF documents'}</h3>
   <label>{uz?'Shu tadqiqot ichidan PDF qidirish':'Search PDFs within this study'}<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={250}/></label>
   <div className="library-pdf-list">{matches.map(file=><button key={file.id} onClick={()=>onOpen(file)}><FileText size={19}/><span><strong>{file.name}</strong><small>v{file.version} · {(file.bytes/1000000).toFixed(2)} MB · {uz?'AI indeksi kutilmoqda':'AI indexing pending'}</small></span><ChevronRight size={18}/></button>)}</div>
   {children}
   {!matches.length&&<p>{uz?'Bu bo‘limda mos PDF topilmadi.':'No matching PDFs in this folder.'}</p>}
  </>}
  {!files.length&&!error&&<p>{uz?'Hozircha tekshirilgan PDF mavjud emas.':'No verified PDFs are available yet.'}</p>}
 </section>;
}
