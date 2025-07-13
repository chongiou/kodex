import fs from 'fs'

export class FileWatcher {
  lastModified: Date | null = null
  timer: NodeJS.Timeout | null = null
  private callback!: (filePath: string, stats: fs.Stats) => void
  constructor(private filePath: string, private interval = 1000) { }

  start(callback: (filePath: string, stats: fs.Stats) => void) {
    this.callback = callback
    this.check()
    this.timer = setInterval(() => this.check(), this.interval)
  }

  stop() {
    // 在 nodejs 中 timer 是对象, 但在自动精灵环境中是数字, 并且是从 0 开始的...
    if (this.timer != null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  check() {
    fs.stat(this.filePath, (err, stats) => {
      if (err) return

      if (this.lastModified && stats.mtime > this.lastModified) {
        this.callback(this.filePath, stats)
      }
      this.lastModified = stats.mtime
    })
  }
}
