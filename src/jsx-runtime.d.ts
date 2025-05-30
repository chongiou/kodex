import { Runtime } from "."

declare global {
  namespace JSX {
    type RawIntrinsicElements = Runtime.RawIntrinsicElements
    type IntrinsicElements = Runtime.IntrinsicElements
    type Element<T extends keyof Runtime.IntrinsicElements = keyof Runtime.IntrinsicElements> = Runtime.Element<T>
  }
  const zdjl: any
}
