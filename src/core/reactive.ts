import { contextStack, getCurrentRenderContext } from "./renderer"

export interface SignalGetter<T = any> {
  (): T
}
export interface SignalSetter<T = any> {
  (newValue: T | ((prevValue: T) => T)): void
}
interface Dispose {
  (): void
}
interface Effect {
  (): Promise<void> | void
  isActive: boolean
  dependencies: Set<SignalGetter>
  id: number
}
export interface Owner {
  signals: Map<SignalGetter, Set<Effect>>  // 信号 -> 订阅的副作用集合
  effects: Set<Effect>                     // 所有副作用
  mountCallbacks: Array<() => void>
  cleanupCallbacks: Array<() => void>
  isMounted: boolean
  dispose(): void
}
interface ReactiveContext {
  currentEffect: Effect | null
  currentOwner: Owner | null
}
interface ResourceState<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}
interface ResourceAccessor<T> {
  (): T | undefined
  loading: boolean
  error: Error | undefined
}
export const ReactiveContext: ReactiveContext = {
  currentEffect: null,
  currentOwner: null,
}

const batchQueue = new Set<Effect>()
let isBatching = false
let effectIdCounter = 0

/**
 * 执行挂载回调
 */
export function executeMountCallbacks(owner: Owner): void {
  if (!owner.isMounted) {
    owner.isMounted = true
    owner.mountCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('Error in mount callback:', error)
      }
    })
  }
}

/**
 * 注册清理回调
 */
export function onCleanup(callback: () => void): void {
  const owner = ReactiveContext.currentOwner
  if (owner) {
    owner.cleanupCallbacks.push(callback)
  }
}

/**
 * 注册挂载回调
 */
export function onMount(callback: () => void): void {
  const owner = ReactiveContext.currentOwner
  if (owner) {
    if (owner.isMounted) {
      callback()
    } else {
      owner.mountCallbacks.push(callback)
    }
  }
}

// 处理批处理队列, 目标: 合并多次信号更新, 避免多次触发副作用, 提高性能
function processBatch() {
  if (batchQueue.size === 0) {
    isBatching = false
    return
  }
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
  // 如果在执行过程中有新的副作用被添加到队列，继续处理
  if (batchQueue.size > 0) {
    Promise.resolve().then(processBatch)
  } else {
    isBatching = false
  }
}

interface SignalOptions {
  /**
   * 为信号命名, 这样的信号可以在 show 结果中取得其值
   */
  name?: string
}

/**
 * 创建一个响应式数据源（signal），包含一个 getter 和 setter
 */
export function createSignal<T>(initialValue: T, options: SignalOptions = {}): [SignalGetter<T>, SignalSetter<T>] {
  let value = initialValue
  const subscribers = new Set<Effect>()

  const signalGetter: SignalGetter<T> = () => {
    // 依赖收集：当前正在执行的副作用订阅此信号
    if (ReactiveContext.currentEffect) {
      const effect = ReactiveContext.currentEffect
      // TODO: 此处存在循环引用, GC 无法回收, 打破循环手段就是通过所有者清理, 需要优化
      subscribers.add(effect)
      effect.dependencies.add(signalGetter)
    }
    return value
  }

  const signalSetter: SignalSetter<T> = (newValueOrUpdater) => {
    let newValue: T

    if (typeof newValueOrUpdater === 'function') {
      const updater = newValueOrUpdater as (prevValue: T) => T
      newValue = updater(value)
    } else {
      newValue = newValueOrUpdater
    }

    // 值没有改变时不触发更新
    if (Object.is(value, newValue)) {
      return
    }

    value = newValue

    // 将有效副作用添加到处理队列,并清理失效的副作用
    subscribers.forEach((effect) => {
      if (effect.isActive) {
        batchQueue.add(effect)
      }
      else {
        subscribers.delete(effect)
        effect.dependencies.delete(signalGetter)
      }
    })

    if (!isBatching && batchQueue.size > 0) {
      isBatching = true
      Promise.resolve().then(processBatch)
    }
  }

  // 预先注册信号（即使暂时没有订阅者）
  if (ReactiveContext.currentOwner) {
    ReactiveContext.currentOwner.signals.set(signalGetter, subscribers)
  }

  // NOTE: 耦合部分: 注册具名信号到渲染上下文
  if (options.name) {
    if (contextStack.length > 0) {
      const context = getCurrentRenderContext()
      context.signalManager.register(options.name, signalGetter)
    } else {
      console.warn('注册具名信号无效,不在渲染上下文内')
    }
  }

  return [signalGetter, signalSetter]
}

/**
 * 创建一个副作用，其回调函数会自动追踪所依赖的 signal，并在这些 signal 变化时重新运行
 */
export function createEffect(callback: Function): [Dispose, boolean] {
  let isActive = true
  let version = 0
  const effectId = ++effectIdCounter
  const dependencies = new Set<SignalGetter>()
  let hasDependencies = false

  const effect: Effect = Object.assign(
    async () => {
      if (!isActive) return

      const currentVersion = ++version
      const prevEffect = ReactiveContext.currentEffect

      // 清理旧的依赖关系
      dependencies.forEach(signal => {
        const owner = ReactiveContext.currentOwner
        if (owner) {
          const subscribers = owner.signals.get(signal)
          if (subscribers) {
            subscribers.delete(effect)
          }
        }
      })
      dependencies.clear()

      try {
        ReactiveContext.currentEffect = effect
        const result = callback()

        // 直接更新依赖收集状态
        hasDependencies = dependencies.size > 0

        if (result instanceof Promise) {
          const asyncResult = await result
          // 检查版本号，确保异步结果仍然有效
          if (version === currentVersion && isActive) {
            return asyncResult
          }
        }

        return result
      } catch (error) {
        console.error(`Error in effect ${effectId}:`, error)
      } finally {
        ReactiveContext.currentEffect = prevEffect
      }
    },
    {
      isActive,
      dependencies,
      id: effectId
    }
  )

  // 清理函数
  const cleanup: Dispose = () => {
    if (!isActive) return

    isActive = false
    effect.isActive = false

    // 从所有依赖的订阅列表中移除此副作用
    dependencies.forEach(signal => {
      const owner = ReactiveContext.currentOwner
      if (owner) {
        const subscribers = owner.signals.get(signal)
        if (subscribers) {
          subscribers.delete(effect)
        }
      }
    })
    dependencies.clear()

    // 从所有者的副作用集合中移除
    if (ReactiveContext.currentOwner) {
      ReactiveContext.currentOwner.effects.delete(effect)
    }
  }

  // 注册到所有者
  if (ReactiveContext.currentOwner) {
    ReactiveContext.currentOwner.effects.add(effect)
  }

  // 立即执行副作用以建立初始依赖关系
  effect()

  return [cleanup, hasDependencies] as const
}

/**
 * 创建计算属性 - 基于其他信号的派生值, 作用: 缓存计算结果, 避免重复计算
 */
export function createComputed<T>(computation: () => T): SignalGetter<T> {
  let value: T
  let isStale = true
  const [get, set] = createSignal<T>(undefined as any)

  createEffect(() => {
    const newValue = computation()
    if (isStale || !Object.is(value, newValue)) {
      value = newValue
      isStale = false
      set(newValue)
    }
  })

  return () => {
    get() // 触发依赖收集
    return value
  }
}

/**
 * 创建一个所有者上下文，用于管理信号和副作用的生命周期
 */
export function createOwner(): Owner {
  return {
    signals: new Map(),
    effects: new Set(),
    mountCallbacks: [],
    cleanupCallbacks: [],
    isMounted: false,
    dispose() {
      this.cleanupCallbacks.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.error('Error in cleanup callback:', error)
        }
      })
      this.cleanupCallbacks = []
      this.mountCallbacks = []
      this.isMounted = false

      // 清理所有副作用
      this.effects.forEach(effect => {
        effect.isActive = false
        // 从信号的订阅列表中移除
        effect.dependencies.forEach(signal => {
          const subscribers = this.signals.get(signal)
          if (subscribers) {
            subscribers.delete(effect)
          }
        })
        effect.dependencies.clear()
      })
      this.effects.clear()

      // 清理所有信号的订阅关系
      this.signals.clear()
    }
  }
}

/**
 * 在指定所有者上下文中运行函数
 */
export function runWithOwner<T>(owner: Owner, fn: () => T): T {
  const prevOwner = ReactiveContext.currentOwner
  ReactiveContext.currentOwner = owner
  try {
    return fn()
  } finally {
    ReactiveContext.currentOwner = prevOwner
  }
}

/**
 * 取消追踪 - 在副作用回调中使用 untrack 访问信号不会与副作用建立依赖关系
 */
export function untrack<T>(fn: () => T): T {
  const prevEffect = ReactiveContext.currentEffect
  ReactiveContext.currentEffect = null

  try {
    return fn()
  } finally {
    ReactiveContext.currentEffect = prevEffect
  }
}

/**
 * 创建资源 - 用于异步数据获取
 */
export function createResource<T, U = any>(
  source: () => U,
  fetcher: (source: U, info: { value: T | undefined; refetching: boolean }) => Promise<T>
): [ResourceAccessor<T>, { refetch: () => void; mutate: (value: T) => void }] {
  const [state, setState] = createSignal<ResourceState<T>>({
    loading: false,
    data: undefined,
    error: undefined
  })

  let isAborted = false
  let fetchId = 0
  let lastSourceValue: U
  let hasInitialized = false

  const fetch = async (refetching = false) => {
    // 取消之前的请求
    isAborted = true

    const currentFetchId = ++fetchId

    try {
      // 在 untrack 中获取 source 值，避免在 fetch 中建立依赖
      const sourceValue = untrack(() => source())
      const currentState = untrack(() => state())

      setState({
        loading: true,
        data: refetching ? currentState.data : undefined,
        error: undefined
      })

      const result = await fetcher(sourceValue, {
        value: currentState.data,
        refetching
      })

      // 检查请求是否已被取消或被新请求替代
      if (currentFetchId === fetchId && !isAborted) {
        setState({
          loading: false,
          data: result,
          error: undefined
        })
      }
    } catch (error) {
      if (currentFetchId === fetchId && !isAborted) {
        const currentState = untrack(() => state())
        setState({
          loading: false,
          data: currentState.data, // 保持之前的数据
          error: error instanceof Error ? error : new Error(String(error))
        })
      }
    }
  }

  // 监听 source 变化自动重新获取
  createEffect(() => {
    const sourceValue = source()

    // 第一次执行或者 source 值真的变化了才重新获取
    if (!hasInitialized || !Object.is(lastSourceValue, sourceValue)) {
      lastSourceValue = sourceValue
      hasInitialized = true
      fetch()
    }
  })

  const accessor = (() => {
    return state().data
  }) as ResourceAccessor<T>

  // 添加响应式属性
  Object.defineProperty(accessor, 'loading', {
    get: () => state().loading
  })

  Object.defineProperty(accessor, 'error', {
    get: () => state().error
  })

  const refetch = () => fetch(true)
  const mutate = (value: T) => {
    setState({
      loading: false,
      data: value,
      error: undefined
    })
  }

  return [accessor, { refetch, mutate }]
}
