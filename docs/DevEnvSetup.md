(本页面施工中)

实际上 JSX 语法是可选的。你完全可以不使用标签，而是使用 Kodex 导出的 jsx 工厂函数，该函数用于创建 JSX 元素，不过，使用它有一定的门槛，你需要了解 Kodex 支持的元素、属性等。一般来说不太有人愿意这么用。

## 配置 Kodex 的开发环境

安装构建工具 和 环境类型定义(可选)

```shell
npm install vite vite-mjs-to-zjs @vitejs/plugin-react @types/node
```

### 配置 vite 编译环境
在项目根目录创建文件 `./vite.config.js` 或 `./vite.config.ts`

配置参考:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // 用于编译 JSX 语法, 转为工厂函数的调用
import zdjl from 'vite-mjs-to-zjs' // 用于打包 zjs 文件
import path from 'path'
import pkg from './package.json'

export default defineConfig({
    plugins: [
      react({
        jsxRuntime: 'automatic',
        jsxImportSource: path.resolve('@zdjl/kodex')
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
      target: 'es2022', // 为了支持处理顶级 await 这里设定为es2022 ,但实际目标环境为es2020
      lib: {
        entry: 'src/index.tsx',
        formats: ['es'],
      },
    },
  })
```

### 配置 Typescript (可选)
在项目根目录创建文件 `./tsconfig.json`

配置参考:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./src/*"
      ],
    },
    "jsx": "react-jsx",
    "jsxImportSource": "@zdjl/kodex",
    "moduleResolution": "bundler",
    "module": "ES2022",
    "target": "ES2022",
    "lib": [
      "ES2020"
    ],
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": false,
    "noUnusedLocals": true,
    "types": [
      "node",
    ],
  },
  "include": [
    "src",
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

## 无编译环境

你可以在无编译环境中使用 Kodex，Kodex 发布的包中有独立工具可以解析 JSX 字符串。通过这个工具，你不需要事先编译 JSX 代码。它类似 Lit 框架的开发体验，但更简易，且没有类型和高亮。

以 `zdjl` 环境为例，通过该工具可做到开箱即用

```js
const { createSignal } = require('@zdjl/kodex')
const { jsx } = require('@zdjl/kodex/utils')

function MyComponent (props) {
  return jsx`<text extraTextAbove=${props.tip}>${props.children}</text>`
}

function Counter () {
  const [count, setCount] = createSignal(0)

  return jsx`
    <>
      <${MyComponent} tip='计数：'>${count}<//>
      <button onClick=${() => setCount(count() + 1)}>Count is: ${count}</button>
    </>
  `
}
```

上面这个例子展示了如何在无编译环境中：嵌套组件、传递静态属性、传递信号、设定事件

## 关于 jsx 字符串解析

> 该工具可独立使用, 并非必须与 Kodex 配合

### 语法规则和限制

标签：必须使用双标签形式，不支持单标签
组件闭合：可以使用 `<//>` 闭合自定义组件
动态值：使用 `${expression}` 插入动态值
属性：
静态属性：`<div id="main">`
动态属性：`<div class=${className}>`
展开属性：`<div ...${props}>`
空白处理：多余的空白和换行会被自动移除

### 注意事项

模板字符串必须以标签开始（`<` 字符）
开始标签和结束标签必须匹配（组件使用 `<//>` 闭合）
动态值必须是有效的占位符
展开属性必须是一个对象
不支持单标签语法（如 `<input />`）
