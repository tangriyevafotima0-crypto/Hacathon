import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openWorkspace} from '../../server/workspace-store.js';
import {createAssets} from '../../server/workspace-assets.js';
import {answerAtlas} from '../../server/atlas-answer.js';

test('attachment retrieval is owner-scoped, persistent and limited to selected files',async()=>{
 const path=join(mkdtempSync(join(tmpdir(),'attachment-')),'workspace.sqlite');
 const store=openWorkspace(path);const assets=createAssets({store,dbPath:path});
 const one=await assets.add('alice',{name:'first.txt',base64:Buffer.from('alpha experiment oxygen 21 percent').toString('base64')});
 await assets.process('alice');
 const two=await assets.add('alice',{name:'second.txt',base64:Buffer.from('beta experiment oxygen 30 percent').toString('base64')});
 await assets.process('alice');
 assert.equal((await assets.search('bob','oxygen')).length,0);
 const scoped=await assets.search('alice','explain this document',null,[one.id]);
 assert.equal(scoped.length,1);assert.equal(scoped[0].assetId,one.id);
 assert.ok(scoped[0].text.includes('21'));assert.ok(!scoped[0].text.includes('30'));
 assert.equal((await assets.add('alice',{name:'same.txt',base64:Buffer.from('alpha experiment oxygen 21 percent').toString('base64')})).id,one.id);
 store.close();const reopened=openWorkspace(path);assert.equal(reopened.get('alice','asset',two.id).chunks.length,1);reopened.close();
});
test('vision is labeled as interpretation and provider failure preserves explicit partial state',async()=>{
 const path=join(mkdtempSync(join(tmpdir(),'vision-')),'workspace.sqlite');const store=openWorkspace(path);
 const assets=createAssets({store,dbPath:path,router:{configured:true,async complete(input){assert.match(input.images[0],/^data:image\/png;base64,/);return {model:'test-vision',data:{description:'A diagram of a flame',visible_text:'flow 3 cm/s',limitations:'Not a measured outcome'}};}}});
 const record=await assets.add('alice',{name:'figure.png',base64:Buffer.from('test fixture bytes').toString('base64')});await assets.process('alice');
 const item=store.get('alice','asset',record.id);assert.equal(item.state,'PARTIAL');assert.equal(item.parts[0].status,'AI_INTERPRETED');assert.ok(item.chunks[0].interpretation);assert.equal(item.parts[0].image,undefined);
 const result=await answerAtlas({async complete(){return {data:{status:'ANSWERED',claims:[{text:'The image shows flow 3 cm/s',evidence_ids:[item.chunks[0].id]}]}};}},'What is shown?','en',item.chunks);
 assert.equal(result.claims[0].kind,'AI_INTERPRETATION');
 const offline=createAssets({store,dbPath:path});const unavailable=await offline.add('alice',{name:'other.png',base64:Buffer.from('other image').toString('base64')});await offline.process('alice');
 assert.equal(store.get('alice','asset',unavailable.id).parts[0].status,'VISION_UNAVAILABLE');assert.equal(store.get('alice','asset',unavailable.id).chunks.length,0);store.close();
});
