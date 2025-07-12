import { render } from '@/core'
import { Row } from '../components/Row'

const RowUsage = () => {
  return (
    <>
      <Row justify='space-between'>
        <button style={{bgColor:'#e9967a'}}>1</button>
        <button style={{bgColor:'#deb887'}}>2</button>
        <button style={{bgColor:'#5f9ea0'}}>3</button>
        <button style={{bgColor:'#cd5c5c'}}>4</button>
      </Row>
    </>
  )
}

const dialog = render(<RowUsage />)

if (typeof zdjl !== 'undefined') {
  await dialog.show()
} else {
  console.dir(dialog.vars, { depth: null })
}
