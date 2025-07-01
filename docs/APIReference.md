
# API 快速参考

## 响应式 API

- createSignal: 创建响应式数据源，返回一个数组，包含一个 getter (用于读取信号) 和一个 setter (用于更新信号)
- createEffect: 创建响应式副作用，其自动追踪回调函数内访问过的信号，并在信号变化时自动重新执行回调函数
- createComputed: 创建可缓存的衍生信号，它会追踪其内部的信号，仅在信号变化时才重新计算
- createResource: 创建资源，用于访问异步数据
- onMount: 生命周期函数，在组件被渲染和装载后执行其回调函数
- onCleanup: 生命周期函数，在组件被销毁或卸载时执行其回调函数
- untrack: 在响应式副作用内屏蔽响应式上下文，在 untrack 回调内访问的信号不会被副作用追踪

## 内置原生组件 API

以下是 Kodex 提供的常用内置原生组件及其属性。

### 通用属性

这些属性适用于所有组件：
> 但不是所有组件都有效，这处决于目标环境  
> 比如你给按钮设置 onChange, 这是合法的，但无效

表单与交互
- `name?: string`: 为元素命名，用于在 `app.show()` 的返回结果中获取其值
- `memo?: boolean`: 记住值
- `onChange?(ctx: ChangeContext): void`: 值更改回调
- `required?: boolean | (() => boolean)`: 是否为必填项

文本与内容
- `description?: string | (() => string)`: 描述
- `label?: string | (() => string)`: 标签
- `extraTextAbove?: string | (() => string)`: 额外文本上
- `extraTextBelow?: string | (() => string)`: 额外文本下
- `extraTextRight?: string | (() => string)`: 额外文本右

样式
- `style?: object`: 定义元素的样式。
  - `align?: 'left' | 'center' | 'right'`: 对齐方式
  - `widthMode?: "auto" | "25%" | "50%" | ...`: 宽度模式
  - `growRatio?: number`: 在行内占据的剩余空间比例
  - `bgColor?: string`: 背景颜色 (如 `#RRGGBB` 或 `#RGB`)
  - `bgImage?: string`: Base64 编码的背景图片

可见性
- `hideDescription?: boolean | (() => boolean)`: 隐藏描述按钮
- `hideLabel?: boolean | (() => boolean)`: 隐藏标签
- `hidden?: boolean | (() => boolean)`: 隐藏元素视图
---

### 内置组件列表 和 私有属性

### `<text>`

显示一段静态或动态文本。

- **`children`**: 要显示的文本内容。可以是字符串、数字、信号或它们的混合数组。
- **`style.fontColor`**: 文本颜色
- **`style.fontSize`**: 字体大小

```jsx
<text style={{ fontSize: 16, fontColor: '#333333' }}>
  这是一个文本组件。
</text>
```

---

### `<button>`

一个可点击的按钮。

- **`children`**: 按钮上显示的文本。
- **`onClick?: () => void`**: 点击事件的回调函数。
- **`style.buttonStyle?: "button" | "link" | "none"`**: 按钮样式。

```jsx
const [msg, setMsg] = createSignal("点击这里")
<button onClick={() => setMsg("已点击！")}>{() => msg()}</button>
```

---

### `<input>`

一个输入框，支持多种类型。

- **`type?: "text" | "number" | "file"`**: 输入框类型，默认为 `"text"`。
- **`value`**: 输入框的值
- **`limitSuffix?: string`**: (仅当 `type="file"`) 限制可选的文件后缀，多个后缀用换行符分隔。

```jsx
// 文本输入
const [text, setText] = createSignal("")
<input label="文本" value={text} onChange={ctx => setText(ctx.newValue)} />

// 数字输入
const [num, setNum] = createSignal(0)
<input type="number" label="数字" value={num} onChange={ctx => setNum(ctx.newValue)} />
```

---

### `<checkbox>`

一个复选框。

- **`checked`**: 复选框的选中状态 (`true` 或 `false`)，应使用信号绑定。

```jsx
const [agreed, setAgreed] = createSignal(false)
<checkbox label="我同意用户协议" checked={agreed} onChange={ctx => setAgreed(ctx.newValue)} />
```

---

### `<container>`

一个可以包含其他组件的容器，通常用于组织布局。它本身在视觉上不可见。

- **`children`**: 嵌套的子组件。

```jsx
<container description="以下所有项目均为必填">
  <input label="用户名" required={true} />
  <input label="密码" required={true} />
</container>
```

---

### `<expr>`

表达式,可作为 `text` 子元素

- **`value?: sting`**: 输入框内默认值

---

### `<select>`

一个下拉选择框。

- **`options: string[] | (() => string[])`**: 下拉选项的数组。
- **`selected`**: 当前选中的值，应使用信号绑定。

```jsx
const [fruit, setFruit] = createSignal("apple")
const options = ["apple", "banana", "orange"]
<select label="水果" options={options} selected={fruit} onChange={ctx => setFruit(ctx.newValue)} />
```

---

### `<position>`

选择屏幕位置

---

