import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, Vite sert l'interface (port 5173) et renvoie les connexions
// temps réel vers le serveur Node (port 3001) : le navigateur croit parler à un seul serveur.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // permet de tester depuis un téléphone du même Wi-Fi
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
  build: { outDir: 'dist' },
});
