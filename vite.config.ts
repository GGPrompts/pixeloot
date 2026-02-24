import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pixeloot/',
  resolve: { alias: { '@': '/src' } },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: { pixi: ['pixi.js'], howler: ['howler'] },
      },
    },
  },
});
