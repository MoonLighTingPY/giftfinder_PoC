import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'process'

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd())
  
  return {
    plugins: [react()],
    server: {
      host: env.VITE_DEV_SERVER_HOST || 'localhost',
      port: env.VITE_DEV_SERVER_PORT || 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001', // Point to Express server
          changeOrigin: true,
        }
      },
      headers: {
        // Add CSP headers to allow necessary resources
        'Content-Security-Policy': `
          default-src 'self';
          script-src 'self' 'unsafe-inline' 'unsafe-eval';
          style-src 'self' 'unsafe-inline';
          img-src 'self' data: https://images.pexels.com;
          font-src 'self';
          connect-src 'self' http://localhost:3001 ws://localhost:*;
        `.replace(/\s+/g, ' ').trim()
      }
    },
    build: {
      // Ensure output assets have correct URL format
      assetsDir: 'assets',
      // Generate CSP-compatible file hashes instead of inline styles when possible
      cssCodeSplit: true,
    }
  }
})