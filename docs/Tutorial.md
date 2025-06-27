(本页面施工中)

## 介绍

欢迎来到 Kodex 教程，本文档将教你使用 Kodex。可参考 API 了解更多。

Kodex 受到 SolidJS 启发 ，但有一些差异。  
在 Kodex JSX 中，凡是需要传递信号的插槽，都不能直接调用信号(不调用信号，而是传递调用信号的函数)，需要使用 `() => signal()` 的形式来传递信号
> Kodex 是运行时系统，没有 SolidJS 那样的编译优化

## Kodex 是什么
Kodex 是一个在 `zdjl` 环境渲染界面(对话框)的渲染引擎，它使用 JavaScript 和 JSX 来描述 UI，并集成基于信号( `Signal` )的响应式系统。

## 组件

组件是返回标签的函数，Kodex 应用由组件构成，组件是 UI 的一部分， 它可以包含自己的逻辑和外观。组件可以小到一个按钮，也可以大到整个页面。

创建组件：

```jsx
function Button() {
  return <button>我是一个按钮</button>
}
```

嵌套组件：

```jsx
function App() {
  return (
    <root>
      <header>Hello Kodex！</header>
      <main>
        <Button />
      </main>
    </root>
  )
}
```

你可能已经注意到，组件是大写开头的。自定义组件必须是大写开头的，这是规范，构建工具等也会据此识别组件。

> 上面的代码使用了内置标签 root 和 main。

让我们看看效果：
```jsx
function Button() {
  return <button>我是一个按钮</button>
}

function App() {
  return (
    <root>
      <header>Hello Kodex！</header>
      <main>
        <Button />
      </main>
    </root>
  )
}

const app = render(<App />)
await app.show()
```

TODO：此处应有图片，待施工

## JSX

上面使用的标签叫做 JSX， JSX 允许你在 Javascript 编写类似 HTML 的标签，但实际会转为 Javascript 函数调用。JSX 比 HTML 更严格，你必须闭合标签，比如 `<br>` 必须写成 `<br/>`。

组件不能同时返回多个标签，你让多个标签共享同一个父级，比如使用一个空标签 `<> ... </>` 包裹子级。

```jsx
function SettingPage() {
  // 坏代码！❌
  return (
    <text style={{ fontSize: 20 }}>设置</text>
    <text>设置页面</text>
  )
}

function SettingPage() {
  // 好代码！✅
  return (
    <>
      <text style={{ fontSize: 20 }}>设置</text>
      <text>设置页面</text>
    </>
  )
}
```

## 属性

组件可以接受属性，属性是组件的配置，比如按钮的文字，按钮的背景颜色。组件的第一个参数是所有传入的属性的集合，`children` 属性是组件的子元素，其他属性则可以自行定义

```jsx
function MyButton(props) {
  const style = {
    align: 'center',
    bgColor: props.bgColor,
  }
  return <button style={style}>{props.children}</button>
}

function App() {
  return <MyButton bgColor="#409EFF">我是一个按钮</MyButton>
}
```

## 甩手掌柜

以上基础概念在 Kodex、React 以及 SolidJS 中是通用的，在撰写本文时也参考了 [React 文档](https://zh-hans.react.dev/learn) 的内容，可以去看看。

## 弹窗结构
Kodex 的目标是在目标环境渲染对话框。  
Kodex 可以描述对话框的整个结构，只需包裹在 `root` 元素中

```jsx
function App() {
  return (
    <root>
      <header>弹窗标题</header>
      <main>
        <text>弹窗主内容区</text>
      </main>
      <footer>
        <button>取消弹窗</button>
        <button>确认弹窗</button>
      </footer>
    </root>
  )
}
```

当你不需要定制标题和页脚时，可以省略 `root` `header` `footer`, 甚至是 `main`，只保留 `main` 的子元素即可。

```jsx
function App() {
  return (
    <text>弹窗主内容区</text>
  )
}
```

## 响应式数据源

Kodex 的响应式系统基于信号( `Signal` )， 你可以使用 `createSignal` 创建一个信号，当信号的值发生变化时，UI会自动反应其变化。

```jsx
function Counter() {
  const [count, setCount] = createSignal(0)
  return <button onClick={() => setCount(count() + 1)}>Count is: {count}</button>
}
```
> `Count is: {count}` 这里看起来像语法糖，但其实不是的，信号 Getter 应该包裹在函数内，即应为：`Count is: {() => count()}` ，但由于 信号 Getter 本身也是函数并且对它没有任何修饰，希望直接使用值，所以就直接传递了

## 条件渲染
⚠️：Kodex 无法实现条件渲染, 由于目标环境的限制, Kodex 无法在运行时更新 UI 结构  
✅：为了减少沟通成本，当我们说条件渲染时，实际指的是条件显示

## 条件显示

你可以使用 hidden 属性来实现简单的条件显示, 当 hidden 为 true 时, 组件不会被渲染
  
```jsx
function App() {
  const [show, setShow] = createSignal(false)
  return (
    <>
      <text hidden={() => !show()}>Hello Kodex！</text>
      <button onClick={() => setShow(!show())}>Toggle Show</button>
    </>
  )
}
```

你也可以使用官方组件 `Show` 

```jsx
import { Show, createSignal} from 'kodex'

function App() {
  const [show, setShow] = createSignal(false)
  return (
    <>
      <Show when={show} fallback={<text>Loading...</text>}>
        <text>Hello Kodex！</text>
      </Show>
      <button onClick={() => setShow(!show())}>Toggle Show</button>
    </>
  )
}
```

使用 `Switch` 组件来实现更复杂的条件显示

``` jsx
import { Switch, Match, createSignal} from 'kodex'

function App() {
  const [show, setShow] = createSignal(false)
  // 模拟异步加载
  setTimeout(() => {
    // 一秒后显示
    setShow(true)
  })
  return (
    <Switch>
     <Match when={() => show()}>
      <text>Hello Kodex！</text>
     </Match>
     <Match when={() => !show()}>
      <text>Loading...</text>
     </Match>
    </Switch>
  )
}
```

## 列表渲染

### 动态列表渲染

⚠️：Kodex 无法实现动态列表渲染，由于目标环境限制，Kodex 无法在运行时更新 UI 结构。
✅：为了减少沟通成本，当我们说动态列表渲染时，实际指的是静态列表渲染。

### 静态列表渲染
Kodex 没有特殊的语法和组件来渲染列表, 你只需要返回一组标签即可  
注意: 列表不需要 `key` 属性, 这里不是前端框架

```jsx
function App() {
  // 假设你从网络接口那获取了一组数据,你需要把它放在页面上
  const data = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
  ]
  return (
   <>
    {data.map(item => <text>{item.name}</text>)}
   </>
  )
}
```

## 🌀 边缘话题

### 设计理念

Kodex 遵循以下设计原则：

* **✨ 简单胜过复杂**：用最简单的方式表达复杂的逻辑
* **📝 声明胜过命令**：描述你想要什么，而不是怎么做
* **⚡ 自动胜过手动**：让系统自动处理繁琐的细节
* **🛡️ 安全胜过灵活**：通过类型系统保证代码质量

通过这些理念，Kodex 让界面开发变得简单、直观、高效。无论你是初学者还是经验丰富的开发者，都能快速上手并享受愉快的开发体验。🎉
