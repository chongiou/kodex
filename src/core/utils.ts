import { sleep } from "@/utils"
import { SignalGetter, SignalSetter } from "./reactive"


const one_pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAAtJREFUGFdjYAACAAAFAAGq1chRAAAAAElFTkSuQmCC"
export class Markdown {
  part: string[]
  constructor() {
    this.part = []
  }
  add(text: string) {
    return this.part.push(text), this
  }
  end(separator?: string) {
    return '#MD' + this.part.join(separator)
  }
  static usePrefix(text: string) {
    return '#MD' + text
  }
  static space(width: number = 1, height: number = 1) {
    return `<img width="${width}" height="${height}" src="data:image/png;base64,${one_pixel}"/>`
  }
  static image(width: number | string = 'auto', height: number | string = 'auto', src: string) {
    return `<img width="${width}" height="${height}" src="${src}"/>`
  }
  static font(text: string, style?: { color?: string, size?: number, align?: 'left' | 'center' | 'right' }) {
    const { color = '#fff', size = 3, align = 'left' } = style ?? {}
    return `<div align="${align}"><font color="${color}" size="${size}">${text}</font></div>`
  }
  static br() {
    return '<br/>'
  }
  static hr() {
    return '<hr/>'
  }
  static title(text: string, level = 1) {
    return `<h${level}>${text}</h${level}>`
  }
}

/** 设置 select 元素的 selected 值, 需要为 select 元素使用信号值 */
export const setSelected = async (ctrl: [SignalGetter, SignalSetter], selectedVal: string) => {
  const [getter, setter] = ctrl
  const cache = getter()
  setter([selectedVal])
  await sleep(100)
  setter(cache)
}
