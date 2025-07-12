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
        '@': path.resolve('src'),
        '#': path.resolve('.')
      }
    },
    build: {
      minify: false,
      outDir: 'dist',
      lib: {
        entry: {
          'index': 'src/index.ts',
          'core': 'src/core/index.ts',
          'utils/jsx-parser': 'src/utils/jsx-parser.ts',
          'components': 'src/components/index.ts',
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
          filename: 'kodex.test',
          formats: ['zjs']
        },
        manifest: {
          description: `\
            构建日期: ${new Date().toLocaleString()}
            版本: ${pkg.version}
            作者: ${pkg.author}
            许可证: ${pkg.license}`.replace(/[^\S\n]{2,}/g, ''),
          count: 'unknown',
        }
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('./src'),
        '#': path.resolve('.')
      }
    },
    build: {
      minify: false,
      target: 'es2022',
      lib: {
        entry: 'src/example/entry.test.tsx',
        formats: ['es'],
      },
      outDir: 'cache',
      rollupOptions: {
        external: ['fs'],
      }
    },
  })

export default defineConfig(({ mode }) => {
  if (mode === 'test') {
    return testConfig()
  } else {
    return productionConfig()
  }
})
