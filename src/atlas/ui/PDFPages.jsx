import React,{lazy,Suspense} from 'react';
const PDFCanvas=lazy(()=>import('./PDFCanvas.jsx'));
export default function PDFPages(props){return <Suspense fallback={<p role="status">{props.language==='uz'?'PDF yuklanmoqda…':'Loading PDF…'}</p>}><PDFCanvas {...props}/></Suspense>;}
