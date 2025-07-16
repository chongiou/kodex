# 配置 Kodex 的开发环境

Kodex 的目标是在 `zdjl` 上运行，我们有两种方式可以选:
1. 在编译环境使用 Kodex，配置编译环境，从 `TSX` 文件编译并打包 `zjs` 文件
2. 在原生环境使用 Kodex，从网络或本地加载 Kodex，直接在 `zdjl` 环境使用 `jsx` 字符串语法

## 方式一
### 使用 cli 创建项目 - 需安装 nodejs，可选安装 adb

打开终端  
进入你存放项目的文件夹

```sh
npm init kodex-app@latest
```
或
```sh
npx create kodex-app@latest
```

#### 编译

打开终端，输入命令

```sh
npx vite build
```
构建成功后，查看 `./dist` 目录是否生成 js 文件和 zjs 文件

## 方式二

你可以在无编译环境中使用 Kodex，Kodex 发布的包中有独立工具可以解析 JSX 字符串。通过这个工具，你不需要事先编译 JSX 代码。它类似 Lit 框架的开发体验，但更简易，且没有类型和高亮。

以 `zdjl` 环境为例，通过该工具可做到开箱即用

```js
globalThis.zdjl = zdjl // 让模块能访问到
const { 
  parseJSX: jsx,
  createSignal, 
  render,
} = require(`@zdjl/kodex@latest/dist/zdjl/index.min.cjs`)

function MyComponent (props) {
  return jsx`<text extraTextAbove=${props.tip}>${props.children}</text>`
}

function Counter () {
  const [count, setCount] = createSignal(0)

  // 使用 <//> 结束组件标签，因为需要传递 children 属性（count）
  return jsx`
    <>
      <input type='text' name='user_in' value=${count} />
      <${MyComponent} tip='计数:'>${count}<//>
      <button onClick=${() => setCount(count() + 1)}>增加计数</button>
    </>
  `
}

// 使用单标签结束组件，因为不需要传递 children 属性
const counterDialog = render(jsx`<${Counter} />`) 
const res = await counterDialog.show()
console.log(res.input)  // -> { "user_in": number }
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
