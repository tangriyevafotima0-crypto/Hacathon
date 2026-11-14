import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createAtlasApi } from './server/atlas-api.js';

export default defineConfig(({ mode }) => {
  const key = process.env.GEMINI_API_KEY || loadEnv(mode, process.cwd(), 'GEMINI_').GEMINI_API_KEY;
  const middleware = createAtlasApi(key);
  return {
    plugins: [react(), tailwindcss(), {
      name: 'fire-atlas-api',
      configureServer(server) { server.middlewares.use(middleware); },
      configurePreviewServer(server) { server.middlewares.use(middleware); },
    }],
  };
});
