import { writeFileSync, readFileSync, existsSync } from 'fs'
import path from 'path'

const RELOAD_FILE = path.resolve(import.meta.dirname, '.reload-count')
const COLORS = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  dim: '\x1b[2m'
}

function getReloadCount() {
  if (!existsSync(RELOAD_FILE)) {
    return 0
  }
  try {
    return parseInt(readFileSync(RELOAD_FILE, 'utf8') || '0')
  } catch {
    return 0
  }
}

function incrementReloadCount() {
  const count = getReloadCount() + 1
  writeFileSync(RELOAD_FILE, count.toString())
  return count
}

function formatTime() {
  return new Date().toLocaleTimeString()
}

const count = incrementReloadCount()
const time = formatTime()

console.clear()
console.log(`${COLORS.green}✅ 构建完成${COLORS.reset} ${COLORS.dim}#${count}${COLORS.reset} ${COLORS.blue}${time}${COLORS.reset}`)
