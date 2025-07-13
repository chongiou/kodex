import { render, createSignal, hoistFunc } from '@/index'

type Todo = {
  title: string
  completed: boolean
  id: number
}

type FilterOption = 'all' | 'completed' | 'uncompleted'

const App = () => {
  const [tip, setTip] = createSignal('输入 Todo 标题')
  const [newTodoText, setNewTodoText] = createSignal('')
  const [todos, setTodos] = createSignal<Todo[]>([
    {
      title: '这是第 1 条Todo',
      completed: false,
      id: 0
    },
    {
      title: '这是第 2 条Todo',
      completed: true,
      id: 1
    }
  ],
    {
      name: 'todos'
    }
  )

  const [filter, setFilter] = createSignal<FilterOption>('all')
  const filterOptions = ['all', 'completed', 'uncompleted'] as const

  const handleAddTodo = () => {
    if (newTodoText().replace(/\s/g, '') !== '') {
      setTodos(list => {
        return list.concat({ title: newTodoText(), completed: false, id: list.length })
      })
      setNewTodoText('')
    } else {
      const prev = tip()
      setTip('请使用正确的值')
      setTimeout(() => setTip(prev), 456)
    }
  }

  const filteredTodos = () => {
    const todosValue = todos()
    const filterValue = filter()

    return todosValue.filter(item => {
      if (filterValue === 'completed') return item.completed
      if (filterValue === 'uncompleted') return !item.completed
      return true
    })
  }

  const renderedMarkdown = () => {
    const res = filteredTodos()
      .map(item => {
        const exprForUpdater = hoistFunc(() => {
          setTodos(list => {
            list[item.id].completed = !list[item.id].completed
            return list.concat()
          })
        })
        return `- [${item.completed ? 'x' : ' '}] [${item.title}](javascript:${exprForUpdater}())`
      })
    return `#MD\n${res.join('\n')}`
  }

  return (
    <>
      <input
        type='text'
        value={newTodoText}
        onChange={e => { setNewTodoText(e.newValue as string) }}
        extraTextAbove={tip}
      >
      </input>
      <button onClick={handleAddTodo}>Add Todo</button>
      <select options={filterOptions} onChange={e => { setFilter(e.newValue as FilterOption) }}></select>
      <text>{renderedMarkdown}</text>
    </>
  )
}

const dialog = render(<App />)

if (typeof zdjl !== 'undefined') {
  const res = await dialog.show()
  console.log(res.signals.todos)
} else {
  console.dir(dialog.vars, { depth: null })
}


