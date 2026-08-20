import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || ''
  // Se construye como RegExp (no como función con closure): workbox serializa
  // el service worker a texto plano, así que una función que capture
  // `supabaseUrl` del entorno de Node dejaría una variable indefinida en
  // tiempo de ejecución del SW. Un RegExp se serializa con su patrón embebido.
  const supabaseUrlPattern = supabaseUrl
    ? new RegExp(`^${supabaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`, 'i')
    : /^$/

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'XANDER Gestión',
          short_name: 'XANDER',
          description: 'Gestión de presupuestos, facturas y obras para reformas — XANDER Reformas',
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait-primary',
          theme_color: '#1A1A2E',
          background_color: '#F0EBE0',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            // Datos de Supabase (facturas, obras, clientes...): red primero,
            // pero si no hay conexión se sirve la última respuesta cacheada.
            {
              urlPattern: supabaseUrlPattern,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'xander-supabase-api',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24, // 1 día
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Tipografía Google Fonts
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'xander-google-fonts-stylesheets' },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'xander-google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    server: { port: 3000 },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
  }
})
