import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages sirve la app en /kit-carpintero/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
});
