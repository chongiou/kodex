import { getCurrentRenderContext, onCleanup } from "@/core"
import { FileWatcher } from "./FileWatcher"

export const reloadHelper = (filename: string, remote?: boolean, interval: number = 500) => {
  const filepath = remote ? `/sdcard/自动精灵/.config/UnsaveEditing_${filename}`: `/sdcard/自动精灵/${filename}`
  const watcher = new FileWatcher(filepath, interval)
  watcher.start(() => {
    watcher.stop()
    getCurrentRenderContext().closeDialog()
    zdjl.runActionAsync({
      type: "执行脚本",
      continueCurrentAfterFinish: false,
      filePath: filename
    })
  })
  onCleanup(() => {
    watcher.stop()
  })
}
