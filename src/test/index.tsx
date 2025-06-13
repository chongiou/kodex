import { render } from "@/core"
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
  const component = await render(<RootComponent />)
  const component2 = await render(<RootComponent2 />)
  await component.show()
  await component2.show()
} else {
  const dialog = await render(<RootComponent />)
  dir(dialog.vars)
}
