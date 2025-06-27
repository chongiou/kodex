import '@/types/jsx'

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
