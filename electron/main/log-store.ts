import { createWriteStream, existsSync, mkdirSync, WriteStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { LogLine, LogStream } from '@shared/types'

const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

export function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, '')
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'unnamed'
}

export function serviceKey(projectId: string, serviceId: string): string {
  return `${projectId}::${serviceId}`
}

/**
 * 日志存储：每个服务一份内存环形缓冲 + 一份磁盘日志文件。
 */
export class LogStore {
  private buffers = new Map<string, LogLine[]>()
  private streams = new Map<string, WriteStream>()
  /** 已经尝试从磁盘读回过历史的服务，避免重复 IO */
  private loadedFromDisk = new Set<string>()
  private seq = 0
  private maxLines: number

  constructor(private logDir: string, maxLines = 3000) {
    this.maxLines = maxLines
  }

  setMaxLines(max: number) {
    this.maxLines = Math.max(200, max)
  }

  append(projectId: string, serviceId: string, stream: LogStream, rawText: string): LogLine[] {
    const text = stripAnsi(rawText).replace(/\r$/, '')
    const key = serviceKey(projectId, serviceId)
    const parts = text.split(/\r?\n/)
    if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
    const created: LogLine[] = []
    for (const line of parts) {
      const entry: LogLine = {
        id: ++this.seq,
        projectId,
        serviceId,
        stream,
        text: line,
        ts: Date.now()
      }
      created.push(entry)
    }
    if (!created.length) return created

    const buf = this.buffers.get(key) ?? []
    buf.push(...created)
    if (buf.length > this.maxLines) buf.splice(0, buf.length - this.maxLines)
    this.buffers.set(key, buf)

    const file = this.ensureStream(key, projectId, serviceId)
    if (file) {
      const stamp = new Date(created[0].ts).toISOString().slice(11, 19)
      file.write(created.map((l) => `[${stamp}] ${l.text}`).join('\n') + '\n')
    }
    return created
  }

  system(projectId: string, serviceId: string, text: string): LogLine[] {
    return this.append(projectId, serviceId, 'system', text)
  }

  get(projectId: string, serviceId: string): LogLine[] {
    return this.buffers.get(serviceKey(projectId, serviceId)) ?? []
  }

  /**
   * 读取日志：内存有实时缓冲就直接返回；否则从磁盘 .log 文件读回最近 maxLines 行。
   * 这解决了「DevHub 重启后历史日志消失」的问题——磁盘文件一直有全量追加，只差读回。
   */
  async getOrLoad(projectId: string, serviceId: string): Promise<LogLine[]> {
    const key = serviceKey(projectId, serviceId)
    const buf = this.buffers.get(key)
    if (buf && buf.length) return buf
    if (this.loadedFromDisk.has(key)) return buf ?? []
    return this.loadFromDisk(projectId, serviceId)
  }

  private async loadFromDisk(projectId: string, serviceId: string): Promise<LogLine[]> {
    const key = serviceKey(projectId, serviceId)
    this.loadedFromDisk.add(key)
    const file = this.filePath(projectId, serviceId)
    if (!existsSync(file)) {
      this.buffers.set(key, [])
      return []
    }
    const text = await readFile(file, 'utf-8')
    const all = text.split(/\r?\n/).filter(Boolean)
    const recent = all.slice(-this.maxLines)
    // 顺手控制磁盘体积：文件比内存上限大很多时，回写仅保留最近 maxLines 行
    if (all.length > this.maxLines * 2) {
      try {
        await writeFile(file, recent.join('\n') + '\n', 'utf-8')
      } catch {
        /* 截断失败不影响读取 */
      }
    }
    const base = Date.now()
    const created: LogLine[] = recent.map((raw, i) => ({
      id: ++this.seq,
      projectId,
      serviceId,
      stream: 'stdout' as const,
      // 去掉写入时的行首 [HH:MM:SS] 时间戳，UI 自己按 ts 渲染
      text: raw.replace(/^\s*\[[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?\]\s?/, ''),
      // 倒推时间，避免读回的历史行全部挤在同一时刻
      ts: base - (recent.length - i) * 1000
    }))
    this.buffers.set(key, created)
    return created
  }

  clear(projectId: string, serviceId: string) {
    const key = serviceKey(projectId, serviceId)
    this.buffers.set(key, [])
    this.loadedFromDisk.delete(key)
    const existing = this.streams.get(key)
    if (existing) {
      existing.end()
      this.streams.delete(key)
    }
    const file = this.filePath(projectId, serviceId)
    // 清空文件：用 'w' 重新打开一次即截断
    const s = createWriteStream(file, { flags: 'w' })
    s.end()
  }

  filePath(projectId: string, serviceId: string): string {
    return join(this.logDir, safeFileName(projectId), `${safeFileName(serviceId)}.log`)
  }

  folderPath(projectId: string, serviceId?: string): string {
    return serviceId ? dirname(this.filePath(projectId, serviceId)) : join(this.logDir, safeFileName(projectId))
  }

  private ensureStream(key: string, projectId: string, serviceId: string): WriteStream | undefined {
    const existing = this.streams.get(key)
    if (existing && !existing.destroyed) return existing
    const file = this.filePath(projectId, serviceId)
    try {
      const dir = dirname(file)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const stream = createWriteStream(file, { flags: 'a' })
      stream.on('error', () => this.streams.delete(key))
      this.streams.set(key, stream)
      return stream
    } catch {
      return undefined
    }
  }
}
