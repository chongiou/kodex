import { COLORS, compareDictWithPath, deepTraverse, generateUniqueId } from '@/utils'
import { createJsAction, definedVar, switchToVarMode, switchToVarModeForAction } from './target-env'
import { createEffect, createOwner, Owner, runWithOwner, SignalGetter } from '@/core/reactive'
import type { Variable, AllVariableTypes } from './target-env'
import { adapt } from './adapter'

// note: 不需要抽象平台，因为它专门为特定的目标环境(zdjl)设计
declare const zdjl: any

export class DialogContext {
  dialogContextExpr = ''
  constructor(context: RenderContext) {
    this.dialogContextExpr = hoistValue(
      generateUniqueId(),
      this,
      context.scope
    )
  }
  cancel() {
    zdjl.runAction({ type: '按键', keyCode: 4 })
  }
}

export interface RendererHooks {
  dialogReady?(context: RenderContext): void
}

interface ElementConfig {
  varType: AllVariableTypes | ((elem: JSX.Element) => AllVariableTypes)
  convert: (elem: JSX.Element, context: RenderContext, varname: string) => Record<string, any>
}

export class RenderContext {
  public eventListeners = new Map<string, Function>()
  public hooks: RendererHooks = {}
  public cleanupFns: Function[] = []
  public reactiveProps: string[] = []
  public reservedNames = new Map<string, string>()
  public owner: Owner = createOwner()
  public scope = `kodex.context.${generateUniqueId()}`
  public viewId = `view$${generateUniqueId()}`
  public eventEmitId = `eventEmit$${generateUniqueId()}`
  public isUserCancel = true
  public dialogContext = new DialogContext(this)

  private varCounter = 0
  private pathStack = ['view']

  get currentPath() { return this.pathStack.join('.') }

  generateVarName() { return `var$${++this.varCounter}` }

  pushPath(name: string) { this.pathStack.push(name) }
  popPath() { if (this.pathStack.length > 1) this.pathStack.pop() }

  addEventListener(fn: Function) {
    this.eventListeners.set(`${this.currentPath}.var$${this.varCounter}`, fn)
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
        this.hooks.dialogReady?.(this)
        oldValue = JSON.parse(JSON.stringify(newValue))
        return
      }
      const diff = compareDictWithPath(oldValue, newValue)
      if (diff.length) {
        oldValue = JSON.parse(JSON.stringify(newValue))
        diff.forEach(change => {
          const path = `view.${change.path}`
          const eventListener = this.eventListeners.get(path)
          eventListener && eventListener({ ...change, ...this.dialogContext })
        })
      }
    }
    Object.defineProperty(valueChangeEmitter, 'name', { value: 'valueChangeEmitter' })
    return valueChangeEmitter
  }

  cleanup() {
    this.cleanupFns.forEach(fn => fn())
    this.cleanupFns = []
    this.eventListeners.clear()
    this.owner.dispose()
    zdjl.clearVars(this.scope)
    zdjl.deleteVar(this.viewId)
    zdjl.deleteVar(this.eventEmitId)
  }
}

// 工具函数
function hoistValue(name: string, value: any, scope: string, debug = true) {
  if (typeof zdjl !== 'undefined') {
    zdjl.setVar(name, value, scope)
  }
  if (debug) {
    console.log(`${COLORS.YELLOW}写入变量${COLORS.RESET} ${COLORS.GREEN}${name}${COLORS.RESET} = `, value)
  }
  return `zdjl.getVar('${name}','${scope}')`
}

export function hoistSignal(signalGetter: SignalGetter, scope: string, context: RenderContext) {
  const name = generateUniqueId()
  createEffect(() => {
    const value = signalGetter()
    console.log('hoistSignal', name, value)
    hoistValue(name, value, scope)
  })
  return `zdjl.getVar('${name}','${scope}')`
}

function hoistFunc(fn: Function, scope: string) {
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
      result = hoistSignal(child, context.scope, context)
    }
    return index === 0 ? result : `+${result}`
  })

  return [hasReactive, parts.join('')]
}

function processSignal(value: any, context: RenderContext) {
  return typeof value === 'function' ? hoistSignal(value, context.scope, context) : value
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
              const funcExpr = hoistFunc(elem.props.onClick, context.scope)
              return createJsAction(`${funcExpr}(${context.dialogContext.dialogContextExpr})`)
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
      const value = processSignal(elem.props.value, context)
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
        { target: 'value', source: 'checked', convert: (value) => processSignal(value, context) }
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
            return typeof value === 'function'
              ? hoistSignal(value, context.scope, context)
              : (Array.isArray(value) ? value : [''])
          }
        },
        {
          target: 'value', source: 'selected', convert: (value) => processSignal(value, context)
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
  render(rootComponent: JSX.Element, options: { storageId?: string; hooks?: RendererHooks } = {}) {
    const context = new RenderContext()
    context.hooks = options.hooks ?? {}

    return runWithOwner(context.owner, () => {
      const storageId = options.storageId ?? (typeof rootComponent.type === 'function' ? rootComponent.type.name : generateUniqueId())
      context.viewId = `view$${storageId}`

      return this.executeRender(rootComponent, context)
    })
  }

  private executeRender(rootComponent: JSX.Element, context: RenderContext) {
    // 提取根元素
    const [headerElement, mainElement, footerElement] = this.extractRootElements(rootComponent)

    // 处理各部分
    const header = headerElement ? this.processHeader(headerElement, context) : { isReactive: false, title: undefined }
    const main = [this.processElement(mainElement, context)].flat()
    const footer = footerElement ? this.processFooter(footerElement, context) : {}

    // 创建事件发射器
    const eventEmitter = context.createValueChangeEmitter()
    const eventListenerFunc = hoistFunc(eventEmitter, context.scope)

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

    const action = switchToVarModeForAction(
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
        await zdjl.runActionAsync(action)
        const raw: Record<string, any> = zdjl.getVar(context.viewId)
        const input = this.processInput(raw, context)
        return { raw, input }
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

  private processFooter(elem: JSX.Element, context: RenderContext) {
    const result: {
      exprForCancelCallback?: string
      cancelTextIsReactive?: boolean
      cancelText?: string
      okTextIsReactive?: boolean
      okText?: string
    } = {}
    const children = [elem.props.children].flat()

    if (children[0]?.type === 'button') {
      const btn = children[0]
      if (btn.props.onClick) {
        result.exprForCancelCallback = `${hoistFunc(btn.props.onClick, context.scope)}()` // TODO: 如果要实现 close,这里需要判断是否是主动触发还是用户触发
      }
      const [cancelTextIsReactive, cancelText] = processText(btn.props.children, context)
      result.cancelTextIsReactive = cancelTextIsReactive
      result.cancelText = cancelText
    }

    if (children[1]?.type === 'button') {
      const btn = children[1]
      const [okTextIsReactive, okText] = processText(btn.props.children, context)
      result.okTextIsReactive = okTextIsReactive
      result.okText = okText
    }

    return result
  }

  private processElement(elem: JSX.Element, context: RenderContext): Variable | Variable[] {
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
        if (!key.startsWith('var$')) return
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
