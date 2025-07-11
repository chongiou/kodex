import { COLORS, compareDictWithPath, deepTraverse, generateUniqueId } from '@/utils'
import { createJsAction, definedVar, switchToVarMode, switchToVarModeForAction } from './target-env'
import { createEffect, createOwner, Owner, runWithOwner, SignalGetter, executeMountCallbacks } from '@/core/reactive'
import type { Variable, AllVariableTypes } from './target-env'
import { adapt } from './adapter'

// note: 不需要抽象平台，因为它专门为特定的目标环境(zdjl)设计
declare const zdjl: any

interface ElementConfig {
  varType: AllVariableTypes | ((elem: JSX.Element) => AllVariableTypes)
  convert: (elem: JSX.Element, context: RenderContext, varname: string) => Record<string, any>
}

export interface ChangeContext {
  path: string
  oldValue: unknown
  newValue: unknown
}

export const contextStack: RenderContext[] = []

export function getCurrentRenderContext(): RenderContext {
  const context = contextStack[contextStack.length - 1]
  if (!context) {
    throw new Error('当前不在渲染上下文中，无法获取渲染上下文实例')
  }
  return context
}

export class RenderContext {
  public eventListeners = new Map<string, Function>()
  public cleanupFns: Function[] = []
  private reactiveProps: string[] = []
  public reservedNames = new Map<string, string>()
  public owner: Owner = createOwner()
  public scope = `kodex.context.${generateUniqueId()}`
  public viewId = `view_${generateUniqueId()}`
  public eventEmitId = `eventEmit_${generateUniqueId()}`
  public signalManager = new SignalManager()
  public isInternalCancel = false
  public shouldRerender = false
  
  private varCounter = 0
  private pathStack = ['view']

  get currentPath() { return this.pathStack.join('.') }

  generateVarName() { return `var_${++this.varCounter}` }

  pushPath(name: string) { this.pathStack.push(name) }
  popPath() { if (this.pathStack.length > 1) this.pathStack.pop() }

  addEventListener(listener: Function): true {
    this.eventListeners.set(this.currentPath, listener)
    return true
  }

  addReactiveProperty(prop: string) {
    if (!this.reactiveProps.includes(prop)) {
      this.reactiveProps.push(prop)
    }
  }

  getAndClearReactiveProps() {
    return this.reactiveProps.splice(0)
  }

  reserveVarName(varname: string, name: string) {
    this.reservedNames.set(varname, name)
  }

  createValueChangeEmitter() {
    let initialized = false
    let oldValue = {} as Record<string, any>
    const valueChangeEmitter = (newValue: Record<string, any>) => {
      if (!newValue) return
      if (!initialized) {
        initialized = true
        executeMountCallbacks(this.owner)
        oldValue = JSON.parse(JSON.stringify(newValue))
        return
      }
      const diff = compareDictWithPath(oldValue, newValue)
      if (diff.length) {
        oldValue = JSON.parse(JSON.stringify(newValue))
        diff.forEach(async change => {
          const path = `view.${change.path}`
          const eventListener = this.eventListeners.get(path)
          if (eventListener) eventListener({ ...change })
        })
      }
    }
    Object.defineProperty(valueChangeEmitter, 'name', { value: 'valueChangeEmitter' })
    return valueChangeEmitter
  }

  cancelDialog() {
    zdjl.runActionAsync({ type: '按键', keyCode: 4 })
  }

  closeDialog() {
    this.isInternalCancel = true
    this.cancelDialog()
  }

  rerender() {
    this.shouldRerender = true
    this.closeDialog()
  }

  checkAndResetRerender(): boolean {
    if (this.shouldRerender) {
      this.shouldRerender = false
      return true
    }
    return false
  }

  cleanup() {
    this.cleanupFns.forEach(fn => fn())
    this.cleanupFns = []
    this.eventListeners.clear()
    this.owner.dispose()
    this.signalManager.clear()
    zdjl.clearVars(this.scope)
    zdjl.deleteVar(this.viewId)
    zdjl.deleteVar(this.eventEmitId)
    const index = contextStack.indexOf(this)
    if (index !== -1) {
      contextStack.splice(index, 1)
    }
  }
}

// 工具函数
function hoistValue(name: string, value: any, scope: string, debug = false) {
  if (typeof zdjl !== 'undefined') {
    zdjl.setVar(name, value, scope)
  }
  if (debug) {
    console.log(`${COLORS.YELLOW}写入变量${COLORS.RESET} ${COLORS.GREEN}${name}${COLORS.RESET} = `, value)
  }
  return `zdjl.getVar('${name}','${scope}')`
}

export function hoistSignal(signalGetter: SignalGetter, onHoisted?: Function) {
  if (typeof signalGetter !== 'function') {
    throw new Error('不是信号')
  }
  const { scope } = getCurrentRenderContext()
  const name = generateUniqueId()
  let value: any
  let [_, hasDependencies] = createEffect(() => {
    value = signalGetter()
    hoistValue(name, value, scope)
  })
  if (hasDependencies) {
    if (onHoisted) onHoisted()
    return `zdjl.getVar('${name}','${scope}')`
  } else {
    zdjl.deleteVar(name, scope)
    return value
  }
}

export function hoistFunc(fn: Function): string {
  const { scope } = getCurrentRenderContext()
  const name = generateUniqueId()
  return hoistValue(name, fn, scope)
}

function processColor(val: string | undefined) {
  if (typeof val === 'string' && val.startsWith('#')) {
    return val.length === 4
      ? `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`
      : val.length === 7 ? val : undefined
  }
}

function processText(value: any, context: RenderContext): [boolean, string] {
  const children = Array.isArray(value) ? value : [value]
  const hasReactive = children.some(child => typeof child === 'function')

  const parts = children.map((child, index) => {
    let result = ''
    if (typeof child === 'string') {
      result = hasReactive ? `'${child}'` : child
    } else if (typeof child === 'function') {
      result = hoistSignal(child)
    }
    return index === 0 ? result : `+${result}`
  })

  return [hasReactive, parts.join('')]
}

// 元素转换配置表
const ELEMENT_CONFIGS: Record<string, ElementConfig> = {
  text: {
    varType: 'ui_text',
    convert: (elem, context) => {
      return adapt(elem, context, [
        {
          target: 'textContent', source: 'children', convert() {
            if (elem.props.children) {
              if (elem.props.children?.type === 'expr') {
                const expr = elem.props.children.props.value ?? ''
                context.addReactiveProperty('textContent')
                return expr
              } else {
                const [isReactive, text] = processText(elem.props.children, context)
                if (isReactive) context.addReactiveProperty('textContent')
                return text
              }
            }
          }
        },
        { target: 'textColor', source: 'style.fontColor', convert: processColor },
        { target: 'textSize', source: 'style.fontSize' },
      ])
    }
  },

  button: {
    varType: 'ui_button',
    convert: (elem, context) => {
      return adapt(elem, context, [
        {
          target: 'buttonText', source: 'children', convert() {
            if (elem.props.children) {
              const [isReactive, text] = processText(elem.props.children, context)
              if (isReactive) context.addReactiveProperty('buttonText')
              return text
            }
          }
        },
        {
          target: 'action', source: 'onClick', convert() {
            if (elem.props.onClick) {
              const funcExpr = hoistFunc(elem.props.onClick)
              return createJsAction(`${funcExpr}()`)
            }
          }
        },
        { target: 'buttonStyle', source: 'style.buttonStyle' },
        { target: 'closeDialogOnAction', defaultValue: false },
      ])
    }
  },

  input: {
    varType: (elem) => {
      if (elem.props.type === 'number') return 'number'
      if (elem.props.type === 'file') return 'file'
      return 'string'
    },
    convert: (elem, context) => {
      const value = elem.props.value
      return adapt(elem, context, [
        {
          condition: () => elem.props.type === 'number',
          target: 'number', source: 'value', convert: () => value ?? 0
        },
        {
          condition: () => elem.props.type === 'text',
          target: 'value', source: 'value', convert: () => value ?? ''
        },
        {
          condition: () => elem.props.type === 'file',
          target: 'filePath', source: 'value', convert: () => value ?? ''
        },
        {
          condition: () => elem.props.type === 'file',
          target: 'inputModeFileSuffix', source: 'limitSuffix', convert: () => value ?? ''
        }
      ])
    }
  },

  checkbox: {
    varType: 'bool',
    convert: (elem, context) => {
      return adapt(elem, context, [
        { target: 'value', source: 'checked' }
      ])
    }
  },

  container: {
    varType: 'object',
    convert: (elem, context) => ({
      showInput: true,
      mustInput: false,
      syncValueOnChange: false,
      objectVars: [] // 会在 processElement 中填充
    })
  },

  expr: {
    varType: 'expression',
    convert: (elem) => ({
      valueExp: elem.props.value ?? ''
    })
  },

  select: {
    varType: 'string',
    convert: (elem, context) => {
      return adapt(elem, context, [
        {
          target: 'stringItems', source: 'options', convert: (value) => {
            if (typeof value === 'function') {
              return value
            } else {
              return Array.isArray(value) ? value : ['']
            }
          }
        },
        {
          target: 'value', source: 'selected'
        }
      ])
    }
  },

  position: {
    varType: 'position',
    convert: () => ({
      onlyCanChooseLocWhenInput: true
    })
  }
}

export class Renderer {
  render(rootComponent: JSX.Element, options: { storageId?: string } = {}) {
    const context = new RenderContext()
    contextStack.push(context)

    return runWithOwner(context.owner, () => {
      const storageId = options.storageId ?? (typeof rootComponent.type === 'function' ? rootComponent.type.name : generateUniqueId())
      context.viewId = `view_${storageId}`

      return this.executeRender(rootComponent, context)
    })
  }

  private executeRender(rootComponent: JSX.Element, context: RenderContext) {
    // 提取根元素
    const [headerElement, mainElement, footerElement] = this.extractRootElements(rootComponent)

    // 处理各部分
    const header = headerElement ? this.processHeader(headerElement, context) : { isReactive: false, title: undefined }
    const main = [this.processElement(mainElement, context)].flat()
    const footer = this.processFooter(footerElement, context)

    // 创建事件发射器
    const eventEmitter = context.createValueChangeEmitter()
    const eventListenerFunc = hoistFunc(eventEmitter)

    // 创建变量和动作
    const vars = [
      switchToVarMode(
        definedVar(context.eventEmitId, {
          varType: 'ui_text',
          textSize: 0,
          textContent: `${eventListenerFunc}(zdjl.getVar('${context.viewId}')),null`
        }),
        ['textContent']
      ),
      definedVar(context.viewId, {
        varType: 'object',
        showInput: true,
        mustInput: false,
        showInputHiddenLabel: true,
        objectVars: main,
        syncValueOnChange: true,
      })
    ]

    let action = switchToVarModeForAction(
      {
        type: '设置变量' as const,
        vars: vars,
        dialogTitle: header.title,
        dialogOKText: footer.okText,
        dialogCancelText: footer.cancelText,
        dialogCancelAction: footer.exprForCancelCallback ? createJsAction(footer.exprForCancelCallback) : undefined,
      },
      {
        dialogTitle: header.isReactive,
        dialogOKText: footer.okTextIsReactive,
        dialogCancelText: footer.cancelTextIsReactive,
      }
    )

    const show = async () => {
      if (typeof zdjl === 'undefined') {
        throw new Error('未处于目标环境,无法使用API: zdjl.runActionAsync')
      }
      try {
        while (true) {
          await zdjl.runActionAsync(action)
          if (context.checkAndResetRerender()) {
            action = this.executeRender(rootComponent, context).action
            continue
          }
          const raw: Record<string, any> = zdjl.getVar(context.viewId)
          const input = this.processInput(raw, context)
          const signals = context.signalManager.getAllValues()
          return { raw, input, signals }
        }
      } finally {
        context.cleanup()
      }
    }

    return {
      /**不要试图手动运行 action, 因为那会导致内部清理工作失效，进而导致内存泄漏, 请使用 show 方法 */
      action,
      vars: main,
      show
    }
  }

  private extractRootElements(rootComponent: JSX.Element) {
    const rootElement = typeof rootComponent.type === 'function'
      ? rootComponent.type(rootComponent.props) as JSX.Element
      : rootComponent

    if (rootElement.type !== 'root') {
      const mainElement = { type: (x: any) => x.children, props: { children: [rootElement].flat() } }
      return [null, mainElement, null] as const
    }

    const children: JSX.Element[] = Array.isArray(rootElement.props.children) ? rootElement.props.children : [rootElement.props.children]
    let header: JSX.Element | null = null
    let main: JSX.Element | null = null
    let footer: JSX.Element | null = null

    for (const child of children) {
      if (!child || typeof child !== 'object' || !('type' in child)) continue
      switch (child.type) {
        case 'header': header = child; break
        case 'main': main = child; break
        case 'footer': footer = child; break
      }
    }

    if (main === null) throw new Error('main 元素是必须的')
    main = { type: (x: any) => x.children, props: { children: [main.props.children].flat() } }

    return [header, main, footer] as const
  }

  private processHeader(elem: JSX.Element, context: RenderContext) {
    const [isReactive, title] = processText(elem.props.children, context)
    return { isReactive, title }
  }

  private processFooter(elem: JSX.Element | null, context: RenderContext) {
    const result: {
      exprForCancelCallback?: string
      cancelTextIsReactive?: boolean
      cancelText?: string
      okTextIsReactive?: boolean
      okText?: string
    } = {}
    const children = elem ? [elem.props.children].flat() : null

    // 预期的,即使没设置 footer 也设置取消回调
    const cancelCallback = children?.[0].props.onClick as Function | null
    const expr = hoistFunc(() => {
      if (!context.isInternalCancel) {
        if (cancelCallback) cancelCallback()
      }
    })
    result.exprForCancelCallback = `${expr}()`

    if (!children) {
      return result
    }

    if (children[0]?.type === 'button') {
      const btn = children[0]
      const [cancelTextIsReactive, cancelText] = processText(btn.props.children, context)
      result.cancelTextIsReactive = cancelTextIsReactive
      result.cancelText = cancelText
    }

    if (children[1]?.type === 'button') {
      const btn = children[1]
      // NOTE: 无视确认按钮的 onclick, 这里没必要实现
      const [okTextIsReactive, okText] = processText(btn.props.children, context)
      result.okTextIsReactive = okTextIsReactive
      result.okText = okText
    }

    return result
  }

  private processElement(elem: JSX.Element, context: RenderContext): Variable | Variable[] {
    if (elem.type === 'fragment') {
      elem = { type: (x: any) => x.children, props: elem.props }
    }

    if (typeof elem.type === 'function') {
      return this.handleComponent(elem, context)
    }

    return this.convertToVariable(elem, context)
  }

  private handleComponent(elem: JSX.Element, context: RenderContext): Variable | Variable[] {
    if (typeof elem.type !== 'function') {
      throw new Error(`The element is not a Component: ${elem.type}`)
    }

    const componentResult = elem.type(elem.props) as JSX.Element[] | JSX.Element
    const elements = Array.isArray(componentResult) ? componentResult : [componentResult]
    const vars: Variable[] = []

    for (const element of elements) {
      if (!element) continue
      const processed = this.processElement(element, context)
      if (Array.isArray(processed)) {
        vars.push(...processed)
      } else if (processed) {
        vars.push(processed)
      }
    }

    return vars.length === 1 ? vars[0] : vars
  }

  private convertToVariable(elem: JSX.Element, context: RenderContext): Variable {
    const config = ELEMENT_CONFIGS[elem.type as string]
    if (!config) {
      throw new Error(`该类型未实现: ${elem.type}`)
    }

    const varname = context.generateVarName()
    if (elem.props.name) {
      context.reserveVarName(varname, elem.props.name)
    }

    context.pushPath(varname)

    try {
      const varType = typeof config.varType === 'function' ? config.varType(elem) : config.varType
      let props = config.convert(elem, context, varname)

      // 处理容器的子元素
      if (elem.type === 'container' && elem.props.children) {
        const children = Array.isArray(elem.props.children) ? elem.props.children : [elem.props.children]
        const childVars: Variable[] = []
        for (const child of children) {
          if (child) {
            const childVar = this.processElement(child, context) as Variable
            childVars.push(childVar)
          }
        }
        props.objectVars = childVars
      }

      const reactiveProps = context.getAndClearReactiveProps()

      return switchToVarMode(
        definedVar(varname, { varType, ...props }),
        reactiveProps
      )
    } finally {
      context.popPath()
    }
  }

  private processInput(raw: Record<string, any>, context: RenderContext) {
    const input: Record<string, any> = {}

    if (context.reservedNames.size) {
      deepTraverse(raw, (key, value) => {
        if (!key.startsWith('var_')) return
        const reservedName = context.reservedNames.get(key)
        if (reservedName) {
          if (input[reservedName] == null) {
            input[reservedName] = value
          } else {
            input[reservedName] = [input[reservedName], value].flat()
          }
        }
      })
    }

    return input
  }
}

export const render: typeof Renderer.prototype.render = (...args) => new Renderer().render(...args)

export class SignalManager {
  private namedSignals = new Map<string, SignalGetter[]>()

  register(name: string, signal: SignalGetter) {
    const signalsStored = this.namedSignals.get('name')
    if (signalsStored) {
      this.namedSignals.set(name, signalsStored.concat(signal))
    } else {
      this.namedSignals.set(name, [signal])
    }
  }

  getAllValues() {
    const values: Record<string, any> = {}
    this.namedSignals.forEach((signals, name) => {
      values[name] = signals.length > 1 ? signals.map(signal => signal()) : signals[0]()
    })
    return values
  }

  clear() {
    this.namedSignals.clear()
  }
}
