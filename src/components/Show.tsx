import { type SignalGetter } from '@/core'

interface ShowProps {
  when: () => boolean | SignalGetter<boolean> | any
  fallback?: JSX.Element | JSX.Element[]
  children?: JSX.Element | JSX.Element[]
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
