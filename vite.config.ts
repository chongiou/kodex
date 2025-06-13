import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import zdjl from 'vite-mjs-to-zjs'
import path from 'path'
import pkg from './package.json'
import { compress } from './plugin/compress'

const productionConfig = () =>
  defineConfig({
    plugins: [
      react({ jsxRuntime: 'automatic', jsxImportSource: path.resolve('src') }),
      compress(['.cjs']),
    ],
    resolve: {
      alias: {
        '@': path.resolve('src')
      }
    },
    build: {
      minify: false,
      outDir: 'lib',
      lib: {
        entry: {
          'index': 'src/index.ts',
        },
        formats: ['es', 'cjs'],
      },
      target: 'es2022'
    }
  })

const testConfig = () =>
  defineConfig({
    plugins: [
      react({
        jsxRuntime: 'automatic',
        jsxImportSource: path.resolve('src')
      }),
      zdjl({
        output: {
          outdir: 'dist',
          filename: `${pkg.name}.test`,
          formats: ['zjs']
        },
        manifest: {
          description: `build-date: ${new Date().toLocaleString()}\nversion: ${pkg.version}\nauthor: ${pkg.author}\nlicense: ${pkg.license}`,
          count: 'unknown',
        }
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('./src')
      }
    },
    build: {
      minify: false,
      target: 'es2022',
      lib: {
        entry: 'src/test/index.tsx',
        formats: ['es'],
      },
    },
  })

export default defineConfig(({ mode }) => {
  if (mode === 'test') {
    return testConfig()
  } else {
    return productionConfig()
  }
})
