import { minify, MinifyOptions } from 'terser'
import { Plugin } from 'vite'

export const compress = (whitelist: Array<'.js' | '.cjs'>, ops?: MinifyOptions): Plugin => {
  return {
    name: 'compress',
    enforce: 'post',
    apply: 'build',
    async generateBundle(_options, bundle) {
      for (const [fileName, bundleInfo] of Object.entries(bundle)) {
        if (whitelist.find(ext => fileName.endsWith(ext))) {
          const result = await minify((bundleInfo as any).code, ops ?? {
            format: {
              comments: false,
              beautify: false
            }
          })
          // 生成新文件
          const newFilename = fileName.replace(/(\.cjs|\.js)$/, '.min$1')
          this.emitFile({
            type: 'asset',
            fileName: newFilename,
            source: result.code,
          })
        }
      }
    }
  } satisfies Plugin
}
