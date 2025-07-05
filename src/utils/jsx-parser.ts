import '@/types/global'

/**
 * 基于游标的命令式 JSX 字符串解析工具。支持单标签和双标签，组件可使用双斜线结束
 */
export function jsx(strings: TemplateStringsArray, ...values: unknown[]): JSX.Element {
  // 合并 strings 和 values，生成带占位符的字符串
  // 判断是否缺失占位符
  if (strings.length !== values.length + 1) {
    console.warn('[jxs-parser] 警告:模板字符串与占位符不匹配')
  }
  let source = ''
  const placeholders = new Map()
  strings.forEach((str, i) => {
    source += str
    if (i < values.length) {
      const placeholder = `__PLACEHOLDER_${i}__`
      source += placeholder
      placeholders.set(placeholder, values[i])
    }
  })

  // 移除多余空白和换行
  source = source.replace(/\s*\n\s*/g, '').trim()

  // 跟踪解析位置
  let index = 0
  let currentChar = source[0]

  // 工具函数: 获取当前位置的上下文信息
  function getContext(pos = index, contextLength = 20) {
    const start = Math.max(0, pos - contextLength)
    const end = Math.min(source.length, pos + contextLength)
    const before = source.slice(start, pos)
    const after = source.slice(pos, end)
    return `"${before}|${after}" (位置 ${pos})`
  }

  // 工具函数: 创建格式化的错误信息
  function createError(message: string, pos = index) {
    return new Error(`${message}\n位置: ${getContext(pos)}`)
  }

  // 工具函数: 移动到下一个字符
  function next() {
    index++
    currentChar = source[index]
  }

  // 工具函数: 跳过空白
  function skipWhitespace() {
    while (/\s/.test(currentChar)) next()
  }

  // 工具函数: 读取标识符(标签名/属性名)
  function readIdentifier() {
    let identifier = ''
    const startPos = index
    while (/[a-zA-Z0-9]/.test(currentChar)) {
      identifier += currentChar
      next()
    }
    if (identifier === '') {
      if (/[^a-zA-Z0-9\s>\/="]/.test(currentChar)) {
        throw createError(`标识符包含无效字符 '${currentChar}'`, startPos)
      }
      return 'fragment'
    }
    return identifier
  }

  // 工具函数: 读取字符串(属性值引号内部内容)
  function readString() {
    const quote = currentChar // " 或 '
    const startPos = index
    next() // 跳过开头的引号
    let value = ''
    while (currentChar !== quote && currentChar) {
      if (currentChar === '\\') {
        next() // 跳过转义符
        if (!currentChar) {
          throw createError(`字符串未闭合，缺少结束引号 ${quote}`, startPos)
        }
        value += currentChar
      } else {
        value += currentChar
      }
      next()
    }
    if (!currentChar) {
      throw createError(`字符串未闭合，缺少结束引号 ${quote}`, startPos)
    }
    next() // 跳过结尾的引号
    return value
  }

  // 工具函数: 读取数字
  function readNumber() {
    let number = ''
    const startPos = index
    while (/[0-9.]/.test(currentChar)) {
      number += currentChar
      next()
    }
    const result = parseFloat(number)
    if (isNaN(result)) {
      throw createError(`无效的数字格式 '${number}'`, startPos)
    }
    return result
  }

  // 工具函数: 读取占位符(动态表达式)
  function readPlaceholder() {
    let placeholder = ''
    const startPos = index
    while (/[A-Z0-9_]/.test(currentChar)) {
      placeholder += currentChar
      next()
    }
    if (!placeholders.has(placeholder)) {
      throw createError(`未找到占位符 '${placeholder}'，可能是模板字符串插值错误`, startPos)
    }
    return placeholders.get(placeholder)
  }

  // 工具函数: 读取文本内容
  function readText() {
    let text = ''
    while (currentChar && currentChar !== '<' && !source.slice(index, index + 14).startsWith('__PLACEHOLDER_')) {
      text += currentChar
      next()
    }
    return text.trim() // 移除首尾空白
  }

  // 解析属性
  function parseAttributes() {
    const props: { [x: string]: any } = {}
    skipWhitespace()

    while (currentChar !== '>' && currentChar !== '/' && currentChar) {
      // 检查是否是 rest 语法 (...${props})
      if (currentChar === '.' && source.slice(index, index + 3) === '...') {
        const spreadStart = index
        index += 3 // 跳过 ...
        currentChar = source[index]

        // 必须是占位符
        if (!(currentChar === '_' && source.slice(index, index + 14).startsWith('__PLACEHOLDER_'))) {
          throw createError(`展开语法 ... 后必须跟随模板字符串插值`, spreadStart)
        }

        const restProps = readPlaceholder()
        if (typeof restProps !== 'object' || restProps === null || Array.isArray(restProps)) {
          throw createError(`展开的属性必须是纯对象，收到: ${typeof restProps}`)
        }

        // 合并属性
        Object.assign(props, restProps)
      } else {
        // 原有属性解析逻辑
        const keyStart = index
        const key = readIdentifier()
        if (!key || key === 'fragment') {
          throw createError(`属性名不能为空`, keyStart)
        }
        skipWhitespace()

        if (currentChar !== '=') {
          // 简写属性 (如 disabled)
          props[key] = true
        } else {
          next() // 跳过 =
          skipWhitespace()

          let value
          if (currentChar as string === '"' || currentChar as string === "'") {
            value = readString()
          } else if (/[0-9]/.test(currentChar)) {
            value = readNumber()
          } else if (currentChar as string === '_' && source.slice(index, index + 14).startsWith('__PLACEHOLDER_')) {
            value = readPlaceholder()
          } else {
            const valueStart = index
            throw createError(`属性 '${key}' 的值必须是字符串、数字或模板字符串插值`, valueStart)
          }
          props[key] = value
        }
      }
      skipWhitespace()
    }
    return props
  }

  // 解析节点(标签或组件)
  function parseNode(): any {
    if (currentChar !== '<') {
      throw createError(`期望标签开始符 '<'，但找到 '${currentChar || 'EOF'}'`)
    }
    const tagStart = index
    next() // 跳过 <

    let type
    let isComponent = false

    // 检查是否是组件(以 ${...} 开头)
    if (currentChar as string === '_' && source.slice(index, index + 14).startsWith('__PLACEHOLDER_')) {
      isComponent = true
      type = readPlaceholder() // 获取组件函数/引用
      if (typeof type !== 'function' && typeof type !== 'string') {
        throw createError(`组件必须是函数或字符串，收到: ${typeof type}`)
      }
    } else {
      type = readIdentifier()
      if (!type) {
        throw createError(`标签名不能为空`, tagStart + 1)
      }
    }

    const props = parseAttributes()
    skipWhitespace()

    // 检查是否是单标签
    if (currentChar as string === '/' && source[index + 1] === '>') {
      // 单标签处理
      next() // 跳过 /
      next() // 跳过 >
      
      // 构造单标签节点
      const node: {
        type: string | Function,
        props: {
          [x: string]: any,
          children?: any,
        }
      } = { type, props }
      
      return node
    }

    if (currentChar as string !== '>') {
      throw createError(`期望标签结束符 '>' 或单标签结束符 '/>'，但找到 '${currentChar || 'EOF'}'`)
    }
    next() // 跳过 >

    // 解析子节点
    const children = []
    while (currentChar && (currentChar !== '<' || source[index + 1] !== '/')) {
      if (/\s/.test(currentChar)) {
        skipWhitespace()
        continue
      }
      if (currentChar === '<') {
        children.push(parseNode())
      }
      else if (currentChar === '_' && source.slice(index, index + 14).startsWith('__PLACEHOLDER_')) {
        children.push(readPlaceholder())
      }
      else {
        const text = readText()
        if (text) {
          children.push(text)
        } else {
          throw createError(`意外的字符 '${currentChar}'`)
        }
      }
    }

    // 解析闭合标签
    if (!currentChar) {
      throw createError(`标签 '${isComponent ? '[组件]' : type}' 未闭合，缺少结束标签`, tagStart)
    }
    if (currentChar !== '<' || source[index + 1] !== '/') {
      throw createError(`期望结束标签 '</'，但找到 '${currentChar}${source[index + 1] || ''}'`)
    }

    const closeStart = index
    next() // 跳过 <
    next() // 跳过 /

    // 检查闭合标签
    let closingTag
    if (currentChar as string === '/' && source[index + 1] === '>') {
      // 支持组件 <//> 闭合
      if (!isComponent) {
        throw createError(`普通标签 '${type}' 不能使用 <//>  闭合，应使用 </${type}>`, closeStart)
      }
      next() // 跳过 /
      next() // 跳过 >
    } else {
      closingTag = readIdentifier()
      if (isComponent) {
        throw createError(`组件应使用 <//>  闭合，而不是 </${closingTag}>`, closeStart)
      }
      if (closingTag !== type) {
        throw createError(`标签不匹配: 开始标签 '${type}' 与结束标签 '${closingTag}' 不对应`, closeStart)
      }
      skipWhitespace()
      if (currentChar as string !== '>') {
        throw createError(`期望结束标签闭合符 '>'，但找到 '${currentChar || 'EOF'}'`)
      }
      next() // 跳过 >
    }

    // 构造节点
    const node: {
      type: string | Function,
      props: {
        [x: string]: any,
        children?: any,
      }
    } = { type, props }
    if (children.length > 0) {
      node.props.children = children.length === 1 ? children[0] : children
    }

    return node
  }

  // 主解析逻辑
  try {
    skipWhitespace()
    if (!currentChar) {
      throw createError('JSX 不能为空')
    }
    if (currentChar !== '<') {
      throw createError('JSX 必须以标签开始')
    }

    const result = parseNode()

    skipWhitespace()
    if (currentChar) {
      throw createError(`根元素后存在多余内容 '${currentChar}'`)
    }

    return result
  } catch (error) {
    // 为所有错误添加源码信息
    if (error instanceof Error && !error.message.includes('位置:')) {
      throw createError(error.message)
    }
    throw error
  }
}
