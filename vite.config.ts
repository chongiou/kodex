import { defineConfig } from 'vite'
import zdjl from 'vite-mjs-to-zjs'
import path from 'path'
import pkg from './package.json'

const productionConfig = () =>
  defineConfig({
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
          'components': 'src/components/index.ts',
          'jsx-runtime': 'src/jsx-runtime.ts',
        },
        formats: ['es'],
      },
      target: 'es2022'
    },
  })

const productionConfigForZdjl = () =>
  defineConfig({
    resolve: {
      alias: {
        '@': path.resolve('src'),
        '#': path.resolve('.')
      }
    },
    build: {
      minify: true,
      outDir: 'dist/zdjl',
      lib: {
        entry: {
          'index': 'src/zdjl/index.ts',
          'core': 'src/core/index.ts',
          'jsx-parser': 'src/utils/jsx-parser.ts',
          'components': 'src/components/index.ts',
        },
        formats: ['cjs'],
        fileName(format, entryName) {
          return entryName + '.min.cjs'
        },
      },
      target: 'es2022'
    },
  })

const testConfig = () =>
  defineConfig({
    plugins: [
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
  }

  if (mode === 'zdjl') {
    return productionConfigForZdjl()
  }

  return productionConfig()
})
