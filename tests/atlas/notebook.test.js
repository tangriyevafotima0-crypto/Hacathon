import test from 'node:test';
import assert from 'node:assert/strict';
import {readNotebooks} from '../../src/atlas/ui/notebook.js';
const storage=raw=>({getItem:()=>raw});
test('Notebook: empty storage and a saved workspace reopen with exact selection and notes',()=>{
 assert.deepEqual(readNotebooks(storage(null)),{ok:true,entries:[]});
 const entries=[{id:1,date:'2026-11-14T00:00:00Z',note:'T20',query:'SIBAL',material:'SIBAL',gravity:'lunar',selected:['["PSI-25","GMT190-T20"]']}];
 assert.deepEqual(readNotebooks(storage(JSON.stringify(entries))),{ok:true,entries});
});
test('Notebook: corrupt, wrong-shaped and denied storage report errors instead of overwriting',()=>{
 for(const raw of ['{','null','{}','[null]','[{"id":1}]'])assert.equal(readNotebooks(storage(raw)).ok,false);
 assert.equal(readNotebooks({getItem(){throw Error('SecurityError');}}).error,'SecurityError');
});
