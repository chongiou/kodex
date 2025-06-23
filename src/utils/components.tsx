import { type SignalGetter } from '@/core'

interface SwitchProps {
  children?: JSX.Element[]
}

interface MatchProps {
  when: () => boolean | SignalGetter<boolean> | any
  children?: JSX.Element | JSX.Element[]
}

interface ShowProps {
  when: () => boolean | SignalGetter<boolean> | any
  fallback?: JSX.Element | JSX.Element[]
  children?: JSX.Element | JSX.Element[]
}

/**
 * Switch组件 - 配合Match组件使用, 实现条件渲染
 * @remark 只渲染第一个匹配条件的Match组件, 如果都没有匹配, 则什么都不渲染
 */
export const Switch = (props: SwitchProps) => {
  if (!props.children) {
    return <></>
  }

  const matches = (Array.isArray(props.children) ? props.children : [props.children]) as { type: typeof Match, props: MatchProps }[]

  const result = matches.map((match, index) => {
    const shouldShow = match.props.when

    // 检查是否有前面的匹配项已经满足条件
    const hasPreviousMatch = () => {
      for (let i = 0; i < index; i++) {
        if (matches[i].props.when()) {
          return true
        }
      }
      return false
    }

    // 只有当前条件满足且前面没有匹配项时才显示
    const isVisible = () => shouldShow() && !hasPreviousMatch() // TODO: 需要测试一下 这个(检查是否应该显示)函数 是否有响应性
    // 不过 match.props.when 应该是响应式数据源

    if (!match.props.children) {
      return []
    }

    // 默认 children 为 JSX 元素
    const children = Array.isArray(match.props.children) ? match.props.children : [match.props.children]

    // 在每个 child 内插入 hidden 属性
    return children.map(child => {
      return { ...child, props: { ...child.props, hidden: () => !isVisible() } }
    })
  })

  return <>{result.flat()}</>
}

/**
 * Match组件 - 配合Switch使用
 */
export const Match = (props: MatchProps) => {
  return { type: typeof Match, props }
}


/**
 * Show组件 - 简单的条件渲染组件, 如果条件为真, 则渲染 children, 否则渲染 fallback 内容
 */
export function Show(props: ShowProps): JSX.Element {
  if (!props.children) {
    return <></>
  }

  const children = Array.isArray(props.children) ? props.children : [props.children]
  const fallback = props.fallback ? (Array.isArray(props.fallback) ? props.fallback : [props.fallback]) : []

  const result: JSX.Element[] = []

  // 添加主要内容，根据条件显示/隐藏
  children.forEach(child => {
    result.push({ ...child, props: { ...child.props, hidden: () => !props.when() } })
  })

  // 添加fallback内容，条件相反
  fallback.forEach(child => {
    result.push({ ...child, props: { ...child.props, hidden: () => props.when() } })
  })

  return <>{result}</>
}
