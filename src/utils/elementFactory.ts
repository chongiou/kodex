const JudgeIncorrectUsageError = (value: unknown) => { if (typeof value !== 'string') throw new Error('Incorrect usage') }

const createNodeProxy = (node: Record<string | symbol, any>) => {
  return new Proxy(node, {
    get(target, propName) {
      JudgeIncorrectUsageError(propName)
      if (propName === 'build') {
        return () => (delete target[Symbol.for('kodex.chain')], target)
      }
      return (propValue: unknown) => {
        target.props[propName] = propValue
        return new Proxy(target, this)
      }
    }
  })
}

export const elementFactory = new Proxy({}, {
  get(_, tag) {
    JudgeIncorrectUsageError(tag)
    // 返回工厂函数
    return (children: unknown) => {
      const node = {
        type: tag,
        props: {
          children: Array.isArray(children) ? children.flat(Infinity) : [children]
        } as Record<string, any>,
        [Symbol.for('kodex.chain')]: true
      }

      // 装饰为链式调用
      return createNodeProxy(node)
    }
  }
}) as Record<string, any>
