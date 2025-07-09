import { optionsDecorator } from '@/core/utils'
import { render, createSignal } from '@/index'

const App = () => {
  const [options, _, setSelected] = optionsDecorator(createSignal(['1', '2', '3']))

  return (
    <>
      <select options={options} />
      <button onClick={() => setSelected('2')}>按钮</button>
    </>
  )
}

const dialog = render(<App />)

if (typeof zdjl !== 'undefined') {
  await dialog.show()
} else {
  console.dir(dialog.vars, { depth: null })
}
