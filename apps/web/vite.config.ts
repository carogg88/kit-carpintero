import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages sirve la app en /kit-carpintero/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  worker: { format: 'es' },
  // El motor de geometría trae su propio .wasm: Vite no lo tiene que preempaquetar.
  optimizeDeps: { exclude: ['replicad-opencascadejs'] },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        geometria: resolve(import.meta.dirname, 'geometria.html'),
      },
    },
  },
});
