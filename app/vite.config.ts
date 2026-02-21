import { defineConfig } from 'vite'

import path from 'node:path'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const doAbsolute = 'ABSOLUTE' in Bun.env;

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
                chunkFileNames: doAbsolute ? 'a/[name].js' : 'a/[hash].[name].js',
                entryFileNames: doAbsolute ? 'a/[name].js' : 'a/[hash].[name].js',
                assetFileNames: doAbsolute ? 'a/[name][extname]' : 'a/[hash].[name][extname]'
            }
        },
        chunkSizeWarningLimit: 750
    }
})