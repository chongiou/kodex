import type { SignalGetter } from '@/core'
import type { DialogContext } from '@/core'
import type { CommonProps } from '@/core/target-env'

type Text = string | SignalGetter | Function

declare global {
  namespace JSX {
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
        type: 'text' | 'number' | 'file'
        value?: Text | number
      }
      text: {
        children?: Text | Text[] | Element/**expr */
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
    export interface Element {
      type: keyof IntrinsicElements | Function
      props:
      & IntrinsicElements[keyof IntrinsicElements]
      & CommonProps
      & { [x: string]: any, children?: any }
    }
  }
}

type JSXNode = JSX.Element | string | number | boolean | null | undefined

function jsx<T extends keyof JSX.IntrinsicElements | Function>(
  type: T,
  props: JSX.IntrinsicElements[T extends keyof JSX.IntrinsicElements ? T : any] & { children?: any }
) {
  if (props.children && Array.isArray(props.children)) {
    props.children = props.children.flat(Infinity) as JSXNode[]
  }
  return { type, props } as JSX.Element
}

const Fragment = (props: any) => props.children

export { jsx, jsx as jsxs, Fragment }
export * from '@/core'
