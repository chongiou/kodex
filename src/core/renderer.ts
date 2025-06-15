import { COLORS, compareDictWithPath, deepTraverse, generateUniqueId, sleep, typeOf } from "@/utils"
import { createJsAction, definedVar, switchToVarMode, switchToVarModeForAction } from "./target-env"
import { createEffect, SignalGetter } from "@/core/reactive"
import { createConditionalHook } from "./hooks"
import { Markdown } from "./utils"
import type { Variable, AllVariableTypes, AllVariablePropsKeys } from "./target-env"

// note: 不需要抽象平台，因为它专门为此平台服务
declare const zdjl: any

// 渲染上下文 - 管理渲染状态
class RenderContext {
  private eventListenerPool = new Map<string, Function>()
  private renderHooks = new Map<string, Function>()
  private variableCounter = 0
  private variablePathStack: string[] = ['view']
  private cleanupFunctions = new Set<Function>()
  private reservedVariableNames = new Map<string, string>()

  public reactiveDerivedProperties: string[] = []
  public isUserCancel = true
  public dialogContextExpression: string = ''
  public SCOPE = { method: `kodex.method.${generateUniqueId()}`, signal: `kodex.signal.${generateUniqueId()}` } as const

  constructor(private debug = false) { }

  get currentVariablePath(): string {
    return this.variablePathStack.join('.')
  }

  pushVariablePath(varname: string): void {
    this.variablePathStack.push(varname)
  }

  popVariablePath(): void {
    if (this.variablePathStack.length > 1) {
      this.variablePathStack.pop()
    }
  }

  generateVariableName(): string {
    return `var$${++this.variableCounter}`
  }

  saveEventListener(eventListener: Function, varname: string): void {
    this.eventListenerPool.set(`${this.currentVariablePath}.${varname}`, eventListener)
  }

  saveHooks(hooks: RendererHooks): void {
    for (const [key, value] of Object.entries(hooks)) {
      if (typeof value === 'function') {
        this.renderHooks.set(key, value)
      }
    }
  }

  createDialogContext(): DialogContext {
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
    this.cleanupFunctions.forEach(fn => fn())
    this.cleanupFunctions.clear()
    this.eventListenerPool.clear()
    this.renderHooks.clear()
    this.reservedVariableNames.clear()
  }

  createValueChangeEmitter() {
    // NOTE：必须给予变量默认值, 否则无法检测值前后变化
    const debug = this.debug
    let initialized = false
    let oldValue = {} as Record<string, any>

    const eventEmitter = (newValue: Record<string, any>) => {
      if (!newValue) return

      if (!initialized) {
        initialized = true
        const dialogCreatedHook = this.renderHooks.get('dialogCreated')
        dialogCreatedHook && dialogCreatedHook()
        oldValue = JSON.parse(JSON.stringify(newValue))
        return
      }

      const diff = compareDictWithPath(oldValue, newValue)
      debug && console.warn('值变化:', diff)

      if (diff.length) {
        oldValue = JSON.parse(JSON.stringify(newValue))
        diff.forEach(change => {
          const path = `view.${change.path}`
          const eventListener = this.eventListenerPool.get(path)
          eventListener && eventListener({ ...change, ...this.createDialogContext() })
        })
      }
    }

    return eventEmitter
  }

  addCleanupFunction(fn: Function): void {
    this.cleanupFunctions.add(fn)
  }

  addReactiveProperty(propertyName: string): void {
    if (!this.reactiveDerivedProperties.includes(propertyName)) {
      this.reactiveDerivedProperties.push(propertyName)
    }
  }

  getReactiveProperties(): string[] {
    return this.reactiveDerivedProperties.splice(0)
  }

  reserveVariableName(varname: string, name: string): void {
    this.reservedVariableNames.set(varname, name)
  }

  getReservedVariableNames(): Map<string, string> {
    return this.reservedVariableNames
  }
}

// 响应式处理器 - 处理响应式相关
class ReactiveProcessor {
  constructor(private readonly context: RenderContext, private readonly debug = false) { }

  hoistSignal(signalGetter: SignalGetter): { id: string, expr: string } {
    const name = generateUniqueId()
    const cleanup = createEffect(() => {
      const val = signalGetter()
      this.hoist(name, val, this.context.SCOPE.signal)
    })
    this.context.addCleanupFunction(cleanup)
    return { id: name, expr: `zdjl.getVar('${name}','${this.context.SCOPE.signal}')` }
  }

  hoistFunc(fn: Function): { id: string, expr: string } {
    const name = generateUniqueId()
    return this.hoist(name, fn, this.context.SCOPE.method)
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

  hoist(name: string, value: any, scope: RenderContext['SCOPE']['method' | 'signal']) {
    if (typeof zdjl !== 'undefined') {
      zdjl.setVar(name, value, scope)
    }
    if (this.debug) {
      if (typeof zdjl !== 'undefined') {
        console.warn(`写入变量 name=${name} scope=${scope} value=${value} valType=${typeOf(value)}`)
      } else {
        console.log(`${COLORS.YELLOW}写入变量${COLORS.RESET} name ${COLORS.GREEN}${name}${COLORS.RESET} scope ${COLORS.GREEN}${scope.padEnd(17, ' ')}${COLORS.RESET} value`, value)
      }
    }
    return { id: name, expr: `zdjl.getVar('${name}','${scope}')` }
  }
}

interface RendererHooks {
  dialogCreated?(ctx: Renderer): void
}
export interface DialogContext {
  reload(): void
  closeDialog(): void
}

// 渲染会话 - 用于存储状态
interface RenderSession {
  context: RenderContext
  reactiveProcessor: ReactiveProcessor
  processElement(elem: JSX.Element | string, session: RenderSession): Variable[] | Variable
  elementStack: JSX.Element[]
  getParentElement(): JSX.Element | undefined
  getChildElements(): JSX.Element[]
}

// 渲染器 - 协调渲染流程
export class Renderer {
  private converter: Map<string, ElementConverter> = new Map()

  constructor(private debug = false) { }

  private createRenderSession(): RenderSession {
    const context = new RenderContext(this.debug)
    const reactiveProcessor = new ReactiveProcessor(context, this.debug)
    const elementStack: JSX.Element[] = []

    // 设置对话框上下文表达式
    context.dialogContextExpression = reactiveProcessor.hoist(
      generateUniqueId(),
      context.createDialogContext(),
      context.SCOPE.signal,
    ).expr

    const session = {
      context,
      reactiveProcessor,
      processElement: this.processElement.bind(this),
      elementStack,
      getParentElement: () => elementStack[elementStack.length - 2],
      getChildElements: () => {
        const currentElement = elementStack[elementStack.length - 1]
        if (!currentElement || !currentElement.props.children) return []
        return Array.isArray(currentElement.props.children)
          ? currentElement.props.children
          : [currentElement.props.children]
      }
    }
    return session
  }

  private handleComponent(elem: JSX.Element, session: RenderSession): Variable[] | Variable {
    if (typeof elem.type !== 'function') {
      throw new Error(`The element is not a Component: ${elem.type}`)
    }
    const componentResult = elem.type(elem.props) as JSX.Element[] | JSX.Element
    const elements = Array.isArray(componentResult) ? componentResult : [componentResult]
    const vars: Variable[] = []
    for (const element of elements) {
      if (!element) continue
      const processed = this.processElement(element, session)
      if (Array.isArray(processed)) {
        vars.push(...processed)
      } else if (processed) {
        vars.push(processed)
      }
    }
    return vars.length === 1 ? vars[0] : vars
  }

  private processHeaderElement(elem: JSX.Element, session: RenderSession) {
    const children = elem.props.children
    const [isExpr, title] = session.reactiveProcessor.processText(children)
    return { isExpr, title }
  }

  private processFooterElement(elem: JSX.Element, session: RenderSession) {
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
      result.exprForCancelCallback = btn.props.onClick && `${session.reactiveProcessor.hoistFunc(btn.props.onClick).expr}()`
      const [cancelTextIsExpr, cancelText] = session.reactiveProcessor.processText(btn.props.children)
      result.cancelTextIsExpr = cancelTextIsExpr
      result.cancelText = cancelText
    }
    if (children[1]?.type === 'button') {
      const btn = children[1]
      const [okTextIsExpr, okText] = session.reactiveProcessor.processText(btn.props.children)
      result.okTextIsExpr = okTextIsExpr
      result.okText = okText
    }
    return result
  }

  private extractRootElements(rootComponent: JSX.Element) {
    if (typeof rootComponent.type !== 'function') {
      throw new Error('需要根组件')
    }
    const rootElement = rootComponent.type(rootComponent.props) as JSX.Element
    if (rootElement.type !== 'root') {
      throw new Error('需要根元素')
    }
    const children: JSX.Element[] = Array.isArray(rootElement.props.children)
      ? rootElement.props.children
      : [rootElement.props.children]
    let header: JSX.Element | null = null
    let main: JSX.Element | null = null
    let footer: JSX.Element | null = null
    for (const child of children) {
      if (!child || typeof child !== "object" || !("type" in child)) continue
      switch (child.type) {
        case "header":
          header = child as JSX.Element
          break
        case "main":
          main = child as JSX.Element
          break
        case "footer":
          footer = child as JSX.Element
          break
      }
    }
    if (main === null) throw new Error('main 元素是必须的')
    main = {
      type: (x: JSX.Element['props']) => x.children,
      props: { children: [main.props.children].flat() }
    }
    return [header, main, footer] as const
  }

  registerConverter(...converters: ElementConverter[]) {
    for (const converter of converters) {
      this.converter.set(converter.type, converter)
    }
  }

  /**
   * 处理元素
   * @param elem 
   * @param session 
   * @returns 
   */
  processElement(elem: JSX.Element | string, session: RenderSession): Variable[] | Variable {
    // 当元素为字符串,说明是文本节点,包装为文本元素再处理
    if (typeof elem === 'string') {
      elem = { type: 'text', props: { children: elem } }
    }
    if (typeOf(elem) !== 'Object' || !elem.type) {
      console.error({ elem })
      throw new Error(`值不合法`)
    }

    session.elementStack.push(elem)

    try {
      if (typeof elem.type === 'function') {
        return this.handleComponent(elem, session)
      }
      const processor = this.converter.get(elem.type as string)
      if (!processor) {
        throw new Error(`该类型未实现: ${elem.type}`)
      }
      return processor.convertToVariable(elem, session)
    } finally {
      session.elementStack.pop()
    }
  }

  /**
   * 渲染对话框
   * @param rootComponent 根组件
   * @param options 选项
   * @param options.storageId 存储ID,用于记忆输入值,该ID在脚本范围内不可相同。如果该参数不提供的同时仍然开启记忆,不仅无效还会浪费存储空间
   * @param options.hooks 钩子,用于在对话框创建时执行一些操作
   * @returns 对话框对象
   */
  render(rootComponent: JSX.Element, options: { storageId?: string, hooks?: RendererHooks } = {}) {
    const session = this.createRenderSession()
    const { storageId, hooks } = this.prepareRenderOptions(rootComponent, options)

    session.context.saveHooks(hooks)
    const { viewId, eventEmitId } = this.setupSessionIds(storageId)
    this.setupCleanupPlan(session, viewId, eventEmitId)

    const [headerElement, mainElement, footerElement] = this.extractRootElements(rootComponent)
    const { header, main, footer } = this.processRootElements(headerElement, mainElement, footerElement, session)

    const eventEmitter = session.context.createValueChangeEmitter()
    const { expr: eventListenerFunc } = session.reactiveProcessor.hoistFunc(eventEmitter)

    const vars = this.createVars(viewId, eventEmitId, main, eventListenerFunc)
    const action = this.createAction(vars, header, footer)

    return {
      action,
      vars: main,
      show: () => this.showDialog(action, session, viewId)
    }
  }

  private prepareRenderOptions(rootComponent: JSX.Element, options: { storageId?: string, hooks?: RendererHooks }) {
    return {
      storageId: options.storageId ?? (typeof rootComponent.type === 'function' ? rootComponent.type.name : generateUniqueId()),
      hooks: options.hooks ?? {}
    }
  }

  private setupSessionIds(storageId: string) {
    const viewId = `view$${storageId}`
    const eventEmitId = `eventEmit$${generateUniqueId()}`
    return { viewId, eventEmitId }
  }

  private setupCleanupPlan(session: RenderSession, viewId: string, eventEmitId: string) {
    session.context.addCleanupFunction(() => {
      sleep(50).then(() => {
        if (typeof zdjl === 'undefined') return
        zdjl.clearVars(session.context.SCOPE.method)
        zdjl.clearVars(session.context.SCOPE.signal)
        zdjl.deleteVar(viewId)
        zdjl.deleteVar(eventEmitId)
      })
    })
  }

  private processRootElements(headerElement: JSX.Element | null, mainElement: JSX.Element, footerElement: JSX.Element | null, session: RenderSession) {
    const header = headerElement
      ? this.processHeaderElement(headerElement, session)
      : { isExpr: false, title: new Markdown().add(Markdown.space()).end() }
    const main = [this.processElement(mainElement, session)].flat()
    const footer = footerElement ? this.processFooterElement(footerElement, session) : {}
    return { header, main, footer }
  }

  private createVars(viewId: string, eventEmitId: string, main: Variable[], eventListenerFunc: string) {
    return [
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
  }

  private createAction(vars: any[], header: any, footer: any) {
    return switchToVarModeForAction(
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
  }

  private async showDialog(action: any, session: RenderSession, viewId: string) {
    if (typeof zdjl === 'undefined') {
      throw new Error('未处于目标环境,无法使用API: zdjl.runActionAsync')
    }

    await zdjl.runActionAsync(action)
    const signal = zdjl.getVars(session.context.SCOPE.signal)
    const raw = zdjl.getVar(viewId)

    const input = this.processInput(raw, session)
    session.context.cleanup()
    return { raw, input, signal }
  }

  private processInput(raw: Record<string, any>, session: RenderSession) {
    const input: Record<string, any> = {}
    const reservedNames = session.context.getReservedVariableNames()
    if (reservedNames.size) {
      deepTraverse(raw, (key, value) => {
        if (!key.startsWith('var$')) return
        const reservedName = reservedNames.get(key)
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

export interface HookFunction<T = any, U = any> {
  (value: T, context: PropertyAdapterContext): U
}
export interface PropertyAdapterContext {
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
  condition?(context: PropertyAdapterContext): boolean
}
export interface AdapterConfig {
  /**映射表:定义属性转换逻辑 */
  mappings: PropertyMapping[]
  /**全局属性预处理器:应用默认值后,执行属性钩子前 */
  preHook?: HookFunction
  /**全局属性后处理器:执行属性钩子后,写入目标对象前 */
  postHook?: HookFunction
  /**本次转换的错误处理逻辑 */
  errorHandler?: (error: Error, context: PropertyAdapterContext) => void // 错误处理器
}
export interface PropertyAdapterInterface {
  /**
   * 执行数据适配转换
   * @param adaptee 源数据对象
   * @param configOverrides 可选的配置,mappings将追加,其他属性覆盖
   * @returns 转换后的目标对象
   */
  adapt(adaptee: Record<string, any>, configOverrides?: Partial<AdapterConfig>): any
}
// 通用适配器 - 将源数据转换为目标数据格式
export class UniversalAdapter implements PropertyAdapterInterface {
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
    const context: PropertyAdapterContext = { sourceObj: adaptee, targetObj: {}, config: this.mergeConfigs(this.globalConfig, configOverrides), targetPath: [], sourcePath: [] }

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
  private processMapping(context: PropertyAdapterContext, mapping: PropertyMapping): void {
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
  private safeExecute<T>(fn: () => T, context: PropertyAdapterContext, fallback: T): T {
    try {
      return fn()
    } catch (error) {
      this.handleError(error as Error, context)
      return fallback
    }
  }
  private applyHooks<T, U>(context: PropertyAdapterContext, source: T, hooks: HookFunction[]): U {
    return hooks.reduce((source, hook) => {
      return this.safeExecute(() => hook(source, context), context, source)
    }, source as any)
  }
  private handleError(error: Error, context: PropertyAdapterContext): void {
    if (context.config.errorHandler) {
      context.config.errorHandler(error, context)
    } else {
      console.error('Adapter error:', error, context)
    }
  }
}

class VariableAdapter {
  constructor(private session: RenderSession, private varname: string) { }

  private processSignal(value: any, adapterContext: PropertyAdapterContext) {
    if (typeof value === 'function') {
      const propertyName = adapterContext.targetPath[adapterContext.targetPath.length - 1]
      if (propertyName) {
        this.session.context.addReactiveProperty(propertyName)
      }
      return this.session.reactiveProcessor.hoistSignal(value).expr
    }
    return value
  }

  private processChangeEvent(onChange: Function) {
    if (typeof onChange === 'function') {
      this.session.context.saveEventListener(onChange, this.varname)
      return true
    }
    return undefined
  }

  public adapt(elem: JSX.Element, mappings: PropertyMapping[]) {
    return UniversalAdapter.getSingleton({
      mappings: [
        // 表单与交互
        { target: 'showInput', defaultValue: true },
        { target: 'mustInput', source: 'required', defaultValue: false },
        { target: 'syncValueOnChange', source: 'onChange', hooks: [this.processChangeEvent.bind(this)] },
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
function createProcessTextHook(session: RenderSession): HookFunction {
  const { context, reactiveProcessor } = session
  return (val: any, adapterContext) => {
    const children = Array.isArray(val) ? val : [val]
    const isVarMode = !!children.find(it => typeof it === 'function')
    const res = children.map((child: string | Function | any, index) => {
      let result = ''
      if (typeof child === 'string') {
        result = isVarMode ? `'${child}'` : child
      }
      else if (typeof child === 'function') {
        const propertyName = adapterContext.targetPath[adapterContext.targetPath.length - 1]
        if (propertyName) {
          context.addReactiveProperty(propertyName)
        }
        result = `${reactiveProcessor.hoistSignal(child).expr}`
      }
      return index === 0 ? result : `+${result}`
    })
    return res.join('')
  }
}

// 元素处理器基类 - 其子类处理不同类型的JSX元素
abstract class ElementConverter {
  public abstract type: string
  public varname: string = ''

  public match(elem: JSX.Element): boolean {
    return elem.type === this.type
  }

  public convertToVariable(elem: JSX.Element, session: RenderSession): Variable {
    const varname = session.context.generateVariableName()
    if (elem.props.name) {
      session.context.reserveVariableName(varname, elem.props.name)
    }

    session.context.pushVariablePath(varname)

    try {
      const adapter = new VariableAdapter(session, varname)
      const props = adapter.adapt(elem, this.getMappings(elem, session))
      return switchToVarMode(
        definedVar(varname, {
          varType: this.getVarType(elem, session),
          ...props,
        }),
        session.context.getReactiveProperties()
      )
    } finally {
      session.context.popVariablePath()
    }
  }

  protected defineMappings(mappings: PropertyMapping<AllVariablePropsKeys>[]) {
    return mappings
  }
  protected abstract getVarType(elem: JSX.Element, session: RenderSession): AllVariableTypes
  protected abstract getMappings(elem: JSX.Element, session: RenderSession): PropertyMapping[]
}

interface UIElementConfig {
  type: string
  varType: AllVariableTypes | ((elem: JSX.Element, session: RenderSession, context: { parent?: JSX.Element, children: JSX.Element[] }) => AllVariableTypes)
  mappings: PropertyMapping[] | ((elem: JSX.Element, session: RenderSession, context: { parent?: JSX.Element, children: JSX.Element[] }) => PropertyMapping[])
}

class ConfigurableElementConverter extends ElementConverter {
  public type: string
  private config: UIElementConfig

  constructor(config: UIElementConfig) {
    super()
    this.config = config
    this.type = config.type
  }

  protected getVarType(elem: JSX.Element, session: RenderSession): AllVariableTypes {
    return typeof this.config.varType === 'function'
      ? this.config.varType(elem, session, {
        parent: session.getParentElement(),
        children: session.getChildElements()
      })
      : this.config.varType
  }

  protected getMappings(elem: JSX.Element, session: RenderSession): PropertyMapping[] {
    const mappings = typeof this.config.mappings === 'function'
      ? this.config.mappings(elem, session, {
        parent: session.getParentElement(),
        children: session.getChildElements()
      })
      : this.config.mappings
    return this.defineMappings(mappings as any)
  }
}

const UI_ELEMENT_CONFIGS: UIElementConfig[] = [
  // Text 元素配置
  {
    type: 'text',
    varType: 'ui_text',
    mappings: (elem, session) => [
      {
        target: 'textContent', source: 'children', hooks: [
          createConditionalHook(
            val => val?.type === 'expr',
            elem => {
              const expr = elem.props.value && typeof elem.props.value === 'string' ? elem.props.value : ''
              session.context.reactiveDerivedProperties.push('textContent')
              return expr
            },
            createProcessTextHook(session),
          ),
        ]
      },
      {
        target: 'textColor', source: 'style.fontColor', hooks: [processColor]
      },
      {
        target: 'textSize', source: 'style.fontSize'
      }
    ]
  },

  // Button 元素配置
  {
    type: 'button',
    varType: 'ui_button',
    mappings: (elem, session) => [
      {
        target: 'buttonText', source: 'children', hooks: [
          createConditionalHook(
            val => val == null,
            val => 'Button',
            createProcessTextHook(session)
          )
        ]
      },
      { target: 'closeDialogOnAction', defaultValue: false },
      {
        target: 'action', source: 'onClick', hooks: [val => {
          const result = createJsAction(typeof val === 'function' ? `${session.reactiveProcessor.hoistFunc(val).expr}(${session.context.dialogContextExpression})` : '')
          return result
        }]
      },
      { target: 'buttonStyle', source: 'style.buttonStyle', hooks: [val => typeof val === 'string' ? val : undefined] },
    ]
  },

  // Input 元素配置
  {
    type: 'input',
    varType: (elem: JSX.Element) => {
      if (elem.props.type === 'number') {
        return 'number'
      }
      return 'string'
    },
    mappings: (elem) => [
      {
        condition: () => elem.props.type === 'text',
        target: 'value', source: 'value'
      },
      {
        condition: () => elem.props.type === 'number',
        target: 'number', source: 'value'
      }
    ]
  },

  // Checkbox 元素配置
  {
    type: 'checkbox',
    varType: 'bool',
    mappings: () => [
      { target: 'value', source: 'checked' }
    ]
  },

  // Container 元素配置
  {
    type: 'container',
    varType: 'object',
    mappings: (elem, session, { children }) => [
      { target: 'syncValueOnChange', defaultValue: false },
      {
        target: 'objectVars', source: 'children', hooks: [() => {
          const vars: Variable[] = []
          for (const child of children) {
            if (child) {
              const res = session.processElement(child, session) as Variable
              vars.push(res)
            }
          }
          return vars
        }]
      }
    ]
  },

  // Expression 元素配置
  {
    type: 'expr',
    varType: 'expression',
    mappings: () => [
      { target: 'valueExp', source: 'value', hooks: [val => typeof val === 'string' ? val : ''] }
    ]
  },

  // File 元素配置
  {
    type: 'file',
    varType: 'file',
    mappings: () => [
      { target: 'filePath', source: 'value', hooks: [val => typeof val === 'string' ? val : ''] }
    ]
  },

  // Select 元素配置
  {
    type: 'select',
    varType: 'string',
    mappings: () => [
      {
        target: 'stringItems', source: 'options', hooks: [val => {
          if (typeof val === 'function') return val
          return Array.isArray(val) && val.length !== 0 ? val : ['']
        }]
      },
      {
        target: 'value', source: 'selected'
      }
    ]
  },

  // Position 元素配置
  {
    type: 'position',
    varType: 'position',
    mappings: () => [
      { target: 'onlyCanChooseLocWhenInput', defaultValue: true }
    ]
  }
]

function createConfigurableConverters(configs: UIElementConfig[]): ConfigurableElementConverter[] {
  return configs.map(config => new ConfigurableElementConverter(config))
}

export const registerBuiltinConverters = (renderer: Renderer) => {
  renderer.registerConverter(...createConfigurableConverters(UI_ELEMENT_CONFIGS))
}

/**
 * 渲染根组件
 * @param rootComponent 
 * @param options 
 * @returns 
 */
export const render = (rootComponent: JSX.Element, options?: { storageId?: string; hooks?: RendererHooks }) => {
  // 重复创建的成本实际微乎其微, 可忽略
  const renderer = new Renderer()
  renderer.registerConverter(...createConfigurableConverters(UI_ELEMENT_CONFIGS))
  return renderer.render(rootComponent, options)
}
