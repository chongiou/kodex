import { type SignalGetter } from '@/core'

interface SwitchProps {
  children?: JSX.Element[]
}

interface MatchProps {
  when: () => boolean | SignalGetter<boolean> | any
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
    const isVisible = () => shouldShow() && !hasPreviousMatch()

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



