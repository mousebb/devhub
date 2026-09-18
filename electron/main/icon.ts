import { deflateSync } from 'node:zlib'
import { nativeImage, type NativeImage } from 'electron'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function pointInTriangle(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/** 运行时生成 DevHub 图标（蓝色圆角方块 + 白色播放三角），无需外部资源文件 */
export function createAppIcon(size = 64): NativeImage {
  const rowBytes = size * 4
  const raw = Buffer.alloc((rowBytes + 1) * size)
  const radius = size * 0.22
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      // 圆角矩形背景
      const dx = Math.min(x, size - 1 - x)
      const dy = Math.min(y, size - 1 - y)
      const inside =
        dx >= radius || dy >= radius || (radius - dx) ** 2 + (radius - dy) ** 2 <= radius * radius
      if (inside) {
        r = 0x4f
        g = 0x7c
        b = 0xff
        a = 0xff
        // 白色播放三角
        if (
          pointInTriangle(
            x + 0.5,
            y + 0.5,
            size * 0.36,
            size * 0.26,
            size * 0.36,
            size * 0.74,
            size * 0.74,
            size * 0.5
          )
        ) {
          r = 0xff
          g = 0xff
          b = 0xff
        }
      }
      raw[p++] = r
      raw[p++] = g
      raw[p++] = b
      raw[p++] = a
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
  return nativeImage.createFromBuffer(png)
}
