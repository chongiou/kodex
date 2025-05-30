import type { SignalGetter } from "./core/reactive"
import type { DialogContext } from "./core/renderer"
import type { CommonProps } from "./core/target-env"

type Text = string | SignalGetter | Function

export declare namespace Runtime {
  export interface RawIntrinsicElements {
    [x: string]: any
    button: {
      children?: Text | Text[]
      onClick?(ctx: DialogContext): void
      style?: {
        buttonStyle?: 'button' | 'link' | 'none'
      }
    }
    checkbox: {
      checked?: boolean | SignalGetter<boolean> | Function
    }
    container: {
      children?: Element | Element[],
      onChange?: never
    }
    expr: {
      value?: string
      children?: never
    },
    input: {
      type: 'text' | 'number'
      value?: Text | number
    }
    text: {
      children?: Text | Text[] | Element<'expr'>
      style?: {
        fontColor?: string
        fontSize?: number
      }
    }
    file: {}
    select: {
      options?: any[] | SignalGetter<any[]>
      selected?: any | SignalGetter
    }
    position: {}
  }
  export type IntrinsicElements = {
    [K in keyof RawIntrinsicElements]: RawIntrinsicElements[K] & CommonProps & {
      onChange?(newValue: any): void
    }
  }
  export interface Element<T extends keyof IntrinsicElements = keyof IntrinsicElements> {
    type: T | Function
    props:
    & IntrinsicElements[T]
    & CommonProps
    & { [x: string]: any, children?: any }
  }
}

type JSXNode = Runtime.Element | string | number | boolean | null | undefined

function jsx(
  type: keyof Runtime.IntrinsicElements | Function,
  props: { [x: string]: any, children: any }
): Runtime.Element {
  if (props.children && Array.isArray(props.children)) {
    props.children = props.children.flat(Infinity) as JSXNode[]
  }
  return { type, props }
}
const jsxs = jsx
const Fragment = (props: any) => props.children

export { jsx, jsxs, Fragment }
export { render } from './core/index'
export * from './core/reactive'
