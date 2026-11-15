import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeLibraryStudies} from '../../src/atlas/ui/library-studies.js';
test('Library merges server files into their study and adds new studies without duplicates',()=>{
 const original=[{id:'PSI-47',title:'DAFT',kind:'FLIGHT_EXPERIMENT',files:[{url:'/metadata'}]}];
 const pdf={studyId:'PSI-47',name:'report.pdf',url:'/pdf',sha256:'abc'};
 const newFile={studyId:'PSI-999',title:'New study',url:'/new',version:2};
 const result=mergeLibraryStudies(original,[pdf,pdf,newFile],'en');
 assert.equal(result.length,2);assert.equal(result[0].title,'DAFT');assert.equal(result[0].files.length,2);
 assert.equal(result[1].title,'New study');assert.equal(result[1].kind,'UNKNOWN');assert.equal(result[1].files.length,1);
 assert.equal(original[0].files.length,1);assert.equal(result[1].files.some(f=>f.studyId==='PSI-47'),false);
});
