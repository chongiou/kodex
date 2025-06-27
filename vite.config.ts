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
      compress(['.cjs'], ['index.cjs', 'jsx-runtime.cjs']),
    ],
    resolve: {
      alias: {
        '@': path.resolve('src')
      }
    },
    build: {
      minify: false,
      outDir: 'dist',
      lib: {
        entry: {
          'index': 'src/index.ts',
          'core': 'src/core/index.ts',
          'utils/parse-jsx-string': 'src/utils/parse-jsx-string.ts',
          'utils/components': 'src/utils/components.tsx',
          'jsx-runtime': 'src/jsx-runtime.ts',
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
          filename: `kodex.test`,
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
      outDir: 'cache'
    },
  })

export default defineConfig(({ mode }) => {
  if (mode === 'test') {
    return testConfig()
  } else {
    return productionConfig()
  }
})
