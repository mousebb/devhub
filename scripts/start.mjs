/**
 * 启动脚本
 *
 * 为什么需要它：某些宿主终端（例如嵌套在 Electron 应用里的终端）会设置
 * ELECTRON_RUN_AS_NODE=1，这会让 electron.exe 退化成普通 Node，导致
 * require('electron').app 为 undefined 而崩溃。这里统一清掉该变量再启动。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const mode = process.argv[2] === 'dev' ? 'dev' : 'preview'

delete process.env.ELECTRON_RUN_AS_NODE
delete process.env.ELECTRON_NO_ATTACH_CONSOLE

const isWin = process.platform === 'win32'
const bin = isWin
  ? resolve('node_modules', '.bin', 'electron-vite.cmd')
  : resolve('node_modules', '.bin', 'electron-vite')

if (!existsSync(bin)) {
  console.error('找不到 electron-vite，请先执行 npm install')
  process.exit(1)
}

const child = spawn(bin, [mode], {
  stdio: 'inherit',
  shell: isWin,
  env: process.env,
  cwd: process.cwd()
})

child.on('exit', (code) => process.exit(code ?? 0))
