/**
 * DevHub 核心行为冒烟测试（不依赖 Electron）
 *
 * 验证：
 *  1. spawn(shell) 能启动 npm 脚本并实时拿到 stdout
 *  2. taskkill /PID /T /F 能把 npm -> node 整棵进程树杀干净
 *  3. DevHub 启动前后不修改 PATH / NODE_PATH / PYTHONPATH
 */
import { spawn, execFile } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(tmpdir(), 'devhub-smoke-test')
const ok = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => {
  console.error(`  ✗ ${msg}`)
  process.exitCode = 1
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function killTree(pid) {
  return new Promise((resolve) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, (err) => resolve(!err))
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function findChildPids(parentPid) {
  return new Promise((resolve) => {
    execFile(
      'wmic',
      ['process', 'where', `ParentProcessId=${parentPid}`, 'get', 'ProcessId'],
      { windowsHide: true },
      (err, stdout) => {
        if (err) return resolve([])
        resolve(
          stdout
            .split(/\r?\n/)
            .map((l) => Number(l.trim()))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      }
    )
  })
}

async function main() {
  console.log('DevHub 冒烟测试\n')

  if (existsSync(ROOT)) rmSync(ROOT, { recursive: true, force: true })
  mkdirSync(ROOT, { recursive: true })
  writeFileSync(
    join(ROOT, 'package.json'),
    JSON.stringify(
      {
        name: 'devhub-smoke',
        version: '1.0.0',
        scripts: { dev: 'node server.js' }
      },
      null,
      2
    )
  )
  writeFileSync(
    join(ROOT, 'server.js'),
    `console.log('server listening on 4321');
setInterval(() => console.log('tick ' + new Date().toISOString()), 400);
`
  )

  /* ---------- 3. 环境安全 ---------- */
  const before = {
    PATH: process.env.PATH,
    NODE_PATH: process.env.NODE_PATH,
    PYTHONPATH: process.env.PYTHONPATH
  }

  /* ---------- 1. 启动 ---------- */
  console.log('1) 启动 npm run dev（shell: true，继承当前环境）')
  const env = { ...process.env, PORT: '4321' } // 仅进程级覆盖
  const child = spawn('npm run dev', {
    cwd: ROOT,
    env,
    shell: true,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  let output = ''
  child.stdout.on('data', (c) => {
    output += c.toString()
  })
  child.stderr.on('data', (c) => {
    output += c.toString()
  })

  await sleep(4000)
  if (output.includes('server listening on 4321')) ok('捕获到 stdout 输出')
  else fail(`未捕获到预期输出，实际：${JSON.stringify(output.slice(0, 300))}`)

  if (output.includes('tick')) ok('持续输出正常（长驻进程）')
  else fail('没有持续输出')

  const children = await findChildPids(child.pid)
  console.log(`  · shell PID=${child.pid}，子进程 PID=${children.join(', ') || '(未探测到)'}`)

  /* ---------- 2. 停止 ---------- */
  console.log('\n2) 停止服务（taskkill /T /F 杀进程树）')
  const killOk = await killTree(child.pid)
  if (killOk) ok('taskkill 执行成功')
  else fail('taskkill 执行失败')
  await sleep(1200)

  if (!isAlive(child.pid)) ok(`shell 进程 ${child.pid} 已结束`)
  else fail(`shell 进程 ${child.pid} 仍然存在`)

  let survivors = 0
  for (const pid of children) {
    if (isAlive(pid)) survivors++
  }
  if (survivors === 0) ok(`子进程（node）全部结束（共 ${children.length} 个）`)
  else fail(`仍有 ${survivors} 个子进程存活`)

  /* ---------- 3. 环境未被修改 ---------- */
  console.log('\n3) 环境安全')
  const dirty = ['PATH', 'NODE_PATH', 'PYTHONPATH'].filter((k) => process.env[k] !== before[k])
  if (dirty.length === 0) ok('PATH / NODE_PATH / PYTHONPATH 未被修改')
  else fail(`以下变量被修改：${dirty.join(', ')}`)

  rmSync(ROOT, { recursive: true, force: true })
  console.log('\n完成。')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
