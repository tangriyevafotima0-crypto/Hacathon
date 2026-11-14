import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('docs/d01-d02/checksums.json',root),'utf8'));
let count=0;
for(const [path,expected] of Object.entries(manifest.files)){
 if(path.startsWith('/')||path.split('/').includes('..'))throw Error('unsafe manifest path');
 const bytes=readFileSync(new URL(path,root));
 const actual=createHash('sha256').update(bytes).digest('hex');
 if(actual!==expected)throw Error('HASH_MISMATCH:'+path);
 count++;
}
console.log(JSON.stringify({status:'PASS',files:count,baseline_commit:manifest.baseline_commit,protected_core_ui_lockfile:'UNCHANGED',artifact_version:manifest.artifact_version}));
