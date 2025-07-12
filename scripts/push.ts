import { Device } from './device'
import { resolve } from 'path'
import { codeOf, push as pushToRemote } from './onlineEditClient'

// 用法 push.ts <src> to <target>

const src = resolve(process.argv[2])
const target = process.argv[4]
const url = new URL(target)

if (url.protocol === 'http:' || url.protocol === 'https:') {
  await pushToRemote(codeOf(target), { filepath: src })
}
else if (url.protocol === 'adb:') {
  // adb 协议只是工具的内部约定，用来区分不同的传输方式，而不是一个真正存在的标准协议
  const device = new Device(url.host)
  device.push(src, decodeURIComponent(url.pathname))
}
else {
  console.error('推送失败,不支持 http/https/adb 以外的协议')
  process.exit(1)
}
