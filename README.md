# Kodex
Kodex 是一个为自动精灵平台设计的声明式 UI 工具，其使用 JSX 结构描述自动精灵的 UI(设置变量动作)

# 预览


# TODO
- [x] 值更改事件 : onChange
- [x] 弹窗已创建Hook : dialogCreated
- [ ] select 元素更改默认选中 : 本身不提供,但可以通过更改 options 数组来实现
- [ ] 处理额外文本初次值为空字符串时后续更新无效的问题：即使没有使用Kodex也会这样，可能是自动精灵的机制或bug使然。可以通过显示一个1像素的图片来模拟空字符串

# NOTE
- 当 color 不是全格式时闪退
- 当 backgroundColor 为 null 时闪退
- 当 var name 不合法时闪退

# 架构

## 关键数据流
```mermaid
graph LR
    A[JSX元素] --> B[ElementConverter]
    B --> C[Variable]
    C --> D[Action]
    
    F[响应式数据] --> G[ReactiveProcessor]
    G --> H[派生属性]
    H --> C
    
    I[事件处理] --> J[事件监听器]
    J --> K[回调函数]
    K --> D
```

## 类关系
```mermaid
graph TD
    A[Renderer] --> B[RenderContext]
    A --> C[ElementConverter]
    A --> D[ReactiveProcessor]
    
    B --> E[变量管理]
    B --> F[事件管理]
    B --> G[路径管理]
    
    C --> H[属性映射]
    C --> I[类型转换]
    
    D --> J[信号处理]
    D --> K[表达式计算]
```

## 渲染流程
```mermaid
graph TD
    subgraph 初始化阶段
        A[创建Renderer实例] --> B[注册ElementConverter]
        B --> C[创建RenderSession]
        C --> D[初始化RenderContext]
        C --> E[初始化ReactiveProcessor]
        C --> F[初始化ElementStack]
    end

    subgraph 渲染阶段
        G[render方法] --> H[处理根组件]
        H --> I[提取Header/Main/Footer]
        
        subgraph Header处理
            I --> J[processHeaderElement]
            J --> K[处理标题文本]
            K --> L[处理响应式表达式]
        end

        subgraph Main处理
            I --> M[processElement]
            M --> N{元素类型判断}
            N -->|组件| O[handleComponent]
            N -->|普通元素| P[查找ElementConverter]
            P --> Q[convertToVariable]
            Q --> R[VariableAdapter适配]
            R --> S[生成变量定义]
        end

        subgraph Footer处理
            I --> T[processFooterElement]
            T --> U[处理按钮]
            U --> V[处理事件回调]
        end
    end

    subgraph 变量处理
        W[VariableAdapter] --> X[属性映射]
        X --> Y[处理响应式属性]
        Y --> Z[生成变量表达式]
    end

    subgraph 响应式处理
        AA[ReactiveProcessor] --> AB[处理信号]
        AB --> AC[处理表达式]
        AC --> AD[处理派生属性]
    end

    subgraph 结果生成
        AE[生成Action] --> AF[组装变量]
        AF --> AG[创建对话框]
        AG --> AH[返回渲染结果]
    end

    %% 连接主要流程
    S --> AE
    L --> AE
    V --> AE
    AD --> S
    Z --> S
```
