import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El front habla siempre con rutas relativas: en el local, Nginx hace lo mismo.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      // Fotos de la carta: las sirve la API desde disco.
      '/fotos': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
});
