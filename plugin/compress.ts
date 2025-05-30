import { minify, MinifyOptions } from 'terser'
import { Plugin } from 'vite'

export const compress = (whitelist: Array<'.js' | '.cjs'>, ops?: MinifyOptions) => {
  return {
    name: 'compress',
    async generateBundle(_, bundle) {
      for (const [fileName, bundleInfo] of Object.entries(bundle)) {
        if (whitelist.find(ext => fileName.endsWith(ext))) {
          const result = await minify((bundleInfo as any).code, ops ?? {
            format: {
              comments: false,
              beautify: false
            }
          });
          (bundleInfo as any).code = result.code
        }
      }
    }
  } satisfies Plugin
}
