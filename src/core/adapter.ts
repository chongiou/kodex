import { hoistSignal, RenderContext } from './renderer'
import { AllVariablePropsKeys } from './target-env'

interface convertFunction<T = any, U = any> {
  (value: T, context: AdapterContext): U
}
interface AdapterContext {
  sourceObj: Record<string, any> // 原始数据对象
  targetObj: Record<string, any> // 正在构建的目标对象
  targetPath: string[]           // 当前处理的属性路径
  sourcePath: string[]           // 当前处理的源属性路径
  config: AdapterConfig          // 当前使用的配置
}
interface Mapping<T = string, A = string> {
  /**目标路径 */
  target: T
  /**源路径 */
  source?: A
  /**当源值为 undefined 时的默认值 */
  defaultValue?: unknown
  convert?: convertFunction
  condition?(context: AdapterContext): boolean
}
interface AdapterConfig {
  /**映射表:定义属性转换逻辑 */
  mappings: Mapping[]
  /**对每个属性应用的前过滤器:应用默认值后,执行属性转换器前,返回值作为属性转换器的输入值 */
  preFilter?: convertFunction
  /**对每个属性应用的后过滤器:执行属性转换器后,写入目标对象前,返回值作为目标对象的属性值 */
  postFilter?: convertFunction
}

class UniversalAdapter {
  constructor(private readonly baseConfig: AdapterConfig) { }
  public adapt(adaptee: Record<string, any>, configOverrides?: Partial<AdapterConfig>): Record<string, any> {
    const context: AdapterContext = {
      sourceObj: adaptee,
      targetObj: {},
      config: this.mergeConfigs(this.baseConfig, configOverrides),
      targetPath: [],
      sourcePath: []
    }
    for (const propertyMapping of context.config.mappings) {
      this.processMapping(context, propertyMapping)
    }
    return context.targetObj
  }
  private processMapping(context: AdapterContext, mapping: Mapping): void {
    if (typeof mapping.condition === 'function' && !mapping.condition(context)) {
      return
    }
    context.targetPath = mapping.target.split('.')
    context.sourcePath = mapping.source ? mapping.source?.split('.') : []
    let value = this.getTargetValue(context.sourceObj, context.sourcePath)

    value = (value == null && 'defaultValue' in mapping) ? mapping.defaultValue : value
    value = context.config.preFilter?.(value, context) ?? value
    value = typeof mapping.convert === 'function' ? mapping.convert(value, context) : value
    value = context.config.postFilter?.(value, context) ?? value

    if (value !== undefined) {
      this.setTargetValue(context.targetObj, context.targetPath, value)
    }
  }
  private mergeConfigs(base: AdapterConfig, overrides?: Partial<AdapterConfig>): AdapterConfig {
    if (!overrides) return base
    return {
      // NOTE: 此处为合并,而非覆盖,是设计使然
      mappings: [...base.mappings, ...(overrides.mappings ?? [])],
      preFilter: overrides.preFilter ?? base.preFilter,
      postFilter: overrides.postFilter ?? base.postFilter,
    }
  }
  private getTargetValue(obj: Record<string, any>, paths: string[]): unknown {
    if (paths.length === 0) return undefined
    if (paths.length === 1) return obj[paths[0]]
    return paths.reduce((acc, key) => acc?.[key], obj)
  }
  private setTargetValue(obj: Record<string, any>, paths: string[], value: unknown): void {
    if (paths.length === 0) return
    if (paths.length === 1) {
      obj[paths[0]] = value
      return
    }
    for (let i = 0; i < paths.length - 1; i++) {
      const key = paths[i]
      if (!obj[key]) obj[key] = {}
      obj = obj[key]
    }
    obj[paths[paths.length - 1]] = value
  }
}

export const adapt = (
  elem: JSX.Element,
  context: RenderContext,
  mappings?: Mapping<AllVariablePropsKeys>[],
) => {
  const processHiddenLabel = (val: unknown, ctx: AdapterContext) => val != null ? val : !ctx.sourceObj.label
  const processSyncValueOnChange = () => {
    return elem.props.onChange ? context.addEventListener(elem.props.onChange) : undefined
  }
  const processColor = (val: string | undefined) => {
    if (typeof val === 'string' && val.startsWith('#')) {
      return val.length === 4
        ? `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`
        : val.length === 7 ? val : undefined
    }
  }
  const processSignal = (value: any, adapterContext: AdapterContext) => {
    if (typeof value === 'function') {
      return hoistSignal(value, () => {
        const propertyName = adapterContext.targetPath[adapterContext.targetPath.length - 1]
        if (propertyName) {
          context.addReactiveProperty(propertyName)
        }
      })
    }
    return value
  }
  return new UniversalAdapter({
    mappings: [
      // 表单与交互
      { target: 'showInput', defaultValue: true },
      { target: 'mustInput', source: 'required', defaultValue: false },
      { target: 'syncValueOnChange', source: 'onChange', convert: processSyncValueOnChange },
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
      { target: 'backgroundColor', source: 'style.bgColor', convert: processColor },
      { target: 'backgroundImageData.data', source: 'style.bgImage' },
      // 可见性
      { target: 'showInputHiddenDesc', source: 'hideDescription' },
      { target: 'showInputHiddenLabel', source: 'hideLabel', convert: processHiddenLabel },
      { target: 'showInputHiddenView', source: 'hidden' },
    ],
    postFilter(value, context) {
      // 处理响应式数据:
      return ['onChange', 'onClick'].includes(context.sourcePath[0]) ? value : processSignal(value, context)
    }
  })
    .adapt(elem.props, { mappings })
}
