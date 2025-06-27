export const dir = (val: any, depth?: number) => console.dir(val, { depth })

export function generateUniqueId() {
  const timestamp = Date.now().toString(36)
  const randomNum = Math.random()
  const randomPart = randomNum.toString(36).slice(2, 8)
  return timestamp + '_' + randomPart
}

export const typeOf = (val: any) => {
  const type = Object.prototype.toString.call(val).slice(8, -1)
  if (type === 'Function' && val.toString().startsWith('class')) {
    return 'Class'
  }
  if (type === 'Number' && Number.isNaN(val)) {
    return 'Nan'
  }
  if (type === 'Number' && !Number.isFinite(val)) {
    return 'Infinity'
  }
  return type as string
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const deepEqual = (a: any, b: any): a is typeof b => {
  // 基本类型直接比较
  if (a === b) return true

  // 处理null和undefined
  if (a == null || b == null) return a === b

  // 处理日期对象
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()

  // 处理数组
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  // 处理对象
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)

    if (aKeys.length !== bKeys.length) return false

    for (const key of aKeys) {
      if (!bKeys.includes(key) || !deepEqual(a[key], b[key])) {
        return false
      }
    }
    return true
  }

  // 其他情况不相等
  return false
}

type Dict<T = any> = { [x: string]: T }

export const compareDictWithPath = <T extends Dict, K extends Dict>(
  oldObj: T,
  newObj: K,
  parentPath: string = ''
): { path: string; oldValue: unknown; newValue: unknown }[] => {
  const changes: { path: string; oldValue: unknown; newValue: unknown }[] = []

  // 获取所有唯一属性名
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

  for (const key of allKeys) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key
    const oldValue = oldObj[key]
    const newValue = newObj[key]

    if (typeof oldValue === 'object' && oldValue !== null &&
      typeof newValue === 'object' && newValue !== null) {
      // 如果都是对象，递归比较
      const nestedChanges = compareDictWithPath(oldValue, newValue, currentPath)
      changes.push(...nestedChanges)
    } else if (!deepEqual(oldValue, newValue)) {
      // 基本类型或不相等时直接记录
      changes.push({
        path: currentPath,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null
      })
    }
  }

  return changes
}

/**
 * 创建防抖函数
 * @param fn 要防抖的函数
 * @param delay 防抖延迟时间（毫秒）
 * @param immediate 是否立即执行
 * @returns 防抖后的函数
 */
export function createDebounce(fn: Function, delay: number, immediate = false) {
  let timer: NodeJS.Timeout | null = null

  return function (this: any, ...args: unknown[]) {
    const context = this

    // 清除之前的定时器
    if (timer) {
      clearTimeout(timer)
    }

    // 立即执行模式
    if (immediate && !timer) {
      fn.apply(context, args)
    }

    // 设置新的定时器
    timer = setTimeout(() => {
      timer = null

      // 非立即执行模式
      if (!immediate) {
        fn.apply(context, args)
      }
    }, delay)
  }
}

export enum COLORS {
  GREEN = '\x1b[32m',
  CYAN = '\x1b[36m',
  YELLOW = '\x1b[33m',
  RED = '\x1b[31m',
  BOLD_RED = '\x1b[31m\x1b[1m',
  RESET = '\x1b[0m',
}

/**
 * 深度遍历对象
 */
export function deepTraverse(obj: Record<string, any>, callback: (key: string, value: unknown, path: string[]) => void, path: string[] = []) {
  if (obj == null) return

  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = [...path, key]

    callback(key, value, currentPath)

    // 如果值是对象或数组，则递归遍历
    if (typeof value === 'object' && value !== null) {
      deepTraverse(value, callback, currentPath)
    }
  })
}
