import { registerBuiltinProcessors, render, Renderer } from "@/core"
import { createSignal } from "@/core/reactive"
import { dir } from "@/utils"

declare const zdjl: any
const RootComponent = () => {
  const [count, setCount] = createSignal(0)
  return (
    <root>
      <header>Title</header>
      <main>
        <text>{count}</text>
        <button onClick={() => setCount(count() + 1)}>Count + 1</button>
      </main>
      <footer>
        <button onClick={() => zdjl.toast('已取消')}>取消</button>
      </footer>
    </root>
  )
}
const RootComponent2 = () => {
  const [count, setCount] = createSignal(0)
  return (
    <root>
      <header>Title2</header>
      <main>
        <text>{count}</text>
        <button onClick={() => setCount(count() + 1)}>Count + 1</button>
      </main>
      <footer>
        <button onClick={() => zdjl.toast('已取消')}>取消</button>
      </footer>
    </root>
  )
}


if (typeof zdjl !== 'undefined') {
  const renderer = new Renderer()
  registerBuiltinProcessors(renderer)
  console.time('render')
  const component = renderer.render(<RootComponent />)
  console.timeEnd('render')

  console.time('render2')
  const component2 = renderer.render(<RootComponent2 />)
  console.timeEnd('render2')

  console.time('show')
  component.show()
  component2.show()
  console.timeEnd('show')
} else {
  const dialog = render(<RootComponent />)
  dir(dialog.vars)
}
