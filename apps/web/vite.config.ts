import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Service worker para usar la app sin conexión: guarda todo lo que sale del build (menos la página de prueba
 * del motor) con un nombre de caché que cambia con cada versión.
 */
function serviceWorker(): Plugin {
  return {
    name: 'kit-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.startsWith('geometria') && !/assets\/geometria-/.test(f));
      const extra = ['./', 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12);
      const template = readFileSync(resolve(import.meta.dirname, 'sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('[/* __FILES__ */]', JSON.stringify([...extra, ...files.filter((f) => f !== 'index.html')])),
      });
    },
  };
}

// GitHub Pages sirve la app en /kit-carpintero/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), serviceWorker()],
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
