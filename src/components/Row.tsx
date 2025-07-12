import type { CommonProps } from "@/core/target-env"

export interface RowProps {
  /**
   * ```
   * 'center': 元素互相贴贴, 居中
   * 'space-around': 元素互不贴贴, 均匀分布
   * 'space-between': 左右元素贴边, 均匀分布
   * ```
   */
  justify: 'center' | 'space-around' | 'space-between'
  children: JSX.Element[]
}

/**布局组件 */
export const Row = (props: RowProps) => {
  const len = props.children.length - 1
  props.children.forEach((elem, index) => {
    elem.props.style ??= {}
    let style: CommonProps['style'] = { ...elem.props.style, align: 'left', widthMode: 'auto', growRatio: 1 } // 默认设置

    switch (props.justify) {
      case 'center':
        // 第一个元素居右且 growRatio 为 1, 除了最后一个元素继承默认设置外, 其他元素居左且 growRatio 为 0
        if (index === 0) {
          style = { ...style, align: 'right' }
        } else if (index !== len) {
          style = { ...style, growRatio: 0 }
        }
        break
      case 'space-around':
        // 所有元素居中且 growRatio 为 1
        style = { ...style, align: 'center' }
        break
      case 'space-between':
        // 最后一个元素居右且 growRatio 为 1 , 除了第一个继承默认设置外, 其他元素居中且 growRatio 为 2
        if (index === len) {
          style = { ...style, align: 'right' }
        } else if (index !== 0) {
          style = { ...style, align: 'center', growRatio: 2 }
        }
        break
    }

    elem.props.style = style
  })

  return <>{props.children}</>
}



