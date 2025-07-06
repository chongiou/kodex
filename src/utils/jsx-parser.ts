import '@/types/global'

/**
 * JSX 模板字符串解析器, 自定义组件使用 `<//>` 闭合 或 单标签闭合方式
 */
export function parseJSX(strings: TemplateStringsArray, ...values: unknown[]): JSX.Element {
  if (strings.length !== values.length + 1) {
    throw new Error('[JSX Parser] 模板字符与值未对应')
  }
  const parts: string[] = []
  const placeholders: unknown[] = []

  for (let i = 0; i < strings.length; i++) {
    parts.push(strings[i])
    if (i < values.length) {
      parts.push(`\x00${i}\x00`)
      placeholders[i] = values[i]
    }
  }

  const source = parts.join('').replace(/\s+/g, ' ').trim()

  const len = source.length
  let pos = 0

  // 字符查找表
  const isWhitespace = (char: string) => char === ' ' || char === '\t' || char === '\n' || char === '\r'
  const isAlpha = (char: string) => (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
  const isDigit = (char: string) => char >= '0' && char <= '9'
  const isAlphaNum = (char: string) => isAlpha(char) || isDigit(char)

  // 工具函数
  function getStringWidth(str: string) {
    let width = 0
    for (const char of str) {
      // 中文字符、日文、韩文等通常宽度为2，其他字符宽度为1
      width += char.codePointAt(0)! > 255 ? 2 : 1
    }
    return width
  }

  function createError(message: string, position = pos) {
    const contextLength = 20
    const start = Math.max(0, position - contextLength)
    const end = Math.min(len, position + contextLength)
    const before = source.slice(start, position)
    const after = source.slice(position, end)
    const context = `${before}|${after}`
    const posHelp = ' '.repeat(getStringWidth(before))

    const error = new Error(`[JSX Parser] ${message}\n${posHelp}_\n${context}\n${posHelp}^`)
      ; (error as any).context = context
      ; (error as any).pos = position
      ; (error as any).posHelp = `${posHelp}^`

    return error
  }

  function getCurrentChar() {
    return pos < len ? source[pos] : 'EOF'
  }

  function skipWhitespace() {
    while (pos < len && isWhitespace(source[pos])) pos++
  }

  function readIdentifier() {
    const start = pos
    while (pos < len && isAlphaNum(source[pos])) pos++
    return pos > start ? source.slice(start, pos) : null
  }

  function readString() {
    const quote = source[pos] // 记录引号类型
    const quotePos = pos
    pos++ // 跳过开始引号
    const start = pos

    while (pos < len && source[pos] !== quote) {
      if (source[pos] === '\\') pos++ // 跳过转义字符
      pos++
    }

    if (pos >= len) {
      throw createError(`字符串未闭合，缺少结束引号 '${quote}'`, quotePos)
    }

    const result = source.slice(start, pos)
    pos++ // 跳过结束引号
    return result
  }

  function readNumber() {
    const start = pos
    while (pos < len && (isDigit(source[pos]) || source[pos] === '.')) pos++
    const numberStr = source.slice(start, pos)
    const result = parseFloat(numberStr)

    if (isNaN(result)) {
      throw createError(`无效的数字格式 '${numberStr}'`, start)
    }

    return result
  }

  function readPlaceholder() {
    const placeholderStart = pos
    pos++ // 跳过 \x00
    const start = pos
    while (pos < len && isDigit(source[pos])) pos++

    if (pos === start) {
      throw createError('占位符格式错误，缺少索引', placeholderStart)
    }

    const index = parseInt(source.slice(start, pos))

    if (pos >= len || source[pos] !== '\x00') {
      throw createError('占位符格式错误，缺少结束标记', placeholderStart)
    }

    pos++ // 跳过结束的 \x00

    if (index >= placeholders.length) {
      throw createError(`占位符索引超出范围: ${index}，最大索引: ${placeholders.length - 1}`, placeholderStart)
    }

    return placeholders[index]
  }

  function readText() {
    const start = pos
    while (pos < len && source[pos] !== '<' && source[pos] !== '\x00') pos++
    const text = source.slice(start, pos).trim()
    return text || null
  }

  function parseAttributes() {
    const props: Record<string, any> = {}

    while (pos < len) {
      skipWhitespace()

      if (source[pos] === '>' || source[pos] === '/') break

      // 处理展开语法
      if (source.slice(pos, pos + 3) === '...') {
        const spreadStart = pos
        pos += 3

        if (source[pos] !== '\x00') {
          throw createError('展开语法 ... 后必须跟随模板字符串插值', spreadStart)
        }

        const restProps = readPlaceholder()
        if (typeof restProps !== 'object' || restProps === null || Array.isArray(restProps)) {
          throw createError(`展开的属性必须是纯对象，收到: ${typeof restProps}`, spreadStart)
        }

        Object.assign(props, restProps)
        continue
      }

      // 读取属性名
      const keyStart = pos
      const key = readIdentifier()
      if (!key) {
        throw createError(`无效的属性名，期望字母或数字，但找到 '${getCurrentChar()}'`, keyStart)
      }

      skipWhitespace()

      if (source[pos] !== '=') {
        props[key] = true
        continue
      }

      pos++ // 跳过 =
      skipWhitespace()

      // 读取属性值
      const valueStart = pos
      const char = source[pos]
      let value: any

      if (char === '"' || char === "'") {
        value = readString()
      } else if (isDigit(char)) {
        value = readNumber()
      } else if (char === '\x00') {
        value = readPlaceholder()
      } else {
        throw createError(`属性 '${key}' 的值必须是字符串、数字或模板字符串插值，但找到 '${char}'`, valueStart)
      }

      props[key] = value
    }

    return props
  }

  function parseNode(): any {
    const nodeStart = pos

    if (source[pos] !== '<') {
      throw createError(`期望标签开始符 '<'，但找到 '${getCurrentChar()}'`, pos)
    }

    pos++ // 跳过 <

    // 解析标签名或组件
    let type: any
    let isComponent = false

    if (source[pos] === '\x00') {
      isComponent = true
      type = readPlaceholder()

      if (typeof type !== 'function') {
        throw createError(`预期为函数组件，但收到: ${Object.prototype.toString.call(type).slice(8,-1)}`, nodeStart)
      }
    } else {
      const tagStart = pos
      type = readIdentifier()
      if (!type) {
        throw createError(`标签名不能为空，期望字母或数字，但找到 '${getCurrentChar()}'`, tagStart)
      }
    }

    // 解析属性
    const props = parseAttributes()
    skipWhitespace()

    // 检查单标签
    if (source.slice(pos, pos + 2) === '/>') {
      pos += 2
      return { type, props }
    }

    if (source[pos] !== '>') {
      throw createError(`期望标签结束符 '>' 或单标签结束符 '/>'，但找到 '${getCurrentChar()}'`, pos)
    }

    pos++ // 跳过 >

    // 解析子节点
    const children: any[] = []

    while (pos < len && source.slice(pos, pos + 2) !== '</') {
      skipWhitespace()
      if (pos >= len || source.slice(pos, pos + 2) === '</') break

      if (source[pos] === '<') {
        children.push(parseNode())
      } else if (source[pos] === '\x00') {
        children.push(readPlaceholder())
      } else {
        const text = readText()
        if (text) children.push(text)
      }
    }

    // 解析闭合标签
    if (pos >= len) {
      throw createError(`标签 '${isComponent ? type.name : type}' 未闭合，缺少结束标签`, nodeStart)
    }

    if (source.slice(pos, pos + 2) !== '</') {
      throw createError(`期望结束标签 '</'，但找到 '${source.slice(pos, pos + 2)}'`, pos)
    }

    const closeStart = pos
    pos += 2 // 跳过 </

    if (source.slice(pos, pos + 2) === '/>') {
      // 组件 <//> 闭合
      if (!isComponent) {
        throw createError(`普通标签 '${type}' 不能使用 <//>  闭合，应使用 </${type}>`, closeStart)
      }
      pos += 2
    } else {
      // 普通闭合标签
      const closingStart = pos
      const closingTag = readIdentifier()

      if (!closingTag) {
        throw createError(`结束标签名不能为空，期望字母或数字，但找到 '${getCurrentChar()}'`, closingStart)
      }

      if (isComponent) {
        throw createError(`组件应使用 <//>  闭合，而不是 </${closingTag}>`, closeStart)
      }

      if (closingTag !== type) {
        throw createError(`标签不匹配: 开始标签 '${type}' 与结束标签 '${closingTag}' 不对应`, closeStart)
      }

      skipWhitespace()

      if (source[pos] !== '>') {
        throw createError(`期望结束标签闭合符 '>'，但找到 '${getCurrentChar()}'`, pos)
      }

      pos++
    }

    // 构造节点
    const node: any = { type, props }
    if (children.length > 0) {
      node.props.children = children.length === 1 ? children[0] : children
    }

    return node
  }

  // 开始解析
  skipWhitespace()

  if (pos >= len) {
    throw createError('JSX 不能为空')
  }

  if (source[pos] !== '<') {
    throw createError('JSX 必须以标签符开始')
  }

  const rootNodes: any[] = []

  while (pos < len) {
    skipWhitespace()
    if (pos >= len) break

    if (source[pos] === '<') {
      rootNodes.push(parseNode())
    }
    else if (source[pos] === '\x00') {
      rootNodes.push(readPlaceholder())
    }
    else {
      const text = readText()
      if (text) rootNodes.push(text)
    }
  }

  if (rootNodes.length === 0) {
    throw createError('JSX 不能为空')
  }
  else if (rootNodes.length === 1) {
    return rootNodes[0]
  }
  else {
    return { type: 'fragment', props: { children: rootNodes } }
  }
}
