import { COLORS, compareDictWithPath, deepTraverse, generateUniqueId, sleep, typeOf } from "@/utils"
import { createJsAction, definedVar, switchToVarMode, switchToVarModeForAction } from "./target-env"
import { createEffect, SignalGetter } from "@/core/reactive"
import { createConditionalHook } from "./hooks"
import { Markdown } from "./utils"
import type { Variable, AllVariableTypes, AllVariablePropsKeys } from "./target-env"
import type { Runtime } from '@/index'

// note: 不需要抽象平台，因为它专门为此平台服务
declare const zdjl: any

// 渲染上下文 - 管理渲染状态
export class RenderContext {
  public eventPool = new Map<string, Function>()
  public hooks = new Map<string, Function>()
  public cleanupPlan = new Set<Function>()
  public reserved = new Map<string, string>()
  public currentPath = 'view'
  public varCounter = 0
  public isUserCancel = true
  public exprForGetDialogContext: string = ''
  public signalDerivedProperties: string[] = []

  generateVarname(): string {
    return `var$${++this.varCounter}`
  }

  saveEvent(eventListener: Function, varname: string): void {
    this.eventPool.set(`${this.currentPath}.${varname}`, eventListener)
  }

  saveHooks(hooks: RendererHooks): void {
    for (const [key, value] of Object.entries(hooks)) {
      if (typeof value === 'function') {
        this.hooks.set(key, value)
      }
    }
  }

  getDialogContext(): DialogContext {
    const self = this
    return {
      reload() {
        throw new Error('方法未实现')
      },
      closeDialog() {
        self.isUserCancel = false
        zdjl.runAction({ type: "按键", keyCode: 4 })
      }
    }
  }

  cleanup(): void {
    this.cleanupPlan.forEach(fn => fn())
    this.cleanupPlan.clear()
    this.eventPool.clear()
    this.hooks.clear()
    this.reserved.clear()
  }

  createEventEmitter() {
    // (重要)必须给予变量默认值, 否则无法检测值前后变化!
    const debug = true
    let initialized = false
    let oldValue = {} as Record<string, any>
    const eventEmitter = (newValue: Record<string, any>) => {
      if (!newValue) return

      if (!initialized) {
        initialized = true
        // 不使用可选链是为了兼容 zdjl 环境
        const dialogCreatedHook = this.hooks.get('dialogCreated'); dialogCreatedHook && dialogCreatedHook(this)
        oldValue = JSON.parse(JSON.stringify(newValue))
        return
      }

      const diff = compareDictWithPath(oldValue, newValue)
      debug && console.warn('值变化:', diff)
      if (diff.length) {
        oldValue = JSON.parse(JSON.stringify(newValue))
        diff.forEach(change => {
          const path = `view.${change.path}`
          const eventListener = this.eventPool.get(path)
          eventListener && eventListener({ ...change, ...this.getDialogContext() })
        })
      }
    }
    return eventEmitter
  }
}

// 响应处理器 - 处理响应式相关
export class ReactiveProcessor {
  constructor(private context: RenderContext) { }

  hoistSignal(signalGetter: SignalGetter): { id: string, expr: string } {
    const name = generateUniqueId()
    const cleanup = createEffect(() => {
      const val = signalGetter()
      this.hoist(name, val, SCOPE.signal)
    })
    this.context.cleanupPlan.add(cleanup)
    return { id: name, expr: `zdjl.getVar('${name}','${SCOPE.signal}')` }
  }

  hoistFunc(fn: Function): { id: string, expr: string } {
    const name = generateUniqueId()
    return this.hoist(name, fn, SCOPE.func)
  }

  processText(val: any): [boolean, string] {
    const children = Array.isArray(val) ? val : [val]
    const isVarMode = !!children.find(it => typeof it === 'function')
    const res = children.map((child: string | Function | any, index) => {
      let result = ''
      if (typeof child === 'string') {
        result = isVarMode ? `'${child}'` : child
      } else if (typeof child === 'function') {
        result = `${this.hoistSignal(child).expr}`
      }
      return index === 0 ? result : `+${result}`
    })
    return [isVarMode, res.join('')]
  }

  hoist(name: string, value: any, scope: SCOPE) {
    if (typeof zdjl !== 'undefined') {
      zdjl.setVar(name, value, scope)
    } else {
      console.warn(`${COLORS.YELLOW}开发模式:写入变量${COLORS.RESET} name ${COLORS.GREEN}${name}${COLORS.RESET} scope ${COLORS.GREEN}${scope.padEnd(17, ' ')}${COLORS.RESET} value`, value)
    }
    return { id: name, expr: `zdjl.getVar('${name}','${scope}')` }
  }
}

export interface RendererHooks {
  dialogCreated?(ctx: Renderer): void
}
export interface EventTarget {
  path: string
  oldValue: any
  newValue: any
}
export interface DialogContext {
  reload(): void
  closeDialog(): void
}
const enum SCOPE {
  /**simplex-ui 使用的作用域,用于存放函数 */
  func = 'simplex-ui.func',
  /**simplex-ui 使用的作用域,用于存放其他值 */
  signal = 'simplex-ui.signal',
  /**当前脚本作用域 */
  self = ''
}

// 渲染器 - 协调渲染流程
export class Renderer {
  private processors: ElementConverter[] = []
  public reactiveProcessor: ReactiveProcessor
  public context: RenderContext

  constructor(hooks?: RendererHooks) {
    this.context = new RenderContext()
    this.reactiveProcessor = new ReactiveProcessor(this.context)

    if (hooks) this.context.saveHooks(hooks)
    this.context.exprForGetDialogContext = this.reactiveProcessor.hoist(
      generateUniqueId(),
      this.context.getDialogContext(),
      SCOPE.signal,
    ).expr
  }

  private handleComponent(elem: Runtime.Element): Variable[] | Variable {
    if (typeof elem.type !== 'function') {
      throw new Error(`The element is not a Component: ${elem.type}`)
    }
    const componentResult = elem.type(elem.props) as Runtime.Element[] | Runtime.Element
    const elements = Array.isArray(componentResult) ? componentResult : [componentResult]
    const vars: Variable[] = []
    for (const element of elements) {
      if (!element) continue
      const processed = this.processMainElement(element)
      if (Array.isArray(processed)) {
        vars.push(...processed)
      } else if (processed) {
        vars.push(processed)
      }
    }
    return vars.length === 1 ? vars[0] : vars
  }

  private processHeaderElement(elem: Runtime.Element) {
    const children = elem.props.children
    const [isExpr, title] = this.reactiveProcessor.processText(children)
    return { isExpr, title }
  }

  private processFooterElement(elem: Runtime.Element) {
    const result: {
      cancelText?: string,
      okText?: string,
      cancelTextIsExpr?: boolean,
      okTextIsExpr?: boolean,
      exprForCancelCallback?: string,
    } = {}
    const children = [elem.props.children].flat()
    if (children[0]?.type === 'button') {
      const btn = children[0]
      result.exprForCancelCallback = btn.props.onClick && `${this.reactiveProcessor.hoistFunc(btn.props.onClick).expr}()`
      const [cancelTextIsExpr, cancelText] = this.reactiveProcessor.processText(btn.props.children)
      result.cancelTextIsExpr = cancelTextIsExpr
      result.cancelText = cancelText
    }
    if (children[1]?.type === 'button') {
      const btn = children[1]
      const [okTextIsExpr, okText] = this.reactiveProcessor.processText(btn.props.children)
      result.okTextIsExpr = okTextIsExpr
      result.okText = okText
    }
    return result
  }

  private extractRootElements(rootComponent: Runtime.Element) {
    if (typeof rootComponent.type !== 'function') {
      throw new Error('需要根组件')
    }
    const rootElement = rootComponent.type(rootComponent.props) as Runtime.Element
    const children: Runtime.Element[] = Array.isArray(rootElement.props.children)
      ? rootElement.props.children
      : [rootElement.props.children]
    let header: Runtime.Element | null = null
    let main: Runtime.Element | null = null
    let footer: Runtime.Element | null = null
    for (const child of children) {
      if (!child || typeof child !== "object" || !("type" in child)) continue
      switch (child.type) {
        case "header":
          header = child as Runtime.Element
          break
        case "main":
          main = child as Runtime.Element
          break
        case "footer":
          footer = child as Runtime.Element
          break
      }
    }
    if (main === null) throw new Error('main 元素是必须的')
    main = {
      type: (x: Runtime.Element['props']) => x.children,
      props: { children: [main.props.children].flat() }
    }
    return [header, main, footer] as const
  }

  registerProcessor(...processors: ElementConverter[]) {
    this.processors.push(...processors)
  }

  processMainElement(elem: Runtime.Element): Variable[] | Variable {
    if (typeOf(elem) !== 'Object' || !elem.type) {
      if (typeof elem === 'string') {
        elem
      }
      console.error({ elem })
      throw new Error(`值不合法`)
    }
    if (typeof elem.type === 'function') {
      return this.handleComponent(elem)
    }
    const processor = this.processors.find(p => p.match(elem))
    if (!processor) {
      throw new Error(`该类型未实现: ${elem.type}`)
    }
    return processor.convertToVariable(elem, this)
  }

  /**
   * 渲染根组件
   * @param rootComponent 
   * @param storageId 存储ID用于记忆变量值，该ID在脚本范围内不可相同。如果该参数不提供的同时仍然开启记忆，不仅无效还会浪费存储空间
   * @returns
   */
  render(rootComponent: Runtime.Element, storageId: string = generateUniqueId()) {
    const viewId = `view$${storageId}`
    const eventEmitId = `eventEmit$${generateUniqueId()}`
    this.context.cleanupPlan.add(() => {
      sleep(50).then(() => {
        zdjl.clearVars(SCOPE.func)
        zdjl.clearVars(SCOPE.signal)
        zdjl.deleteVar(viewId)
        zdjl.deleteVar(eventEmitId)
      })
    })

    const [headerElement, mainElement, footerElement] = this.extractRootElements(rootComponent)

    const header = headerElement
      ? this.processHeaderElement(headerElement)
      : { isExpr: false, title: new Markdown().add(Markdown.space()).end() }
    const main = [this.processMainElement(mainElement)].flat()
    const footer = footerElement ? this.processFooterElement(footerElement) : {}

    const eventEmitter = this.context.createEventEmitter()
    const { expr: eventListenerFunc } = this.reactiveProcessor.hoistFunc(eventEmitter)

    const vars = [
      switchToVarMode(
        definedVar(eventEmitId, {
          varType: 'ui_text',
          textSize: 0,
          textContent: `${eventListenerFunc}(zdjl.getVar('${viewId}')),null`
        }),
        ['textContent']
      ),
      definedVar(viewId, {
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
        type: '设置变量',
        vars: vars,
        dialogTitle: header.title,
        dialogOKText: footer.okText,
        dialogCancelText: footer.cancelText,
        dialogCancelAction: footer.exprForCancelCallback
          ? createJsAction(footer.exprForCancelCallback)
          : undefined,
      },
      {
        dialogTitle: header.isExpr,
        dialogOKText: footer.okTextIsExpr,
        dialogCancelText: footer.cancelTextIsExpr,
      }
    )

    const show = async () => {
      if (typeof zdjl === 'undefined') {
        throw new Error('未处于目标环境,无法使用API: zdjl.runActionAsync')
      }
      await zdjl.runActionAsync(action)
      const signal = zdjl.getVars(SCOPE.signal)
      const raw = zdjl.getVar(viewId)
      const input: Record<string, any> = {}
      if (this.context.reserved.size) {
        deepTraverse(raw, (key, value) => {
          if (!key.startsWith('var$')) {
            // is not varname
            return
          }
          const reservedName = this.context.reserved.get(key)
          if (reservedName) {
            if (input[reservedName] == null) {
              input[reservedName] = value
            }
            else {
              input[reservedName] = [input[reservedName], value].flat()
            }
          }
        })
      }

      this.context.cleanup()
      return { raw, input, signal }
    }

    return { vars: main, action, show }
  }
}


export interface HookFunction<T = any, U = any> {
  (value: T, context: AdapterContext): U
}
export interface AdapterContext {
  sourceObj: Record<string, any> // 原始数据对象
  targetObj: Record<string, any> // 正在构建的目标对象
  targetPath: string[]           // 当前处理的属性路径
  sourcePath: string[]           // 当前处理的源属性路径
  config: AdapterConfig          // 当前使用的配置
}
export interface PropertyMapping<T = string, A = string> {
  /**目标路径 */
  target: T
  /**源路径 */
  source?: A
  /**当源值为 undefined 时的默认值 */
  defaultValue?: unknown
  /**钩子 */
  hooks?: HookFunction[]
  /**使用此映射的条件 */
  condition?(context: AdapterContext): boolean
}
export interface AdapterConfig {
  /**映射表:定义属性转换逻辑 */
  mappings: PropertyMapping[]
  /**全局属性预处理器:应用默认值后,执行属性钩子前 */
  preHook?: HookFunction
  /**全局属性后处理器:执行属性钩子后,写入目标对象前 */
  postHook?: HookFunction
  /**本次转换的错误处理逻辑 */
  errorHandler?: (error: Error, context: AdapterContext) => void // 错误处理器
}
export interface AdapterInterface {
  /**
   * 执行数据适配转换
   * @param adaptee 源数据对象
   * @param configOverrides 可选的配置,mappings将追加,其他属性覆盖
   * @returns 转换后的目标对象
   */
  adapt(adaptee: Record<string, any>, configOverrides?: Partial<AdapterConfig>): any
}
// 通用适配器 - 将源数据转换为目标数据格式
export class UniversalAdapter implements AdapterInterface {
  private readonly globalConfig: AdapterConfig
  constructor(baseConfig?: Partial<AdapterConfig>) {
    this.globalConfig = {
      mappings: [],
      errorHandler: (error, context) => {
        console.error('Adapter error:', error, context)
      },
      ...baseConfig
    }
  }
  public adapt(adaptee: Record<string, any>, configOverrides?: Partial<AdapterConfig>): Record<string, any> {
    const context: AdapterContext = { sourceObj: adaptee, targetObj: {}, config: this.mergeConfigs(this.globalConfig, configOverrides), targetPath: [], sourcePath: [] }

    return this.safeExecute(() => {
      for (const propertyMapping of context.config.mappings) {
        this.safeExecute(() => this.processMapping(context, propertyMapping), context, undefined)
      }
      return context.targetObj
    }, context, context.targetObj)
  }
  public static getSingleton(baseConfig?: Partial<AdapterConfig>): UniversalAdapter {
    if (!this._singleton) {
      this._singleton = new UniversalAdapter(baseConfig)
    }
    return this._singleton
  }
  private static _singleton: UniversalAdapter | undefined
  private processMapping(context: AdapterContext, mapping: PropertyMapping): void {
    if (mapping.condition && !mapping.condition(context)) return
    context.targetPath = mapping.target.split('.')
    // 如果 adaptee path 未提供, 则认为 target 和 adaptee 的路径一致, 所以直接使用 target path
    context.sourcePath = mapping.source ? mapping.source?.split('.') : context.targetPath
    let value = this.resolvePath(context.sourceObj, context.sourcePath)

    value = (value == null && 'defaultValue' in mapping) ? mapping.defaultValue : value
    value = context.config.preHook?.(value, context) ?? value
    value = this.applyHooks(context, value, mapping.hooks ?? [])
    value = context.config.postHook?.(value, context) ?? value

    if (value !== undefined) {
      this.setTargetValue(context.targetObj, context.targetPath, value)
    }
  }
  private mergeConfigs(base: AdapterConfig, overrides?: Partial<AdapterConfig>): AdapterConfig {
    if (!overrides) return base
    return {
      // 此处为合并,而非覆盖,是预期行为
      mappings: [...base.mappings, ...(overrides.mappings ?? [])],
      preHook: overrides.preHook ?? base.preHook,
      postHook: overrides.postHook ?? base.postHook,
      errorHandler: overrides.errorHandler ?? base.errorHandler,
    }
  }
  private resolvePath(obj: any, paths: string[]): any {
    return paths.reduce((acc, key) => acc?.[key], obj)
  }
  private setTargetValue(obj: any, paths: string[], value: any): void {
    for (let i = 0; i < paths.length - 1; i++) {
      const key = paths[i]
      if (!obj[key]) obj[key] = {}
      obj = obj[key]
    }
    obj[paths[paths.length - 1]] = value
  }
  private safeExecute<T>(fn: () => T, context: AdapterContext, fallback: T): T {
    try {
      return fn()
    } catch (error) {
      this.handleError(error as Error, context)
      return fallback
    }
  }
  private applyHooks<T, U>(context: AdapterContext, source: T, hooks: HookFunction[]): U {
    return hooks.reduce((source, hook) => {
      return this.safeExecute(() => hook(source, context), context, source)
    }, source as any)
  }
  private handleError(error: Error, context: AdapterContext): void {
    if (context.config.errorHandler) {
      context.config.errorHandler(error, context)
    } else {
      console.error('Adapter error:', error, context)
    }
  }
}

// 渲染函数
export function render(rootComponent: Runtime.Element, storageId?: string, hooks?: RendererHooks) {
  const rendererInstance = new Renderer(hooks)
  rendererInstance.registerProcessor(
    new Text(),
    new Button(),
    new Input(),
    new Container(),
    new Checkbox(),
    new Position(),
    new Select(),
    new File(),
    new Expression(),
  )
  return rendererInstance.render(rootComponent, storageId)
}

class VariableAdapter {
  constructor(private renderer: Renderer, private varname: string) { }
  private processSignal(value: any, adapterContext: AdapterContext) {
    if (typeof value === 'function') {
      const propertyName = adapterContext.targetPath[adapterContext.targetPath.length - 1]
      if (propertyName && !this.renderer.context.signalDerivedProperties.includes(propertyName)) {
        this.renderer.context.signalDerivedProperties.push(propertyName)
      }
      return this.renderer.reactiveProcessor.hoistSignal(value).expr
    }
    return value
  }
  private processChangeEvent(onChange: Function) {
    if (typeof onChange === 'function') {
      this.renderer.context.saveEvent(onChange, this.varname)
      return true
    } else {
      return
    }
  }
  public adapt(elem: Runtime.Element, mappings: PropertyMapping[]) {
    return UniversalAdapter.getSingleton({
      mappings: [
        // 表单与交互
        { target: 'showInput', defaultValue: true },
        { target: 'mustInput', source: 'required', defaultValue: false },
        { target: 'syncValueOnChange', source: 'onChange', hooks: [this.processChangeEvent] },
        { target: 'rememberInputValue', source: 'memo' },
        // 文本与内容
        { target: 'varDesc', source: 'description', },
        { target: 'showInputLabel', source: 'label', defaultValue: elem.props.name },
        { target: 'textLineBefore', source: 'extraTextAbove' },
        { target: 'textLineAfter', source: 'extraTextBelow' },
        { target: 'textAppendRight', source: 'extraTextRight' },
        // 样式和布局
        { target: 'showInputContentAlign', source: 'style.align' },
        { target: 'showInputWidthBasis', source: 'style.widthMode' },
        { target: 'showInputWidthGrow', source: 'style.growRatio' },
        { target: 'backgroundColor', source: 'style.bgColor', hooks: [processColor] },
        { target: 'backgroundImageData.data', source: 'style.bgImage' },
        // 可见性
        { target: 'showInputHiddenDesc', source: 'hideDescription' },
        { target: 'showInputHiddenLabel', source: 'hideLabel', hooks: [(val, ctx) => val != null ? val : !ctx.sourceObj.label] },
        { target: 'showInputHiddenView', source: 'hidden' },
      ],
      postHook: createConditionalHook(
        (val, ctx) => {
          // 排除事件监听器,这些内容单纯是函数,而非信号
          return !['onChange', 'onClick'].includes(ctx.sourcePath[0])
        },
        this.processSignal.bind(this)
      )
    })
      .adapt(elem.props, { mappings })
  }
}

// 工具函数
function processColor(val: any) {
  if (typeof val === 'string' && val.startsWith('#')) {
    if (val.length === 4) {
      val = `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`
      return val
    } else if (val.length === 7) {
      return val
    }
    return
  } else {
    return
  }
}
function createProcessTextHook(renderer: Renderer): HookFunction {
  return (val: any, adapterContext) => {
    const children = Array.isArray(val) ? val : [val]
    const isVarMode = !!children.find(it => typeof it === 'function')
    const res = children.map((child: string | Function | any, index) => {
      let result = ''
      if (typeof child === 'string') {
        result = isVarMode ? `'${child}'` : child
      } else if (typeof child === 'function') {
        const propertyName = adapterContext.targetPath[adapterContext.targetPath.length - 1]
        if (propertyName && !renderer.context.signalDerivedProperties.includes(propertyName)) {
          renderer.context.signalDerivedProperties.push(propertyName)
        }
        result = `${renderer.reactiveProcessor.hoistSignal(child).expr}`
      }
      return index === 0 ? result : `+${result}`
    })
    return res.join('')
  }
}

// 元素处理器基类 - 其子类处理不同类型的JSX元素
export abstract class ElementConverter {
  protected varname: string = ''

  public match(elem: Runtime.Element): boolean {
    return elem.type === this.type
  }

  public convertToVariable(elem: Runtime.Element, renderer: Renderer): Variable {
    const varname = renderer.context.generateVarname()
    if (elem.props.name) {
      renderer.context.reserved.set(varname, elem.props.name)
    }
    const adapter = new VariableAdapter(renderer, varname)
    const props = adapter.adapt(elem, this.getMappings(elem, renderer))
    return switchToVarMode(
      definedVar(varname, {
        varType: this.getVarType(elem, renderer),
        ...props,
      }),
      renderer.context.signalDerivedProperties
    )
  }

  protected defineMappings(mappings: PropertyMapping<AllVariablePropsKeys>[]) {
    return mappings
  }
  protected abstract type: string
  protected abstract getVarType(elem: Runtime.Element, renderer: Renderer): AllVariableTypes
  protected abstract getMappings(elem: Runtime.Element, renderer: Renderer): PropertyMapping[]
}
export class Button extends ElementConverter {
  type = 'button'
  getVarType() {
    return 'ui_button' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      {
        target: 'buttonText', source: 'children', hooks: [
          createConditionalHook(
            val => val == null,
            val => 'Button',
            createProcessTextHook(renderer)
          )
        ]
      },
      { target: 'closeDialogOnAction', defaultValue: false },
      {
        target: 'action', source: 'onClick', hooks: [val => {
          const result = createJsAction(typeof val === 'function' ? `${renderer.reactiveProcessor.hoistFunc(val).expr}(${renderer.context.exprForGetDialogContext})` : '')
          return result
        }]
      },
      { target: 'buttonStyle', source: 'style.buttonStyle', hooks: [val => typeof val === 'string' ? val : null] },
    ])
  }
}
export class Checkbox extends ElementConverter {
  type = 'checkbox'
  getVarType() {
    return 'bool' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      { target: 'value', source: 'checked' },
    ])
  }
}
export class Container extends ElementConverter {
  type = 'container'
  getVarType() {
    return 'object' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      { target: 'syncValueOnChange', defaultValue: false },
      {
        target: 'objectVars', source: 'children', hooks: [
          () => this.processChildren(renderer, elem),
          val => val
        ]
      },
    ])
  }
  private processChildren(renderer: Renderer, elem: Runtime.Element) {
    renderer.context.currentPath += `.${this.varname}`
    const vars: Variable[] = []
    for (const child of [elem.props.children].flat()) {
      if (child) {
        const res = renderer.processMainElement(child) as Variable
        vars.push(res)
      }
    }
    renderer.context.currentPath = renderer.context.currentPath.split('.').slice(0, -1).join('.')
    return vars
  }
}
export class Expression extends ElementConverter {
  type = 'expr'
  getVarType() {
    return 'expression' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      { target: 'valueExp', source: 'value', hooks: [val => typeof val === 'string' ? val : ''] },
    ])
  }
}
export class Input extends ElementConverter {
  type = 'input'
  getVarType(elem: Runtime.Element) {
    if (elem.props.type === 'number') {
      return 'number' as const
    }
    return 'string' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      {
        condition: () => elem.props.type === 'text',
        target: 'value', source: 'value'
      },
      {
        condition: () => elem.props.type === 'number',
        target: 'number', source: 'value'
      }
    ])
  }
}
export class Text extends ElementConverter {
  type = 'text'
  getVarType() {
    return 'ui_text' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      {
        target: 'textContent', source: 'children', hooks: [
          createConditionalHook(
            val => val?.type === 'expr',
            elem => {
              const expr = elem.props.value && typeof elem.props.value === 'string' ? elem.props.value : ''
              renderer.context.signalDerivedProperties.push('textContent')
              return expr
            }
          ),
          createProcessTextHook(renderer),
        ]
      },
      {
        target: 'textColor', source: 'style.fontColor', hooks: [processColor]
      },
      {
        target: 'textSize', source: 'style.fontSize'
      }
    ])
  }
}
export class File extends ElementConverter {
  type = 'file'
  getVarType() {
    return 'file' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      { target: 'filePath', source: 'value', hooks: [val => typeof val === 'string' ? val : ''] },
    ])
  }
}
export class Select extends ElementConverter {
  type = 'select'
  getVarType() {
    return 'string' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      {
        target: 'stringItems', source: 'options', hooks: [val => {
          if (typeof val === 'function') return val
          return Array.isArray(val) && val.length !== 0 ? val : ['']
        }]
      },
      {
        // note: 当处于 "选项代替输入时" , 该属性无法通过信号实时变更, 这是自动精灵本身的机制决定的
        target: 'value', source: 'selected'
      }
    ])
  }
}
export class Position extends ElementConverter {
  // note: 该变量类型的 "改动后实时设置值" 无效, 直接影响 onChange 无效, 这是自动精灵本身的机制决定的(即有入口有开关, 但并非支持)
  type = 'position'
  getVarType() {
    return 'position' as const
  }
  getMappings(elem: Runtime.Element, renderer: Renderer) {
    return this.defineMappings([
      { target: 'onlyCanChooseLocWhenInput', defaultValue: true }
    ])
  }
}

// TODO: 考虑到后期类爆炸, 可能需要寻求另一种方式定义转换逻辑


