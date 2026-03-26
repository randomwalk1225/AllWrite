import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const isProduction = process.env.NODE_ENV === 'production'
const isWeb = process.env.BUILD_TARGET === 'web'

async function getElectronPlugin(): Promise<Plugin[]> {
  if (isWeb) return []
  const electron = (await import('vite-plugin-electron')).default
  return electron([
    {
      entry: 'electron/main.ts',
      onstart(args: any) {
        if (args.startup) args.startup()
      },
      vite: { build: { outDir: 'dist-electron' } },
    },
    {
      entry: 'electron/preload.ts',
      vite: { build: { outDir: 'dist-electron' } },
    },
  ]) as Plugin[]
}

export default defineConfig(async () => ({
  server: {
    port: 5173,
  },
  build: {
    outDir: isWeb ? 'dist-web' : 'dist',
    rollupOptions: {
      input: isWeb
        ? { main: path.resolve(__dirname, 'index.html') }
        : {
            main: path.resolve(__dirname, 'index.html'),
            writing: path.resolve(__dirname, 'writing.html'),
          },
    },
    minify: isProduction ? 'terser' : 'esbuild',
    terserOptions: isProduction ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        toplevel: true,
      },
    } : undefined,
  },
  esbuild: {
    drop: isProduction ? ['console', 'debugger'] : [],
  },
  plugins: [
    react(),
    ...await getElectronPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
