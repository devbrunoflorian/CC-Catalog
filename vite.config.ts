import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync } from 'node:fs';

export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        electron([
            {
                entry: 'src/main/index.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron/main',
                        rollupOptions: {
                            external: ['adm-zip', 'sql.js'],
                        },
                    },
                },
            },
        ]),
        renderer(),
        {
            name: 'copy-preload',
            writeBundle() {
                copyFileSync('src/main/preload.cjs', 'dist-electron/main/preload.cjs');
            }
        }
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
        },
    },
    server: {
        port: 3333,
    },
});
