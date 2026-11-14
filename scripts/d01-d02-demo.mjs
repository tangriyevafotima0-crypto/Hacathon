import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {openAtlasStore,activeRecords,exportArchive,fieldEvidence} from '../src/atlas/core/index.js';
import {BASS_SEED,sourceReview,fieldProof,queryOxygen,assessEvidenceGap,checkBoundedClaim} from '../src/atlas/data/index.js';
const out=new URL('../docs/d01-d02/demo-output/',import.meta.url);mkdirSync(out,{recursive:true});
const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
const store=openAtlasStore(storage,{clock:()=> '2026-11-14T08:00:00.000Z'});
function accepted(text,format){
 const p=store.preview(text,format);if(!p.ok)throw Error(JSON.stringify(p.errors));
 const result=store.commit(p,{confirmed:true,acknowledgeFlags:true});
 if(!result.ok)throw Error(JSON.stringify(result.error));
 console.log('COMMIT',JSON.stringify({changes:result.changes.length,generation:result.database.generation}));
 return result;
}
accepted(JSON.stringify(BASS_SEED),'json');
const t25=readFileSync(new URL('../src/atlas/data/GMT216-T25.csv',import.meta.url),'utf8');
accepted(t25,'csv');accepted(t25,'csv');
const archive=exportArchive(store.load().database);writeFileSync(new URL('store.json',out),archive);
const reloaded=openAtlasStore({getItem:()=>readFileSync(new URL('store.json',out),'utf8'),setItem:()=>{throw Error('read-only reload');}}).load();
if(!reloaded.ok)throw Error(JSON.stringify(reloaded.error));
const records=activeRecords(reloaded.database);
console.log('RELOADED',JSON.stringify(records.map(r=>({id:r.trial_id,history:r.sample_history,outcome:r.outcome.raw_display,review:sourceReview(r)}))));
console.log('FIELD_PROOF',JSON.stringify(fieldProof(records[0],'o2_concentration')));
console.log('CORE_FIELD_EVIDENCE',JSON.stringify(fieldEvidence(reloaded.database,'PSI-25','GMT216-T25','flow_velocity')));
for(const [corpus,location] of [['BASS_THREE','chamber_atmosphere'],['CFIG_NORMAL','chamber_atmosphere'],['CFIG_INVERSE','burner_flow'],['CFIG_INVERSE','chamber_atmosphere']]){
 const r=queryOxygen(corpus,{location});console.log('OXYGEN',JSON.stringify({...r,matches:r.matches.slice(0,1)}));
}
for(const [planet,gravity,setting] of [['Moon','lunar','lunar_surface'],['Mars','martian','martian_surface']]){
 console.log('GAP',planet,JSON.stringify(assessEvidenceGap({phase:'solid',material:'SIBAL',gravity,setting})));
}
console.log('CLAIM',JSON.stringify(checkBoundedClaim('T20_T21_NEW')));
console.log('SUMMARY',JSON.stringify({records:records.length,reimport_changes:0,scientific_verification:'NOT_VERIFIED',live_ai:'NOT_IMPLEMENTED_NOT_TESTED'}));
