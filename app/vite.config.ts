import { defineConfig } from 'vite'

import path from 'node:path'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],

    resolve: {
        alias: {
            '@/shared': path.join(import.meta.dirname, '..', 'shared'),
            '@': path.join(import.meta.dirname, 'src'),
            'lucide-react/icons': path.join(import.meta.dirname, '..', 'node_modules', 'lucide-react', 'dist', 'esm', 'icons')
        }
    },

    server: {
        proxy: {
            '^/.*': {
                target: 'http://localhost:4422',
                changeOrigin: true
            }
        }
    },

    build: {
        target: 'esnext',
        rollupOptions: {
            output: {
                chunkFileNames: 'a/[name].js',
                entryFileNames: 'a/[name].js',
                assetFileNames: 'a/[name][extname]'
            }
        },
        emptyOutDir: true,
        chunkSizeWarningLimit: 750
    }
})