import type { PropertyAdapterContext, HookFunction } from "./renderer"

/**条件应用钩子, false分支默认返回原值 */
export const createConditionalHook = (condition: (value: any, context: PropertyAdapterContext) => boolean, trueHook?: HookFunction, falseHook?: HookFunction): HookFunction => {
  return (value, context) => {
    if (condition(value, context)) {
      return trueHook ? trueHook(value, context) : value
    }
    return falseHook ? falseHook(value, context) : value
  }
}

/**筛出对象属性 */
export const createPickHook = (...keys: string[]): HookFunction<object> => {
  return (obj) => {
    if (typeof obj !== 'object' || obj === null) return undefined
    return keys.reduce((acc, key) => {
      // @ts-expect-error
      if (key in obj) acc[key] = obj[key]
      return acc
    }, {} as Record<string, any>)
  }
}

/**对数组每个元素应用钩子 */
export const createMapHook = (hook: HookFunction): HookFunction<any[]> => {
  return (value, context) => {
    return Array.isArray(value) ? value.map(item => hook(item, context)) : value
  }
}

/**将多个钩子组合为流水线 */
export const createPipeHook = (...hooks: HookFunction[]): HookFunction => {
  return (value, context) => {
    return hooks.reduce((acc, hook) => hook(acc, context), value)
  }
}
