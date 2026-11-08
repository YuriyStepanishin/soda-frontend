import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string;
};

// Installed apps notice icon changes by URL. Change the URL when the image changes.
const iconUrl = (name: string) => {
  const revision = createHash('sha256')
    .update(readFileSync(new URL(`./public/icons/${name}`, import.meta.url)))
    .digest('hex').slice(0, 12);
  return `/icons/${name}?v=${revision}`;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    allowedHosts: ['terminal.local'],
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
    {
      name: 'soda-icon-urls',
      transformIndexHtml: html => html.replace(
        /href="\/icons\/(soda-favicon-32\.png|soda-apple-180\.png)"/g,
        (_match, name: string) => `href="${iconUrl(name)}"`
      ),
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
      },
      includeAssets: [
        'icons/soda-apple-180.png',
        'icons/soda-favicon-32.png',
        'icons/calendar-icon-64.svg',
        'icons/camera-icon-64.svg',
        'icons/chart-icon-64.svg',
        'icons/ClientProduct.svg',
        'icons/gallery-icon-64.svg',
        'icons/soda-192.png',
        'icons/soda-512.png',
        'icons/soda-maskable-512.png',
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
        description: 'Продажі, торгові точки та робота команди',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#06162e',
        theme_color: '#06162e',
        orientation: 'portrait',
        icons: [
          {
            src: iconUrl('soda-192.png'),
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: iconUrl('soda-512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: iconUrl('soda-maskable-512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
