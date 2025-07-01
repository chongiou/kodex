(本页面施工中)

## 介绍

欢迎来到 Kodex 教程！本文档将引导您使用 Kodex 构建交互式对话框。

Kodex 的设计灵感来源于 SolidJS，但作为专为 `zdjl` 目标环境设计的**运行时**系统，它与 SolidJS 这样的编译时框架存在一些关键差异。理解这些差异是高效使用 Kodex 的关键。

> **核心差异**: 您的 JSX 代码在运行时被转换。这意味着它无法像 SolidJS 那样通过编译优化来自动处理响应性。您需要更明确地告诉 Kodex "哪些是响应式数据"。

## Kodex 是什么

Kodex 是一个在 `zdjl` 环境中渲染原生对话框的 UI 框架。它使用开发者熟悉的 JSX 语法来声明式地描述 UI，并内置了基于**信号 (Signal)** 的响应式系统，让数据驱动视图更新变得简单直观。

**工作流程：**

1. **您编写的代码**:
   
   ```jsx
   <text>{name}</text>
   ```

2. **构建工具的转换 (vite)**:
   您的构建工具会将 JSX 转换为标准的 JavaScript 函数(jsx工厂函数)调用，这对于所有 JSX 库都是必需的步骤。
   
   ```javascript
   // 类似于这样的转换结果
   jsx({ type: 'text', children: name }); 
   ```

3. **Kodex 的魔法**:
   Kodex 的 `render` 函数在运行时接收到第二步的结果。它会检查 `props` 对象（`{ children: name }`），发现 `name` 属性是一个函数，于是它就明白：这是可能一个响应式数据，尝试追踪它的变化，建立依赖关系（容错）。

这个“运行时检查”就是 Kodex 的核心。它不像 SolidJS 那样预先编译好所有更新路径，而是在运行时动态地建立它们。


## 术语定义
在本文档中，我们使用以下术语区分组件：
1. **原生组件**  
   - **命名规则**：全小写（如 `<input>`, `<button>`）。  
   - **特点**：直接对应目标环境基础元素，提供最基础的功能。

2. **自定义组件**
   - **命名规则**：首字母大写（如 `<Show>`, `<Switch>`）。  
   - **特点**：自定义组件是返回 UI 元素(JSX) 的函数。

3. **增强组件**  
   - **特点**：Kodex 提供的基于原生组件封装的自定义组件，提供高级功能（如预设样式、交互逻辑、复合行为）。  

4. **组件**  
   - 当我们说组件时，可能同时指向 原生组件、增强组件、自定义组件

### **FAQ 补充**
- **Q**：为什么有些组件既有小写又有大写形式？  
  **A**：小写是基础实现，大写是开箱即用的增强版，两者可按需选择。  
- **Q**：自定义组件能否用小写？  
  **A**：不能，所有自定义组件必须大写开头（如 `<MyComponent>`），以避免命名冲突。  

## 核心概念

### JSX

JSX 是一种 JavaScript 的语法扩展，允许您在代码中编写类似 HTML 的标签。它比 HTML 更严格，所有标签都必须闭合，例如 `<br>` 必须写成 `<br />`。

### 组件

一个 Kodex 应用由各种组件组合而成，每个组件封装了自己的逻辑和视图。

**创建自定义组件：** 组件函数名必须以**大写字母**开头。

```jsx
function MyButton() {
  return <button>我是一个按钮</button>
}
```

**嵌套组件：** 将组件像 HTML 标签一样使用，构建复杂的 UI。

```jsx
function App() {
  return (
    <root>
      <header>Hello Kodex！</header>
      <main>
        <MyButton />
      </main>
    </root>
  )
}

// 渲染应用
const app = render(<App />)
await app.show()
```

（TODO：此处应有图片）

一个组件不能直接返回多个并列的标签。您必须用一个父元素将它们包裹起来，或者使用一个空标签（Fragment）`<> ... </>`。

```jsx
function Page() {
  // 错误！❌ 不能返回多个顶级元素
  return (
    <text style={{ fontSize: 20 }}>设置</text>
    <text>设置页面</text>
  )
}

function Page() {
  // 正确！✅ 使用 Fragment 包裹
  return (
    <>
      <text style={{ fontSize: 20 }}>设置</text>
      <text>设置页面</text>
    </>
  )
}
```

### 属性 (Props)

组件通过属性接收外部数据。属性以一个 `props` 对象的形式作为组件的第一个参数传入。`props.children` 是一个特殊的属性，它包含了组件的子元素。

```jsx
function MyButton(props) {
  // 定义样式对象
  const style = {
    align: 'center',
    bgColor: props.bgColor, // 从 props 获取背景色
  }

  // 将 style 和 children 传递给内置的 <button> 组件
  return <button style={style}>{props.children}</button>
}

function App() {
  return <MyButton bgColor="#409EFF">点击我</MyButton>
}
```

## 弹窗结构

Kodex 旨在渲染完整的对话框。使用 `<root>` 标签可以定义对话框的各个部分：

- `<header>`: 对话框标题。
- `<main>`: 对话框的主内容区域。
- `<footer>`: 对话框的页脚，放置“确认”和“取消”按钮。

```jsx
function App() {
  return (
    <root>
      <header>弹窗标题</header>
      <main>
        <text>这是弹窗的主内容区。</text>
      </main>
      <footer>
        <button>取消</button>
        <button>确认</button>
      </footer>
    </root>
  )
}
```

当您不需要自定义标题和页脚时，可以省略 `<root>`, `<header>`, `<footer>` 甚至 `<main>` 标签，Kodex 会使用默认设置。

```jsx
// 这样也是合法的
function App() {
  return <text>这是弹窗的主内容区。</text>
}
```

## 响应式系统基础 - 用法与概念

Kodex 的核心是基于信号（Signal）的响应式系统。

### 创建响应式数据源

使用 `createSignal` 创建一个信号。它返回一个包含两个元素的数组：一个**getter**函数（用于读取值）和一个**setter**函数（用于更新值）。

```jsx
import { createSignal } from '@zdjl/kodex'
const [count, setCount] = createSignal(0)
```

- `count()`: 调用 getter **读取**当前值 (例如: `0`)。
- `setCount(1)`: 调用 setter **更新**值。
- `setCount(c => c + 1)`: setter 也接受一个函数，用于基于旧值计算新值。

### 传递信号

现在您已经了解 Kodex 是一个“运行时”框架，那么向组件传递信号的规则就变得非常清晰了：**您传递给属性的，必须是能让 Kodex 在运行时识别出其为“响应式”的线索。**

一个函数，就是最好的线索。

**1. 简写形式 (The Shorthand): `{signal}`**

当您只是想把信号的当前值直接传递给一个属性时，可以直接传递信号的 getter 函数本身。

```jsx
const [name, setName] = createSignal("路人甲");

// 正确: 您传递了 `name` 这个 getter 函数本身
// Kodex 运行时检查到它是个函数，于是建立响应式追踪
<text>{name}</text> 
```

**2. 完整形式 (The Explicit Form): `{() => signal()}`**

当您的响应式逻辑包含任何计算、拼接或条件判断时，您必须提供一个**新的函数**来包裹这些逻辑。

```jsx
const [count, setCount] = createSignal(0);
const [show, setShow] = createSignal(true);

// 正确: 您提供了新的箭头函数，Kodex 运行时会追踪这个新函数
<text>{() => "当前计数值: " + count()}</text>
<text hidden={() => !show()}>当 hidden 为 false 时显示</text>
```

**错误示范 ❌ - 这不会按预期工作!**

```jsx
// 错误: "当前计数值: " + count
// 您尝试将一个字符串和一个函数对象相加，结果会是 "当前计数值: () => ..." 字符串
// Kodex 运行时只收到了一个普通字符串，无法建立响应式。
<text>{"当前计数值: " + count}</text>

// 错误: !show
// 您对 `show` 这个函数对象进行了逻辑非操作，结果是 `false`
// Kodex 运行时只收到了一个布尔值 `false`，同样无法建立响应式。
<text hidden={!show}>
```

**推荐用法总结:**

- **简单传递值**：使用简写 `{signal}`，代码更简洁。
- **包含任何逻辑**：**必须**使用完整写法 `{() => ...}` 来创建一个新的函数，将逻辑包裹起来。

现在让我们看一个完整的例子：

```jsx
function Counter() {
  const [count, setCount] = createSignal(0)

  return (
    <>
      {/* 按钮文本：使用了简写形式，因为只是直接显示 count 的值 */}
      <button onClick={() => setCount(prev => prev + 1)}>
        Count is: {count}
      </button>

      {/* 条件显示：必须使用完整形式，因为包含了逻辑判断 */}
      <text hidden={() => count() < 5}>
        只有当 Count 大于等于 5 时才会显示我！
      </text>

      {/* 变色按钮：或者更复杂一点，嵌入三元表达式逻辑 */}
      <button style={{ bgColor: () => count() > 5 ? '#FF0000' : '#409EFF' }}>
        变色按钮
      </button>
    </>
  )
}
```

## 响应式系统进阶 - 衍生信号与可组合性

我们已经了解了如何使用 `createSignal` 创建基础的响应式数据源。但 Kodex 响应式系统的真正威力在于它的**可组合性**。

**核心理念：任何返回值的函数，如果内部访问了信号，它本身就变成了一个可追踪的“衍生信号”。**

### 衍生信号

Signal 是包装可跟踪值的简单 getter 函数。没有什么特别的。这意味着任何包装访问 Signal 的函数实际上都是一个 Signal 并且也是可跟踪的。放在 JSX 中的任何 JavaScript 表达式也是如此。只要它访问一个 Signal，它就会被跟踪。

这是响应式系统中最优雅的部分——**可组合性 (Composability)**。
将衍生逻辑提取为独立的、可复用的信号（或在 SolidJS 中称为 memo 或 derived signal），这是一种**强烈推荐的最佳实践**。

### 告别 JSX 中的复杂逻辑

还记得我们之前讨论的“完整形式”吗？

```jsx
// 之前的写法，在 JSX 中嵌入了逻辑
<text hidden={() => count() < 5}>...</text>
<button style={{ bgColor: () => count() > 5 ? '#FF0000' : '#409EFF' }}>...</button>
```

这种写法虽然可行，但当逻辑变复杂时，JSX 就会变得臃肿且难以阅读。一个更优雅、更高效的实践是：**将衍生逻辑提取为独立的信号**。

```jsx
function Counter() {
  const [count, setCount] = createSignal(0)

  // 1. 创建衍生信号 (Derived Signals)
  const isCountTooLow = () => count() < 5
  const buttonColor = () => count() > 5 ? '#FF0000' : '#409EFF'

  // 2. 在 JSX 中使用简写形式，因为 isCountTooLow 和 buttonColor 本身就是信号！
  return (
    <>
      <button onClick={() => setCount(prev => prev + 1)}>
        Count is: {count}
      </button>

      <text hidden={isCountTooLow}>
        只有当 Count 大于等于 5 时才会显示我！
      </text>

      <button style={{ bgColor: buttonColor }}>
        变色按钮
      </button>
    </>
  )
  // 如此一来，JSX 将变得极其清晰和声明式
}
```

**为什么这是更好的方式？**

- **声明式**：你的 JSX 现在只描述“显示什么”，而不是“如何计算”。`hidden={isCountTooLow}` 完美地表达了意图：“这个元素的隐藏状态由 `isCountTooLow` 决定”。
- **高效**：如果 `isCountTooLow` 被多个组件使用，它的计算结果（`true` 或 `false`）只会在 `count` 变化时计算一次，然后通知所有依赖它的地方。这避免了重复计算。
- **可测试与复用**：`isCountTooLow` 和 `buttonColor` 是纯粹的 JavaScript 函数，你可以轻松地将它们提取到单独的文件中，进行单元测试，并在应用的其他地方复用。

### 优化复杂计算

当你的衍生逻辑非常昂贵（例如，需要过滤和排序一个大数组），或者你就是想明确地创建一个可缓存的衍生信号时，可以使用 `createComputed`。

`createComputed` 接收一个函数，并返回一个**只读**的、记忆化的信号。它会追踪其内部的依赖，仅在依赖变化时才重新计算。

```jsx
import { createSignal, createComputed } from 'kodex'

const [users, setUsers] = createSignal([
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false },
  { name: 'Charlie', age: 35, active: true },
]);

// 使用 createComputed 创建一个昂贵的衍生信号
const activeUserNames = createComputed(() => {
  console.log("正在重新计算 activeUserNames...") // 你会发现它只在 users 变化时打印
  return users()
    .filter(user => user.active)
    .map(user => user.name)
    .join(', ')
})

// 在你的组件中使用它
function UserList() {
  // activeUserNames 是一个 getter 函数，就像 createSignal 返回的一样
  return <text>活跃用户: {activeUserNames}</text>
}
```

**总结：编写优雅的响应式代码**

1. 从 `createSignal` 开始，创建你的原始状态。
2. 当需要基于原始状态进行计算或逻辑判断时，优先考虑将其提取为一个独立的衍生信号（一个简单的箭头函数 `() => ...`）。
3. 如果这个计算非常昂贵或被多处复用，使用 `createComputed` 来优化性能。
4. 让你的 JSX 保持干净、整洁、声明式，只用来消费这些准备好的信号。

遵循这些原则，你将能构建出清晰、高效且易于维护的 Kodex 应用。

## 高级用法

### 创建响应式副作用

当您的应用需要与外部世界交互时——比如打印日志、与服务器通信、或设置定时器——您就需要使用副作用和生命周期函数。这些工具让您能够“跳出”纯粹的 UI 渲染，执行命令式的代码。

createEffect 用于创建一个“副作用”。它会追踪其内部读取的所有信号，并在任何一个信号发生变化时，重新运行其回调函数。

核心原则：createEffect 用于执行**动作**，而不是**计算**值。

如果您的目标是根据信号计算一个新值并显示在 UI 中，请使用衍生信号 (() => ...) 或 createComputed。
如果您想在信号变化时**做某件事**（比如打印日志、发送网络请求），那么 createEffect 就是您需要的工具。

**使用场景：**

- **日志记录与调试**: 实时观察信号的变化。
- **数据同步**: 将 Kodex 的状态同步到外部存储（例如浏览器的 localStorage 或 zdjl 的持久化 API）。
- **与非响应式库集成**: 当信号变化时，手动调用一个第三方库的 API。

**示例：创建一个简单的日志记录器**

假设我们想在用户输入时，实时将当前输入框的值打印到控制台。

```jsx
import { createSignal, createEffect } from '@zdjl/kodex'

function LoggingInput() {
  const [text, setText] = createSignal("")

  // 创建一个副作用来监听 text 信号
  createEffect(() => {
    // 每当 text() 的值变化时，这行代码就会重新运行
    console.log(`当前输入的值是: ${text()}`)
  })

  return (
    <input 
      label="实时日志"
      value={text} 
      onChange={ctx => setText(ctx.newValue)} 
    />
  )
}
```

在这个例子中，每次用户在输入框中打字，setText 都会更新 text 信号。createEffect 检测到 text 的变化，并立即重新执行其内部的 console.log，从而实现了实时日志记录。

### 生命周期

有时，您需要在组件的生命周期中的特定时间点执行代码。例如，在组件首次渲染后设置一个定时器，并在组件被销毁前清除它，以防止内存泄漏。Kodex 提供了 onMount 和 onCleanup 两个钩子函数来处理这些场景。

#### onMount

onMount 注册一个回调函数，该函数会在组件**首次被渲染和装载后**执行一次。它非常适合执行那些只需要运行一次的初始化操作。

**使用场景：**

- 设置定时器 (setInterval) 或延迟操作 (setTimeout)。
- 初始化第三方库。
- 执行一次性的数据获取。
- 任何在弹窗后想做的事

#### onCleanup

onCleanup 注册一个回调函数，该函数会在组件**被销毁或卸载时**执行一次。它的主要职责是清理任何在组件存在期间创建的、可能导致内存泄漏的“残留物”。

**使用场景：**

- 清除由 setInterval 或 setTimeout 创建的定时器。
- 断开与外部服务的连接。
- 任何在弹窗结束后想做的事

**示例：一个自动计数的时钟**

下面的组件会在装载后，每秒自动增加一次计数，并在组件被销毁时停止计数。

```jsx
import { createSignal, onMount, onCleanup } from '@zdjl/kodex'

function AutoCounter() {
  const [count, setCount] = createSignal(0)
  let timerId = null // 用于存储定时器的 ID

  // onMount: 在组件装载后执行
  onMount(() => {
    console.log("AutoCounter 组件已装载，启动定时器！")
    
    // 每 1 秒增加一次 count 的值
    timerId = setInterval(() => {
      setCount(c => c + 1)
    }, 1000)
  })

  // onCleanup: 在组件销毁时执行
  onCleanup(() => {
    console.log("AutoCounter 组件将销毁，清理定时器！")
    
    // 清除定时器，防止内存泄漏
    if (timerId) {
      clearInterval(timerId)
    }
  })

  return <text>自动计数器: {count}</text>
}
```

onMount 和 onCleanup 总是成对出现，确保了“谁创建，谁销毁”的原则，这是编写健壮、无内存泄漏应用的关键。

## 模式与最佳实践

这部分内容不是介绍新 API，而是展示如何组合使用现有 API 来解决常见问题，引导用户形成良好的编码习惯。

（待施工）

## 使用增强组件

### 条件显示

⚠️ **重要**: Kodex **无法**在运行时动态地添加或删除UI元素（条件渲染）。目标环境的限制决定了UI结构在渲染时必须是固定的。  
✅ 为了减少沟通成本，我们称之为**条件显示**——根据条件切换元素的可见性。有时，我们称条件渲染，但其实指的是条件显示。

**方法1: 使用 `hidden` 属性**
这是最简单的方式。将 `hidden` 属性设置为 `true` 可以隐藏一个元素。

```jsx
function App() {
  const [show, setShow] = createSignal(false);
  return (
    <>
      {/* 使用完整形式，因为有 ! 逻辑 */}
      <text hidden={() => !show()}>你好，Kodex！</text>
      <button onClick={() => setShow(!show())}>切换显示</button>
    </>
  );
}
```

**方法2: 使用 `<Show>` 组件**
对于需要“占位符”的场景，`<Show>` 组件更具可读性。

```jsx
import { Show, createSignal } from '@zdjl/kodex'

function App() {
  const [show, setShow] = createSignal(false)

  // 模拟异步加载
  setTimeout(() => setShow(true), 1000)

  return (
    <>
      <Show when={show} fallback={<text>加载中...</text>}>
        <text>你好，Kodex！</text>
      </Show>
      <button onClick={() => setShow(!show())}>切换显示</button>
    </>
  );
}
```

### 列表显示

⚠️ 同样，Kodex **无法**实现动态列表渲染（增删列表项）。  
✅ 我们可以基于一个静态数组来渲染一个列表。有时，我们称列表渲染，但其实指的是列表显示。

使用标准的 JavaScript `Array.prototype.map` 方法即可。不需要像 React 那样提供 `key` 属性。

```jsx
function App() {
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ];

  return (
    <>
      {users.map(user => (
        <text>{user.name}</text>
      ))}
    </>
  );
}
```

## 事件处理与受控组件

通过 `onClick`, `onChange` 等属性来处理用户交互。

`onChange` 事件对于创建**受控组件**（如输入框）至关重要。这意味着组件的显示值由您的信号控制，用户的输入通过 `onChange` 事件来更新这个信号。

`onChange` 回调会接收一个上下文对象 `ctx`，包含 `{ newValue, oldValue, ... }` 等信息。

```jsx
function UserProfile() {
  const [name, setName] = createSignal("路人甲")

  return (
    <>
      <text>你好, {name}</text>
      <input
        label="姓名"
        value={() => name()} // ✅ value 绑定到信号
        onChange={ctx => setName(ctx.newValue)} // ✅ onChange 更新信号
      />
    </>
  )
}
```

## 边缘话题
### 🌀 设计理念

Kodex 遵循以下设计原则：

- **✨ 简单胜过复杂**：用最简单的方式表达复杂的逻辑。
- **📝 声明胜过命令**：描述你想要什么，而不是怎么做。
- **⚡ 自动胜过手动**：让系统自动处理繁琐的细节。
- **🛡️ 安全胜过灵活**：通过明确的规则和模式保证代码的健壮性。

通过这些理念，Kodex 让界面开发变得简单、直观、高效。无论你是初学者还是经验丰富的开发者，都能快速上手并享受愉快的开发体验。🎉
