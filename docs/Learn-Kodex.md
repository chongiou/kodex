## 概述

Kodex 是一个用于对话框的渲染引擎, 它的目标环境是 `zdjl`，它使用 JavaScript 和 JSX 来描述应用的对话框界面，并基于信号( `Signal` )来实现响应式系统

Kodex API 设计参考了 SolidJS ，但有一些差异。

在 Kodex 中， 凡是需要传递信号的插槽，都不能直接调用信号(不能传递值，而是传递调用信号的函数)，需要使用 `() => signal()` 的形式来传递信号
> 因为 Kodex 是运行时系统，没有 SolidJS 那样的编译优化

## 安装

```shell
npm install kodex
```

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

> 上面的代码使用了内置标签 root 和 main。有关内容请查看 API 参考

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

上面使用的标签叫做 JSX， JSX 允许你在 Javascript 编写类似 Html 的标签，但实际会转为 Javascript 函数调用。JSX 比 Html 更严格，你必须闭合标签，比如 `<Button>` 必须写成 `<Button/>`。

组件不能同时返回多个标签，你必须让多个标签共享同一个父级，比如使用一个空标签 `<> ... </>`

```jsx
function SettingPage() {
  // 坏代码！❌
  return (
    <text style={{ fontSize: 20 }}>设置</text>
    <p>设置页面</p>
  )
}

function SettingPage() {
  // 好代码！✅
  return (
    <>
      <text style={{ fontSize: 20 }}>设置</text>
      <p>设置页面</p>
    </>
  )
}
```

## 属性

组件可以接受属性，属性是组件的配置，比如按钮的文字，按钮的背景颜色。组件的第一个参数是所有传入的属性的集合，children 属性是组件的子元素，其他属性则可以自行定义

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

Kodex 的响应式系统基于信号( `Signal` )， 你可以使用 `createSignal` 创建一个信号，信号是一个可观察的值，当信号的值发生变化时，会自动触发组件的重新渲染。

```jsx
function Counter() {
  const [count, setCount] = createSignal(0)
  return <button onClick={() => setCount(count() + 1)}>Count is: {count}</button>
}
```
> `Count is: {count}` 这里看起来像语法糖，但其实不是的，信号 Getter 应该包裹在函数内，即应为：`Count is: {() => count()}` ，但由于 信号 Getter 本身也是函数并且对它没有任何修饰，希望直接使用值，所以就直接传递了

## 条件渲染
⚠️: Kodex 无法实现条件渲染, 由于目标环境的限制, Kodex 无法在运行时更新 UI 结构

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

### 静态列表渲染
Kodex 没有特殊的语法和组件来渲染列表, 你只需要返回一组标签即可  
注意: 列表不需要 `key` 属性, 这里不是前端

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
    {
      data.map(item => {
        return <text>{item.name}</text>
      })
    }
   </>
  )
}
```
