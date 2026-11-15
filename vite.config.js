import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createAtlasApi } from './server/atlas-api.js';
import { createIngestion } from './server/ingestion.js';
import { createOpenRouter } from './server/openrouter.js';
import { createWorkspaceApi } from './server/workspace-api.js';
import { openWorkspace, digest } from './server/workspace-store.js';
import {createNasaFiles} from './server/nasa-files.js';
import { publicTrials } from './server/workspace-tools.js';

export default defineConfig(({ mode }) => {
  const config=loadEnv(mode,process.cwd(),'OPENROUTER_');
  const { SKYFORGE_DATA_ROOT:root, SKYFORGE_INGESTION_RUNTIME:runtime, SKYFORGE_WORKSPACE_DB:workspacePath,
    SKYFORGE_ADDITIONAL_ROOT:additionalRoot,SKYFORGE_PUBLIC_ORIGINS:publicOrigins,SKYFORGE_PUBLIC_HOST:publicHost,SKYFORGE_PYTHON:python,SKYFORGE_PYTHONPATH:pythonPath,SKYFORGE_RELEASE:release } = loadEnv(mode, process.cwd(), 'SKYFORGE_');
  const configure = async server => {
    server.middlewares.use(createNasaFiles(additionalRoot));
    server.middlewares.use((req,res,next)=>{
      if(req.url!=='/api/health')return next();
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({status:'READY',release:release||'development',workspaceConfigured:Boolean(workspacePath),corpusConfigured:Boolean(root&&runtime)}));
    });
    const ledger=workspacePath?openWorkspace(workspacePath):null;
    const router=createOpenRouter({key:config.OPENROUTER_API_KEY,model:config.OPENROUTER_MODEL||undefined,ledger});
    const ingestion=root&&runtime?await createIngestion({root,runtime,router,publicOnly:Boolean(workspacePath)}):null;
    server.middlewares.use(createAtlasApi(router));
    if(workspacePath){
      async function retrieve(query,trials=undefined,search=false){
        const explicit=trials??[...query.matchAll(/\b(?:GMT\d+-)?T\d+\b/gi)].map(m=>m[0]);
        if(ingestion)return ingestion.retrieve(query,{study:null,trials:explicit.length?explicit.map(id=>id.toUpperCase()):undefined,ask:!search});
        if(/\b(?:moon|mars|martian|lunar|oyda)\b/i.test(query))return [];
        const ids=explicit.map(id=>id.toUpperCase());
        if(!ids.length&&!/BASS-II|SIBAL|PSI-25/i.test(query))return [];
        return publicTrials.filter(r=>!ids.length||ids.some(id=>r.trial_id===id||r.trial_id.endsWith('-'+id))).map(r=>({
          id:digest(r.study_id+':'+r.trial_id).slice(0,32),studyId:r.study_id,trialId:r.trial_id,
          kind:'NASA_TABLE_TRANSCRIPTION',locator:'Table 7.1 · PDF 104 · '+r.trial_id,sourceUrl:r.sources[0].url,
          text:JSON.stringify(r.raw_input),
        }));
      }
      const workspace=createWorkspaceApi({path:workspacePath,router,retrieve,search:async query=>({results:await retrieve(query,undefined,true)}),embed:ingestion?.embed,getSnapshot:ingestion?.snapshot,python,pythonPath,trustedOrigins:(publicOrigins||'').split(',').map(s=>s.trim()).filter(Boolean)});
      server.middlewares.use((req,res,next)=>{
        if(req.url?.split('?')[0]==='/api/ingestion/import'&&req.method==='POST'){
          req.url='/api/workspace/imports';
          return workspace.handle(req,res,next);
        }
        if(req.url?.startsWith('/api/ingestion/jobs/')){
          req.url=req.url.replace('/api/ingestion/jobs/','/api/workspace/imports/');
          return workspace.handle(req,res,next);
        }
        next();
      });
      server.middlewares.use(workspace.handle);
      server.httpServer?.once('close',()=>{workspace.close();ledger.close();});
    }
    if(ingestion)server.middlewares.use(ingestion);
  };
  return {
    server:{allowedHosts:publicHost?[publicHost]:[]},
    preview:{allowedHosts:publicHost?[publicHost]:[]},
    plugins: [react(), tailwindcss(), {
      name: 'fire-atlas-api',
      configureServer: configure,
      configurePreviewServer: configure,
    }],
  };
});
