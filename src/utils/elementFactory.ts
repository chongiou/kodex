const createNodeProxy = (node: Record<string | symbol, any>) => {
  return new Proxy(node, {
    get(target, propName) {
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

const createFactory = (tag: string | Function) => {
  // 返回工厂函数
  return (...children: unknown[]) => {
    const node = {
      type: tag,
      props: {
        children: children.flat(Infinity)
      } as Record<string, any>,
      [Symbol.for('kodex.chain')]: true
    }

    // 装饰为链式调用
    return createNodeProxy(node)
  }
}

export const elementFactory = new Proxy({}, {
  get(_, tag: string) {
    if (tag === 'useComp') {
      // 收集组件和 children
      return (component: Function, children: any) => {
        return createFactory(component)(children)
      }
    }
    return createFactory(tag)
  }
}) as Record<string, any>
