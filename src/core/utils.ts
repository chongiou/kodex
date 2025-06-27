import { sleep } from '@/utils'
import { SignalGetter, SignalSetter } from '@/core/reactive'

const one_pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAAtJREFUGFdjYAACAAAFAAGq1chRAAAAAElFTkSuQmCC"
export const space = (width: number = 1, height: number = 1) => {
  return `#MD<img width="${width}" height="${height}" src="data:image/png;base64,${one_pixel}"/>`
}

/** 目标环境补丁, 用于设置 select 元素的 selected 值, 需要为 option 元素使用信号值 */
export const optionsDecorator = <T extends any[] = any[]>([optionsGetter, optionsSetter]: [SignalGetter<T>, SignalSetter<T>]) => {
  // NOTE：当只剩下一个选项时，目标环境自动选中该选项，然后在 100ms 后恢复原来的选项(太快无效，原因未知)，完成选中指定值
  const setSelected = async (selected: T[number]) => {
    const cache = optionsGetter()
    optionsSetter([selected] as T[number])
    await sleep(100).then(() => optionsSetter(cache))
  }
  return [
    optionsGetter,
    optionsSetter,
    setSelected,
  ] as const
}
