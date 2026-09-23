import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import basicSsl from '@vitejs/plugin-basic-ssl'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  plugins: [react(), basicSsl()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  define: {
    // Polyfill Node globals required by STOMP / crypto utilities
    global: 'window',
    'process.env': {}
  },

  server: {
    host: '0.0.0.0', // Listen on all network interfaces for hotspot clients
    port: 5173,
    https: true,     // MANDATORY: Forces secure context for WebCrypto & PTT on LAN IPs
    allowedHosts: true,
    hmr: {
      protocol: 'wss',
      clientPort: 443
    },

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        ws: true,
        secure: false,
        rewriteWsOrigin: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            // Suppress noisy ECONNREFUSED logs while backend is starting
            if (err.code !== 'ECONNREFUSED') {
              console.log('proxy error', err);
            }
          });
        }
      },
    },
  },
})