#!/usr/bin/env node

import { existsSync, readFileSync, appendFileSync } from 'fs'

/**
 * 从 CHANGELOG.md 中提取指定版本的发布说明
 * @param {string} version - 版本号（不带 v 前缀）
 * @param {string} changelogPath - changelog 文件路径
 * @returns {string} 提取的发布说明
 */
function extractReleaseNotes(version, changelogPath = 'CHANGELOG.md') {
  try {
    if (!existsSync(changelogPath)) {
      console.error(`错误: 找不到文件 ${changelogPath}`)
      process.exit(1)
    }

    const content = readFileSync(changelogPath, 'utf8')
    console.log(`正在从 ${changelogPath} 中提取版本 ${version} 的发布说明...`)

    // 分割成行
    const lines = content.split('\n')

    // 查找版本标题模式
    const versionPatterns = [
      new RegExp(`^#### \\[?v${version}\\]?`, 'i'),   // #### [v1.1.0] 或 #### 1.1.0
    ]

    let startIndex = -1

    // 查找版本标题
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      for (const pattern of versionPatterns) {
        if (pattern.test(line)) {
          startIndex = i
          console.log(`找到版本标题: "${line}" (行 ${i + 1})`)
          break
        }
      }
      if (startIndex !== -1) break
    }

    if (startIndex === -1) {
      console.warn(`警告: 未找到版本 ${version} 的更改日志`)
      return generateDefaultReleaseNotes(version)
    }

    // 查找下一个版本标题（作为结束标记）
    let endIndex = lines.length
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      // 检查是否是标题行（以 ## 或 ### 开头）
      if (/^#{2,3}\s/.test(line)) {
        endIndex = i
        console.log(`找到下一个版本标题: "${line}" (行 ${i + 1})`)
        break
      }
    }

    // 提取内容（跳过标题行）
    const releaseLines = lines.slice(startIndex + 1, endIndex)

    // 移除开头和结尾的空行
    let start = 0
    let end = releaseLines.length - 1

    while (start < releaseLines.length && releaseLines[start].trim() === '') {
      start++
    }

    while (end >= 0 && releaseLines[end].trim() === '') {
      end--
    }

    const releaseNotes = releaseLines.slice(start, end + 1).join('\n')

    if (releaseNotes.trim() === '') {
      console.warn(`警告: 版本 ${version} 的更改日志为空`)
      return generateDefaultReleaseNotes(version)
    }

    console.log(`成功提取 ${releaseNotes.split('\n').length} 行发布说明`)
    return releaseNotes

  } catch (error) {
    console.error('提取发布说明时发生错误:', error.message)
    process.exit(1)
  }
}

/**
 * 生成默认的发布说明
 * @param {string} version - 版本号
 * @returns {string} 默认发布说明
 */
function generateDefaultReleaseNotes(version) {
  return `Release v${version}\n\n查看更改日志: [CHANGELOG.md](./CHANGELOG.md)`
}

/**
 * 将发布说明写入 GitHub Actions 输出
 * @param {string} releaseNotes - 发布说明内容
 */
function writeToGitHubOutput(releaseNotes) {
  const outputFile = process.env.GITHUB_OUTPUT
  if (!outputFile) {
    console.log('不在 GitHub Actions 环境中，输出发布说明到控制台:')
    console.log('='.repeat(50))
    console.log(releaseNotes)
    console.log('='.repeat(50))
    return
  }

  try {
    const output = `release_notes<<EOF\n${releaseNotes}\nEOF\n`
    appendFileSync(outputFile, output)
    console.log('发布说明已写入 GitHub Actions 输出')
  } catch (error) {
    console.error('写入 GitHub Actions 输出时发生错误:', error.message)
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
用法: node extract-release-notes.js <version> [changelog-path]

参数:
  version        版本号（不带 v 前缀），例如: 1.1.0
  changelog-path 可选，changelog 文件路径，默认为 CHANGELOG.md

示例:
  node extract-release-notes.js 1.1.0
  node extract-release-notes.js 1.1.0 ./docs/CHANGELOG.md

环境变量:
  GITHUB_OUTPUT  GitHub Actions 输出文件路径（自动设置）
`)
}

// 主函数
function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp()
    process.exit(0)
  }

  const version = args[0]
  const changelogPath = args[1] || 'CHANGELOG.md'

  if (!version) {
    console.error('错误: 请提供版本号')
    showHelp()
    process.exit(1)
  }

  console.log(`提取版本: ${version}`)
  console.log(`Changelog 路径: ${changelogPath}`)

  const releaseNotes = extractReleaseNotes(version, changelogPath)

  if (releaseNotes === null) {
    console.error('提取发布说明失败')
    process.exit(1)
  }

  writeToGitHubOutput(releaseNotes)
}

// 如果直接运行此脚本
if (import.meta.filename === process.argv[1]) {
  main()
}

export default { extractReleaseNotes, generateDefaultReleaseNotes }
