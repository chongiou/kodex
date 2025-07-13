import type { SignalGetter } from '@/core'
import type { CommonProps } from '@/core/target-env'

type Text = string | SignalGetter | Function

declare global {
  namespace JSX {
    export interface RawIntrinsicElements {
      [x: string]: any
      button: {
        children?: Text | Text[]
        onClick?(): void
        style?: {
          buttonStyle?: 'button' | 'link' | 'none'
        }
        closeDialog?: boolean
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
        options?: any[] | readonly any[] | SignalGetter<any[]>
        selected?: any | SignalGetter
      }
      position: {}
      fragment: {
        children?: Element | Element[]
      }
    }
    export type IntrinsicElements = {
      [K in keyof RawIntrinsicElements]: RawIntrinsicElements[K] & CommonProps
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
