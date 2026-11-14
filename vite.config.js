import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createAtlasApi } from './server/atlas-api.js';
import { createIngestion } from './server/ingestion.js';
import { createOpenRouter } from './server/openrouter.js';

export default defineConfig(({ mode }) => {
  const config=loadEnv(mode,process.cwd(),'OPENROUTER_');
  const router=createOpenRouter({key:config.OPENROUTER_API_KEY,model:config.OPENROUTER_MODEL||undefined});
  const middleware = createAtlasApi(router);
  const { SKYFORGE_DATA_ROOT:root, SKYFORGE_INGESTION_RUNTIME:runtime } = loadEnv(mode, process.cwd(), 'SKYFORGE_');
  const configure = async server => {
    server.middlewares.use(middleware);
    if (root && runtime) server.middlewares.use(await createIngestion({root,runtime,router}));
  };
  return {
    plugins: [react(), tailwindcss(), {
      name: 'fire-atlas-api',
      configureServer: configure,
      configurePreviewServer: configure,
    }],
  };
});
