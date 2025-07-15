(本页面施工中，可能有遗漏或错误)

# 配置 Kodex 的开发环境

Kodex 的目标是在 `zdjl` 上运行，我们有两种方式可以选:
1. 在编译环境使用 Kodex，配置编译环境，从 `TSX` 文件编译并打包 `zjs` 文件
2. 在原生环境使用 Kodex，从网络或本地加载 Kodex，直接在 `zdjl` 环境使用 `jsx` 字符串语法

## 方式一
### 创建项目

打开终端
创建并进入项目文件夹 - 此处以 abc 文件夹名称为例

```sh
mkdir abc; cd abc
```

初始化 npm 包

```sh
npm init -y
```

安装相关依赖

```sh
npm i @zdjl/kodex
```

```sh
npm i -D vite vite-mjs-to-zjs @vitejs/plugin-react @types/node
```

- `@vitejs/plugin-react` 用于编译 `JSX` 代码为 `JSX` 工厂函数调用
-  `vite-mjs-to-zjs` 用于打包 `JS` 文件到 `zjs` 文件，更多用法请查看[其 Github 页面](https://github.com/chongiou/vite-mjs-to-zjs)
- `@types/node` 为 node 模块提供类型

打开项目 (需安装 vscode)

```sh
code ./
```

### 配置 vite

在项目根目录创建文件 `vite.config.js` 或 `vite.config.ts`

配置参考:
```js
import { defineConfig } from 'vite'
import zdjl from 'vite-mjs-to-zjs'
import path from 'path'
import pkg from './package.json'

export default defineConfig({
  plugins: [
    zdjl({
      output: {
        filename: pkg.name,
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
      '@': path.resolve('./src')
    },
  },
  build: {
    minify: false,
    target: 'es2022',
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
    },
    outDir: 'dist',
  },
})
```

### 配置 Typescript （JSX 类型提示）
在项目根目录创建文件 `tsconfig.json`

配置参考:
```json
{
  "compilerOptions": {
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
    "declaration": true,
    "lib": [
      "ES2020",
      "DOM"
    ],
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": false,
    "noUnusedLocals": true,
  },
  "include": [
    "src"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}

```

创建项目入口 `src/index.tsx`

示例代码:

```jsx
import { render, createSignal, onMount, onCleanup } from '@zdjl/kodex'

declare const zdjl: any

const App = () => {
  const [count, setCount] = createSignal(0)
  
  let interval: NodeJS.Timeout

  onMount(() => {
    zdjl.alert("App mounted")
    interval = setInterval(() => {
      setCount(prev => prev + 1)
    }, 1000)
  })

  onCleanup(() => {
    zdjl.alert("App unmounted")
    clearInterval(interval)
  })
  
  return (
    <root>
      <header>Hello Kodex!</header>
      <main>
        <text>Count is {count}</text>
      </main>
      <footer>
        <button>none</button>
      </footer>
    </root>
  )
}

const res = render(<App />)
await res.show()

```

### 编译

打开终端，输入命令

```sh
npx vite build
```
构建成功后，查看 `./dist` 目录是否生成 js 文件和 zjs 文件

## 方式二

你可以在无编译环境中使用 Kodex，Kodex 发布的包中有独立工具可以解析 JSX 字符串。通过这个工具，你不需要事先编译 JSX 代码。它类似 Lit 框架的开发体验，但更简易，且没有类型和高亮。

以 `zdjl` 环境为例，通过该工具可做到开箱即用

```js
const { createSignal, render } = require(`@zdjl/kodex/dist/core.min.cjs`)
const { parseJSX: jsx } = require(`@zdjl/kodex/dist/utils/jsx-parser.min.cjs`)
globalThis.zdjl = zdjl // 暴露到全局，让模块能访问到

function MyComponent (props) {
  return jsx`<text extraTextAbove=${props.tip}>${props.children}</text>`
}

function Counter () {
  const [count, setCount] = createSignal(0)

  return jsx`
    <>
      <input type='text' name='user_in' value=${count}></input>
      <${MyComponent} tip='计数:'>${count}<//>
      <button onClick=${() => setCount(count() + 1)}>增加计数</button>
    </>
  `
}

const counterDialog = render(jsx`<${Counter}><//>`)
const res = await counterDialog.show()
console.log(res.input)
```

上面这个例子展示了如何在无编译环境中：嵌套组件、传递静态属性、传递信号、设定事件

## 关于 jsx 字符串解析

> 该工具可独立使用, 并非必须与 Kodex 配合

### 语法规则和限制

标签：
- 组件闭合：可以使用 `<//>` 闭合自定义组件
- 动态值：使用 `${expression}` 插入动态值

属性：
- 静态属性：`<input name="username">`
- 动态属性：`<input onChange=${handleFunction}>`
- 展开属性：`<input ...${props}>`
- 空白处理：多余的空白和换行会被自动移除

### 注意事项

- 模板字符串必须以标签开始（`<` 字符）
- 开始标签和结束标签必须匹配（组件使用 `<//>` 闭合）
- 动态值必须是有效的占位符
- 展开属性必须是一个对象
