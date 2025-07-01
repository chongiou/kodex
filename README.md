# Kodex

Kodex 是一个运行时 DSL UI 渲染引擎，它通过 JSX 这种声明式语法，将 UI 描述转换为目标环境( `zdjl` )的具体实现，提供了从组件定义到最终渲染的完整解决方案。

## 🌱社区资源

- [1027734941](https://qm.qq.com/q/k5IkZNKJ3i)：官方交流群

## ✨ 核心特性

- **作用域互通**: 打通了弹窗表达式与动作的作用域
- **响应式数据绑定**: 自动同步数据变化与界面更新
- **组件化开发**: 使用可复用的组件构建复杂界面
- **声明式语法**: 用简洁的标记语言描述界面结构
- **事件处理**: 按钮交互与值更改事件响应

## 🚀 快速开始

### 基本概念

- **组件 (Component)**: 组件是可复用的 UI 单元，类似 HTML 标签但功能更强大。  
- **响应式数据**: 当数据发生变化时，界面会自动更新以反映这些变化。  
- **事件处理**: 当用户与界面交互时（如点击按钮），可以触发相应的处理函数。

## 安装

```shell
npm i @zdjl/kodex
```

## 导入

```js
import {} from '@zdjl/kodex'
```

如果你不熟悉 ESM 的模块语法请查看 MDN 的 [import](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/import) 和 [export](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/export) 文档 

## 配置开发环境
[配置开发环境](./docs/DevEnvSetup.md)

### 创建你的第一个界面

```jsx
import { render, createSignal } from '@zdjl/kodex'

// 定义根组件
function Counter() {
  const [count, setCount] = createSignal(0)
  return (
    <button onClick={() => setCount(prev => prev + 1)}>Count is: {count}</button>
  )
}

// 渲染界面
const result = await render(<Counter />).show()
```

> Counter 是一个自定义组件，这个概念在 学习 Kodex 中会提到

### 效果

![效果](./docs/images/counter-example.gif)

### 🔍 让我们看看发生了什么

1. 创建了一个初始值为 0 的响应式数据源 count 信号（Signal）。返回 getter 和 setter 用于读取和更新信号
   
   ```jsx
   const [count, setCount] = createSignal(0)
   ```

2. button 引用了这个数据 `Count is: {count}`
   
   ```jsx
   <button ... >Count is: {count}</button>
   ```
   
3. button 在其点击事件内修改了数据 `onClick={() => setCount(prev => prev + 1)}`
   
   ```jsx
   <button onClick={() => setCount(prev => prev + 1)}> ... </button>
   ```

4. 每次点击时执行事件处理函数  `() => setCount(prev => prev + 1)`，即使用之前的值并加 1

5. 每次修改信号后，UI 立即反应其变化

### 🎉 So easy, right?

想象一下，使用传统方式需要几个步骤？下一步，开始学习 Kodex  用法！

## 📖 学习 Kodex

(待施工)

## 📜 API 参考

(待施工)

## 🤝 贡献

欢迎 PR 和 Issue

## ⚖️许可证

MIT
