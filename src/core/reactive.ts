export interface SignalGetter<T = any> {
  (): T,
  dispose: Dispose
}
export interface SignalSetter<T = any> {
  (newValue: T): void,
  dispose: Dispose
}
interface Dispose {
  (): void
}
interface Effect {
  (): Promise<void> | void
  deps: Set<Set<Effect>>; isActive: boolean
}

interface ReactiveContext {
  currentEffect: Effect | null
  currentComponent: Function | null
}

// TODO: 所有者机制
export const ReactiveContext: ReactiveContext = {
  currentEffect: null,
  currentComponent: null, // TODO: 未实现
}

const batchQueue = new Set<Effect>()
let isBatching = false

function processBatch() {
  isBatching = false
  const effects = Array.from(batchQueue)
  batchQueue.clear()
  effects.forEach((effect) => {
    if (effect.isActive) {
      try {
        effect()
      } catch (error) {
        console.error("Error in batched effect:", error)
      }
    }
  })
}

/**
 * 创建一个响应式数据源（signal），包含一个 getter 和 setter
 * @param initialValue 
 * @returns 
 */
export function createSignal<T>(initialValue: T) {
  let value = initialValue
  const subscribers = new Set<Effect>()
  const dispose: Dispose = () => {
    // 清理所有 subscribers 中的 effect.deps 引用
    subscribers.forEach((effect) => {
      effect.deps.delete(subscribers)
    })
    subscribers.clear()
  }

  const signalGetter: SignalGetter<T> = () => {
    if (ReactiveContext.currentEffect) {
      subscribers.add(ReactiveContext.currentEffect)
      ReactiveContext.currentEffect.deps.add(subscribers)
    }
    return value
  }
  signalGetter['dispose'] = dispose

  const signalSetter: SignalSetter<T> = (newValue) => {
    value = newValue
    const toRemove: Effect[] = []
    subscribers.forEach((effect) => {
      if (!effect.isActive) {
        toRemove.push(effect)
        return
      }
      // 将 Effect 加入批处理队列
      batchQueue.add(effect)
    })
    // 清理失效的 Effect
    toRemove.forEach((effect) => {
      subscribers.delete(effect)
      effect.deps.delete(subscribers)
    })
    // 触发批处理
    if (!isBatching) {
      isBatching = true
      Promise.resolve().then(processBatch) // 进入微任务队列
    }
  }
  signalSetter['dispose'] = dispose

  return [signalGetter, signalSetter, dispose, subscribers] as const
}

/**
 * 创建一个副作用，其回调函数会自动追踪所依赖的 signal，并在这些 signal 变化时重新运行。
 * @remark 重要⚠️，每个 Effect 都应该在某个时机被清理，由于与 signal 存在循环引用，它不会被 GC 自动回收
 * @param callback
 * @returns 清理函数
 */
export function createEffect(callback: Function): Function {
  let isActive = true
  let version = 0

  const effect: Effect = Object.assign(
    async () => {
      if (!isActive) return
      const currentVersion = ++version

      try {
        ReactiveContext.currentEffect = effect
        const result = callback()
        if (result instanceof Promise) {
          const asyncResult = await result
          if (version === currentVersion && isActive) {
            return asyncResult
          }
        }
      } catch (error) {
        console.error("Error in effect:", error)
      } finally {
        ReactiveContext.currentEffect = null
      }
    },
    { isActive, deps: new Set<Set<Effect>>() }
  )

  effect()
  return () => {
    isActive = false
    effect.isActive = false // 更新 effect 的状态
    effect.deps.forEach((subscribers: Set<Effect>) => {
      subscribers.delete(effect)
    })
    effect.deps.clear()
  }
}


