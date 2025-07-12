import axios from 'axios'
import { readFileSync } from 'fs'

export const config = {
  baseURL: 'http://120.77.173.114:8080/zdjl/onlineEdit',
  pushURL: '/setContent',
  pullURL: '/getContent',
}

const onlineEditClient = axios.create({ baseURL: config.baseURL })

onlineEditClient.interceptors.response.use(
  (response) => {
    const data = response.data

    if (data?.suc === false) {
      const error = new Error(data.msg ?? '未知错误')
      ;(error as any).responseBody = response.data
      ;(error as any).config = response.config
      throw error
    }

    return response
  }
)

export function codeOf(onlineEditURL: string) {
  const capture = onlineEditURL.match(/code=([^&]+)/)
  if (capture) {
    return capture[1].trim()
  } else {
    const error = new Error('无法解析 code');
    (error as any).onlineEditURL = onlineEditURL
    throw error
  }
}

// 互斥类型，严格二选一
type Input = { filepath: string, content?: never } | { content: string, filepath?: never }

export interface ResponseSuccessForPush { suc: true, obj: { lastModified: number, size: number } }
export interface ResponseSuccessForPull { suc: true, obj: { content: string } }
export interface ResponseFailure { suc: false, msg: string }

export async function push(code: string, input: Input) {
  // 如果使用 fetch post, 还需要 encodeURIComponent 编码一下 content, 而 axios 会自动完成
  const content = input.content ?? readFileSync(input.filepath).toString()
  return onlineEditClient.post<ResponseSuccessForPush>(
    config.pushURL, { code, content }, { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
  )
}

export async function pull(code: string) {
  return onlineEditClient.get<ResponseSuccessForPull>(
    config.pullURL, { params: { code } }
  )
}
