# DevHub 项目长期笔记

- DevHub = Electron + React + TS + Vite (electron-vite) + Tailwind v3，工作区 E:\prj\devhub（早期在 D:\dev\devhub）
- **数据目录（2026-09-18 改）**：配置/日志/Electron 运行数据统一放 **DevHub 自身目录下的 `data/`**，不再写 C 盘用户目录（用户明确要求）。`resolveDataDir()`（config-manager.ts 导出）= `DEVHUB_DATA_DIR` 环境变量 > 打包时 exe 目录 > 开发时 `process.cwd()`，再拼 `/data`。→ `data/config.json`、`data/logs/`、`data/runtime.json`、`data/electron/`（Chromium 缓存，在 main/index.ts 顶层 `app.setPath('userData', …)` 重定向，必须在 ready 前）。旧版 `%APPDATA%\devhub\` 会一次性迁移（config.json + logs）。仍然**绝不写被管理的用户项目目录**、不改 PATH（最高安全原则）。`data/` 已加进 .gitignore。
- **key 坑：`app.getPath('userData')` 被重定向后取不到旧路径** → config-manager.ts 在**模块加载时**先捕获 `legacyUserDataDir`（早于 index.ts 里的 setPath），迁移用它。
- 停止进程：关 stdin 等 3s → `taskkill /PID x /T /F` 杀整棵树；npm 必须 `spawn(shell: true)`
- **重要环境坑**：WorkBuddy 宿主会设置 `ELECTRON_RUN_AS_NODE=1`，直接跑 electron 会退化成 Node（`electron.app` undefined）。必须先 unset（scripts/start.mjs 已处理；手动调试用 `env -u ELECTRON_RUN_AS_NODE`）
- npm 安装用 npmmirror registry + `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
- PowerShell 工具在本会话输出为空，检查进程用 `wmic process where ... get processid,commandline`；要拿命令输出就把结果 `Set-Content` 到文件再 Read（Bash 工具常因 PATH 损坏报 dirname/head not found，同样不可用）
- **坑：`config:save` 必须只合并 settings**。原实现 `ipcMain.handle(configSave, (_e, config) => { logStore.setMaxLines(config…); return saveAndBroadcast() })` 把入参 `config` 整个丢掉 → 设置页所有开关（如 minimizeToTray）点了都不生效、也写不进盘。现改为 `configManager.update(c => c.settings = {...c.settings, ...settings})`：settings 由渲染进程提供，projects 由主进程维护（否则会被渲染进程的陈旧快照覆盖 lastStartedAt）。
- **坑：不要在设置页执行 `wt.exe`**。`getTools()` 原来对 Windows Terminal 跑 `wt --version`，wt 不支持该参数 → 直接弹一个标题为「Help」的系统信息框（内容 "Windows 终端 <版本>"）。用户打开设置页就会莫名弹窗。现在 wt 只 `where wt.exe` 定位、不执行（tools 项的 `arg` 可缺省表示「只探测不运行」）。
- **Electron uninstall 报错** = electron 二进制没下载（缺 node_modules/electron/dist + path.txt）。补跑：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` + `node node_modules/electron/install.js`
- 开发/构建命令：`npm run dev` / `npm run build` / `npm run typecheck`；核心行为自检：`node scripts/smoke-test.mjs`
- electron-vite v2 需要显式 build.rollupOptions.input，renderer root 指向 src，html 里 script src 是 ./main.tsx
- **Python 日志在 DevHub 里看不到输出**：DevHub 经管道捕获子进程输出（非 TTY），Python 默认块缓冲，长驻进程（如 http server）的 banner/日志卡在缓冲区不刷新 → 日志面板只剩命令预览行。修复：`buildServiceEnv` 注入 `PYTHONUNBUFFERED=1`（仅 Python 识别，对 node/npm 零副作用）。npm/node 在管道下仍主动 flush，所以不受影响。
- **项目列表技术栈图标**：引入依赖 `react-icons`（用 `react-icons/si` Simple Icons 品牌单色 SVG）。`ProjectConfig` 新增可选 `stack?: StackKind` 字段（types.ts 已有 `StackKind`/`STACK_LABELS`/`STACK_KINDS`）；`electron/main/config-manager.ts` 的 `normalizeProject` 已透传 `stack`（用 `STACK_KINDS` 校验）。渲染侧 `src/components/StackIcon.tsx`：`StackIcon`（品牌色图标，unknown 回退 emoji）+ `resolveProjectStack(project)`（从 services 的 command 正则推断 node/python/flutter/go/rust/dotnet/java/php/static）。`ProjectCard` 用 `StackIcon` 替换原 emoji 头像；优先用 `project.stack`，否则自动推断。注意：Java 无官方 SiJava，用 `SiOpenjdk`；多语言项目取第一个识别到的服务的 stack。
