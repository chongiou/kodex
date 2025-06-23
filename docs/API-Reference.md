## ⚠️：该文档具有遗漏和错误，有待完善，建议不要阅读

## 行文约定

变量类型：指目标环境( `zdjl` )的变量类型

## 🧩 核心组件

### 布局组件

#### `<root>`

定义整个对话框的结构
如果不使用 root 元素，那么渲染器将元素当做 main 的子元素处理

```javascript
<root>
  <header>标题内容</header>
  <main>主要内容</main>
  <footer>底部按钮</footer>
</root>
```

#### `<container>`

用于组织和分组其他组件

> 实际对应变量类型：键值对象 object

```javascript
<container label="个人信息">
  <input type="text" label="姓名" />
  <input type="number" label="年龄" />
</container>
```

### 输入组件

#### `<input>`

多功能输入组件，支持不同类型

> 实际对应变量类型：字符 string、数值 number、文件路径 file

```javascript
// 文本输入
<input type="text" label="姓名" value={name} />

// 数字输入
<input type="number" label="年龄" value={age} />

// 文件选择
<input type="file" label="头像" limitSuffix=".jpg,.png" />
```

#### `<checkbox>`

复选框组件：

> 实际对应变量类型：布尔

```javascript
<checkbox 
  label="同意条款" 
  checked={agreed}
  onChange={(ctx) => setAgreed(ctx.newValue)}
/>
```

#### `<select>`

下拉选择组件：

> 实际对应变量类型：字符（选项代替输入）

```javascript
<select 
  label="城市"
  options={['北京', '上海', '广州']}
  selected={city}
  onChange={(ctx) => setCity(ctx.newValue)}
/>
```

### 显示组件

#### `<text>`

文本显示组件：

> 文本 ui_text

```javascript
<text style={{ fontSize: 16, fontColor: '#333' }}>
  欢迎 {username}！
</text>
```

#### `<button>`

按钮组件：

> 按钮 ui_button

```javascript
<button 
  onClick={() => handleSubmit()}
  style={{ buttonStyle: 'primary' }}
>
  提交
</button>
```

## 🔄 响应式数据

### 创建响应式数据

使用 `createSignal` 创建可以自动触发界面更新的数据：

```javascript
const [count, setCount] = createSignal(0)
const [message, setMessage] = createSignal('Hello')
```

### 在组件中使用

响应式数据可以直接在组件中使用，当数据变化时界面会自动更新：

```javascript
function Counter() {
  const [count, setCount] = createSignal(0)

  return (
    <>
      <text>当前计数: {count}</text>
      <button onClick={() => setCount(count() + 1)}>增加</button>
    </>
  )
}
```

### 计算属性

使用 `createComputed` 创建基于其他数据计算的响应式值：

```javascript
import { createComputed } from 'kodex'

const [firstName, setFirstName] = createSignal('张')
const [lastName, setLastName] = createSignal('三')

const fullName = createComputed(() => firstName() + lastName())
```

## 🎨 样式定制

### 基本样式

通过 `style` 属性设置组件样式：

```javascript
<text style={{
  fontSize: 18,
  fontColor: '#ff6b6b',
  align: 'center'
}}>
  重要提示
</text>

<container style={{
  bgColor: '#f8f9fa',
}}>
  内容区域
</container>
```

### 布局控制

```javascript
<input
  style={{
    align: 'center' // 更多属性请查看 API 文档
  }}
/>
```

## 🎮 事件处理

### 点击事件

```javascript
<button onClick={() => {
  zdjl.alert('别点我啦 >///<')
}}>
  点我
</button>
```

### 值变化事件

```javascript
<input
  onChange={ctx => {
    console.log('新值:', ctx.newValue)
    console.log('旧值:', ctx.oldValue)
  }}
/>
```

### 对话框事件

```javascript
// 关闭对话框
<button onClick={ctx => ctx.cancel()}>
  取消
</button>
```

## 🏗️ 组件开发

### 创建自定义组件

```javascript
function PersonCard({ name, age, avatar }) {
  return (
    <>
      <text>个人信息</text>
      <input type="file" label="头像" value={avatar} />
      <input type="text" label="姓名" value={name} />
      <input type="number" label="年龄" value={age} />
    </>
  )
}

// 使用组件
<PersonCard name={userName} age={userAge} avatar={userAvatar} />
```

### 条件渲染

使用 `Show` 官方组件实现简单的条件渲染：

```javascript
import { Show, createSignal, render} from 'kodex'

const App = () => {
  const [show, setShow] = createSignal(false)
  return (
    <>
      <Show when={show()} fallback={<text>没有内容</text>}>
        <text>显示内容</text>
        <text>显示内容2</text>
      </Show>
      <button onClick={() => setShow(prev => !prev)}>切换</button>
    </>
  )
}

render(<App />).show()
```

使用 `Switch` 官方组件实现复杂的条件渲染：

```javascript
import { Switch, Match, createSignal, render, createEffect} from 'kodex'

const App = () => {
  const [user, setUser] = createSignal(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal(null)

  createEffect(() => {
    setLoading(true)
    setError(null)
    new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ name: '张三' })
      }, 1000)
    })
    .then(setUser)
    .catch(setError)
    .finally(() => setLoading(false))
  })

  return (
    <Switch>
      <Match when={() => loading()}>
        <text>加载中...</text>
      </Match>
      <Match when={() => error()}>
        <text>加载失败: {error().message}</text>
      </Match>
      <Match when={() => user()}>
        <text>用户: {user().name}</text>
      </Match>
      <Match when={() => !user()}>
        <text>没有用户</text>
      </Match>
    </Switch>
  )
}

render(<App />).show()
```

## 📚 进阶话题

### 异步数据处理

使用 `createResource` 处理异步数据：

(待补充)

## 🌀 边缘话题

### 设计理念

Kodex 遵循以下设计原则：

* **✨ 简单胜过复杂**：用最简单的方式表达复杂的逻辑
* **📝 声明胜过命令**：描述你想要什么，而不是怎么做
* **⚡ 自动胜过手动**：让系统自动处理繁琐的细节
* **🛡️ 安全胜过灵活**：通过类型系统保证代码质量

通过这些理念，Kodex 让界面开发变得简单、直观、高效。无论你是初学者还是经验丰富的开发者，都能快速上手并享受愉快的开发体验。🎉
