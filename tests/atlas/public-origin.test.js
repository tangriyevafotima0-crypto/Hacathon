import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createWorkspaceApi} from '../../server/workspace-api.js';

test('public proxy accepts only explicitly trusted cross-host origins and sets HTTPS cookies',async t=>{
 const app=createWorkspaceApi({path:join(mkdtempSync(join(tmpdir(),'skyforge-origin-')),'db.sqlite'),trustedOrigins:['https://skyforge-example.netlify.app']});
 const server=createServer((req,res)=>void app.handle(req,res,()=>{res.writeHead(404);res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{app.close();await new Promise(r=>server.close(r));});
 const base='http://127.0.0.1:'+server.address().port;
 const request=origin=>fetch(base+'/api/workspace/session',{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-proto':'https'},body:'{}'});
 const trusted=await request('https://skyforge-example.netlify.app');assert.equal(trusted.status,200);assert.equal((await trusted.json()).ready,true);assert.match(trusted.headers.get('set-cookie'),/; Secure/);
 const untrusted=await request('https://another-project.netlify.app');assert.equal(untrusted.status,403);assert.equal(untrusted.headers.get('set-cookie'),null);
 const forged=await request('https://skyforge-example.netlify.app.attacker.example');assert.equal(forged.status,403);
});
