import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    proxy: {
      '/api/sales': {
        target:
          'https://script.google.com/macros/s/AKfycbwVr7l4-MYv8lZyuSC2WF9_DMS6p79LVKq9f1rhcgmn1TiuTf72RG-6IQG_ZDvhgsq3',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/exec',
      },
      '/api/plan-targets': {
        target:
          'https://script.google.com/macros/s/AKfycbwfKHCRUY6pL2tEyAxTVJISqx18zJtrsH-n30rUPSbWrufIjbjTmDzjT55VsbKdXIIyow',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/exec',
      },
      '/api/store-check': {
        target:
          'https://script.google.com/macros/s/AKfycbzVsmmO3h6adCmEyHOtk4nGMsyYtaa_0oBLMZfsCcWYd5-SikPxlZ6uZG2CMkujx8Sc',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/exec',
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/calendar-icon-64.svg',
        'icons/camera-icon-64.svg',
        'icons/chart-icon-64.svg',
        'icons/ClientProduct.svg',
        'icons/gallery-icon-64.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icons_planning.svg',
        'icons/implementation.svg',
        'icons/message-icon-64.svg',
        'icons/promo-icon-64.svg',
        'icons/storecheck.svg',
      ],
      manifest: {
        id: '/',
        name: 'SODA',
        short_name: 'SODA',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#ffffff',
        theme_color: '#ffffff',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
