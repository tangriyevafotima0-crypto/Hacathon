import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createAtlasApi } from './server/atlas-api.js';
import { createIngestion } from './server/ingestion.js';

export default defineConfig(({ mode }) => {
  const key = process.env.GEMINI_API_KEY || loadEnv(mode, process.cwd(), 'GEMINI_').GEMINI_API_KEY;
  const middleware = createAtlasApi(key);
  const { SKYFORGE_DATA_ROOT:root, SKYFORGE_INGESTION_RUNTIME:runtime } = loadEnv(mode, process.cwd(), 'SKYFORGE_');
  const configure = async server => {
    server.middlewares.use(middleware);
    if (root && runtime) server.middlewares.use(await createIngestion({root,runtime}));
  };
  return {
    plugins: [react(), tailwindcss(), {
      name: 'fire-atlas-api',
      configureServer: configure,
      configurePreviewServer: configure,
    }],
  };
});
