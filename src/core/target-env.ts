import { SignalGetter } from "@/core/reactive"
import { ChangeContext } from "@/core/renderer"

interface Action {
  type: string,
  [x: string]: any
}

export interface Variable<T extends AllVariableTypes = AllVariableTypes> {
  name: string,
  value: VariableValue<T>
}

// Target 接口 // 假设所有属性支持表达式
export interface VariableCommonProps {
  /** 启用输入 */ showInput?: boolean, // Adaptee 无此属性,转换时始终赋值true
  /** 作用域 */ varScope?: 'script' | 'global', // Adaptee 无此属性,可空(保留适配器的扩展性,以便后来可能对该属性转换)
  /** 描述 */ varDesc?: string,
  /** 必填 */ mustInput?: boolean,
  /** 标签 */ showInputLabel?: string,
  /** 额外文本上 */ textLineBefore?: string,
  /** 额外文本下 */ textLineAfter?: string,
  /** 额外文本右 */ textAppendRight?: string,
  /** 记住值 */ rememberInputValue?: boolean,
  /** 更改时同步值 */ syncValueOnChange?: boolean, // Adaptee 无此属性,应根据onChange存在并处理后赋值true
  /** 对齐 */ showInputContentAlign?: "center" | 'left' | 'right',
  /** 宽度 */ showInputWidthBasis?: "auto" | `${number}0%` | `${number}5%`,
  /** 该元素获得当前行剩余空间的比例 */ showInputWidthGrow?: number,
  /** 背景颜色 */ backgroundColor?: `#${string}`,
  /** 隐藏描述 */ showInputHiddenDesc?: boolean,
  /** 隐藏标签 */ showInputHiddenLabel?: boolean,
  /** 隐藏视图 */ showInputHiddenView?: boolean,
  /** 背景图 data is b64 */ backgroundImageData?: { data: string }
}

// Adaptee 接口
export interface CommonProps {
  // 表单和交互
  /** 
   * 保留变量值所使用的名称  
   * @remark 当多个属性设置了同一个`name`，那么在结果中将表示为数组  
   * @remark 隐藏视图的变量无法保留，这是自动精灵的机制决定的  
   * */
  name?: string
  /**
   * 全称 `Memoization`，即记忆化，该选项等同于"记住值"  
   * @remark 在某些时候记忆的值会丢失: 1. UI结构发生变化(多在开发阶段) 2. 脚本文件名发生变化
   * */
  memo?: boolean
  /** 值更改事件 */ onChange?(ctx: ChangeContext): void
  /** 是否必填 */ required?: boolean | SignalGetter<boolean> | Function

  // 文本与内容
  /** 描述 */ description?: string | SignalGetter<string> | Function
  /** 标签 */ label?: string | SignalGetter<string> | Function
  /** 元素上方的附加文本 */ extraTextAbove?: string | SignalGetter<string> | Function
  /** 元素下方的附加文本 */ extraTextBelow?: string | SignalGetter<string> | Function
  /** 元素右侧的附加文本 */ extraTextRight?: string | SignalGetter<string> | Function

  // 样式
  style?: {
    /** 在行内的对齐方式 */ align?: 'center' | 'left' | 'right' | SignalGetter<'center' | 'left' | 'right'> | Function
    /** 宽度 */ widthMode?: "auto" | `${number}0%` | `${number}5%` | SignalGetter<"auto" | `${number}0%` | `${number}5%`> | Function
    /** 在行内占据的剩余空间的比例 */ growRatio?: number | SignalGetter | Function
    /** 背景颜色 */ bgColor?: string | SignalGetter<string> | Function
    /** 背景图 b64 */ bgImage?: string | SignalGetter<string> | Function
  }

  // 可见性
  /** 隐藏描述 */ hideDescription?: boolean | SignalGetter<boolean> | Function
  /** 隐藏标签 */ hideLabel?: boolean | SignalGetter<boolean> | Function
  /** 隐藏视图 */ hidden?: boolean | SignalGetter<boolean> | Function
}

// 各种 VarType 的专属属性, 可以直接添加以扩展新类型
export interface VariablePrivateProps {
  ui_text: {
    textContent: string,
    textSize: number,
    /**文本颜色不支持颜色缩写，缩写必闪退！ */
    textColor: string
  }
  ui_button: {
    buttonText: string,
    buttonStyle: "button" | "link" | "none",
    closeDialogOnAction: boolean,
    action: { type: '运行JS代码', jsCode: string }
  }
  position: {
    onlyCanChooseLocWhenInput: boolean,  // Only can choose location when input
  }
  string: {
    stringItems: string[],
    value: string
  }
  number: {
    number: number,
  }
  bool: {
    value: boolean,
  }
  screen_area: {
    screenArea: string,
  }
  expression: {
    valueExp: string
  }
  object: {
    objectVars: Variable[],
    configInNewDialog: boolean,
    configInNewDialogBtnText: string
    configInNewDialogTitle: string
  }
  file: {
    filePath: string,
    inputModeFileSuffix: string, // NOTE: 可为文件后缀(可换行表示多个后缀), 使用"/"可以表示限制目录
  }
}

export type AllVariablePropsKeys = { [K in keyof VariablePrivateProps]: keyof VariablePrivateProps[K] }[keyof VariablePrivateProps] | keyof VariableCommonProps | 'varType' | '__vars'
export type AllVariableTypes = keyof VariablePrivateProps


// 组合公共属性和私有属性
export type VariableValue<T extends AllVariableTypes> =
  & {
    varType: T,
    // 这里假设除 varType, showInput, __vars 以外的所有属性都允许以表达式的形式传入, 但实际可能还存在别的字段
    __vars?: { [x in keyof Omit<VariableValue<T>, 'varType' | 'showInput' | '__vars'>]?: { varType: 'expression', valueExp: string } }
  }
  & VariableCommonProps
  & Partial<VariablePrivateProps[T]>

export const definedVar = <T extends AllVariableTypes>(name: string, value: VariableValue<T>) => {
  return { name, value: value as VariableValue<T> }
}

export const createExpression = (expr: string) => {
  return { varType: "expression", valueExp: expr }
}

export const createJsAction = (code: string) => {
  return { type: '运行JS代码' as const, jsCode: code }
}

const move = (obj: Record<string, any>, prop: string) => {
  const val = obj[prop]
  delete obj[prop]
  return val
}
export const switchToVarMode = <T extends AllVariableTypes>(val: Variable<T>, switchProp?: Array<keyof NonNullable<VariableValue<T>['__vars']>> | string[]) => {
  for (const key of switchProp ?? []) {
    if (!key) continue
    if (!val.value.__vars) val.value.__vars = {}
    // @ts-expect-error
    val.value.__vars[key] =
      createExpression(move(val.value, key as string))
  }
  return val
}

export const switchToVarModeForAction = <T extends Action>(action: T, switchProp: Partial<Record<keyof T, boolean>>) => {
  for (const [key, isEnable] of Object.entries(switchProp)) {
    if (!isEnable) continue
    if (!action.__vars) {
      // @ts-expect-error
      action.__vars = {}
    }

    action.__vars[key] = createExpression(move(action, key as string))
  }
  return action
}
