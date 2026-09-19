import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA con las 4 interfaces por rol (administrador, dirección deportiva,
// entrenador, deportista) viviendo todas en la misma app: el rol decide
// qué ve cada uno, no hay builds separados.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NUBAPP - AD Nuevo Baztán',
        short_name: 'NUBAPP',
        description: 'Gestión del club AD Nuevo Baztán',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
