
/**
 * 基于游标的命令式 JSX 字符串解析工具。不支持单标签，使用双斜线结束组件
 */
export function jsx(strings: TemplateStringsArray, ...values: unknown[]): JSX.Element {
  // 合并 strings 和 values，生成带占位符的字符串
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
    while (/[a-zA-Z0-9]/.test(currentChar)) {
      identifier += currentChar
      next()
    }
    return identifier === '' ? 'fragment' : identifier
  }

  // 工具函数: 读取字符串(属性值引号内部内容)
  function readString() {
    const quote = currentChar // " 或 '
    next() // 跳过开头的引号
    let value = ''
    while (currentChar !== quote && currentChar) {
      if (currentChar === '\\') {
        next() // 跳过转义符
        value += currentChar
      } else {
        value += currentChar
      }
      next()
    }
    next() // 跳过结尾的引号
    return value
  }

  // 工具函数: 读取数字
  function readNumber() {
    let number = ''
    while (/[0-9.]/.test(currentChar)) {
      number += currentChar
      next()
    }
    return parseFloat(number)
  }

  // 工具函数: 读取占位符(动态表达式)
  function readPlaceholder() {
    let placeholder = ''
    while (/[A-Z0-9_]/.test(currentChar)) {
      placeholder += currentChar
      next()
    }
    if (!placeholders.has(placeholder)) {
      throw new Error(`无效占位符, 在 ${index}`)
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
        index += 3 // 跳过 ...
        currentChar = source[index]

        // 必须是占位符
        if (!(currentChar === '_' && source.slice(index, index + 14).startsWith('__PLACEHOLDER_'))) {
          throw new Error(`在 ... 后期望占位符, 在 ${index}`)
        }

        const restProps = readPlaceholder()
        if (typeof restProps !== 'object' || restProps === null) {
          throw new Error(`展开的属性必须是对象, 在 ${index}`)
        }

        // 合并属性
        Object.assign(props, restProps)
      } else {
        // 原有属性解析逻辑
        const key = readIdentifier()
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
            throw new Error(`无效的属性值在 ${index}`)
          }
          props[key] = value
        }
      }
      skipWhitespace()
    }
    return props
  }

  // 解析节点(标签或组件)
  function parseNode() {
    if (currentChar !== '<') {
      throw new Error(`期望 < , 在 ${index}`)
    }
    next() // 跳过 <

    let type
    let isComponent = false

    // 检查是否是组件(以 ${...} 开头)
    if (currentChar as string === '_' && source.slice(index, index + 14).startsWith('__PLACEHOLDER_')) {
      isComponent = true
      type = readPlaceholder() // 获取组件函数/引用
    } else {
      type = readIdentifier()
    }

    const props = parseAttributes()
    skipWhitespace()

    if (currentChar as string !== '>') {
      console.error(currentChar)
      throw new Error(`期望 > , 在 ${index}`)
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
          throw new Error(`意外的字符, 在 ${index}`)
        }
      }
    }

    // 解析闭合标签
    if (currentChar !== '<' || source[index + 1] !== '/') {
      throw new Error(`期望 </ , 在 ${index}`)
    }
    next() // 跳过 <
    next() // 跳过 /

    // 检查闭合标签
    let closingTag
    if (currentChar as string === '/' && source[index + 1] === '>') {
      // 支持组件 <//> 闭合
      next() // 跳过 /
      next() // 跳过 >
    } else {
      closingTag = readIdentifier()
      if (closingTag !== type && !isComponent) {
        throw new Error(`不匹配的结束标签: 期望 </${type}>, 但为 </${closingTag}>, 在 ${index}`)
      }
      skipWhitespace()
      if (currentChar as string !== '>') {
        throw new Error(`期望 > 在 ${index}`)
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

  skipWhitespace()
  if (currentChar !== '<') {
    throw new Error('必须使用一个标签开始')
  }
  const result = parseNode()

  skipWhitespace()
  if (currentChar) {
    throw new Error('在根元素后存在意外内容')
  }

  return result as JSX.Element
}
