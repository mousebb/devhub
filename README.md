# DevHub — Windows 本地开发项目启动器

> 一个极其轻量的 Windows 本地开发项目启动器：**记住你的项目怎么启动**，然后一键 Start All。
>
> DevHub 不管理环境（不装 Node/Python、不改 PATH），只管理「在哪个目录执行什么命令」。

![运行中](docs/screenshot-running.png)

## 怎么运行（3 步）

> 前置：Windows 10/11 + Node.js 18 以上（只是开发 DevHub 本身需要；被管理的项目的环境仍由你自己负责）

在 `D:\dev\devhub` 目录下打开终端，依次执行：

```bash
npm install     # 只做一次：安装依赖（node_modules 已在本机装好，可跳过）
npm run build   # 构建（改了代码后需要重新执行）
npm start       # 启动 DevHub 窗口
```

- **日常开发**用 `npm run dev`：改前端代码即时热更新，改主进程代码自动重启。
- **日常使用**用 `npm start`：直接跑已构建的版本，启动更快。
- 想不敲命令：在 `D:\dev\devhub` 里建一个 `DevHub.bat`，内容写
  `npm start`，双击即可（后续可再打包成 exe / 安装到开始菜单）。

### 在另一台机器安装 / `npm install` 卡住

**原因**：Electron 的二进制（约 100MB）默认从 GitHub 下载，国内网络经常卡死或超时，
表现就是停在 `boolean@3.2.0 deprecated` 之类的警告后面半天不动。

**方法 A（推荐）**：拷贝过去的项目里已带 `.npmrc` 和 `install.bat`，双击 **`install.bat`**
即可（同时强制走国内镜像）。若要手写 `.npmrc`，内容如下：

```ini
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
fetch-retries=5
fetch-timeout=120000
```

**方法 B（临时，不写文件）**：在 CMD 里先设环境变量再装：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm i --registry=https://registry.npmmirror.com
```

PowerShell 用 `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`。

**如果已经卡住/中断过一次**，先清掉残缺缓存再重装，否则会一直失败：

```bat
Ctrl + C                                        :: 先中断
rd /s /q %LOCALAPPDATA%\electron\Cache           :: 删掉残缺的 electron 下载缓存
rd /s /q E:\prj\devhub\node_modules              :: 删掉半成品依赖
npm cache clean --force
npm i
```

装完后验证：`npx electron -v` 能输出版本号即说明二进制下载成功。

### 常见问题

- **`npm install` 一直卡住不动**：见上一节「在另一台机器安装」。- **报 `Cannot read properties of undefined (reading 'getPath')`**：
  你的终端设置了 `ELECTRON_RUN_AS_NODE=1`（常见于嵌套在 Electron 应用内的终端），
  electron 会退化成普通 Node。`npm run dev` / `npm start` 走的是 `scripts/start.mjs`，
  它会自动清掉该变量；直接运行 electron 时请手动
  `set ELECTRON_RUN_AS_NODE=` 或 `env -u ELECTRON_RUN_AS_NODE electron .`。
- **GPU 进程崩溃 / 窗口一闪而过**：在特殊会话（远程、服务、无显卡环境）下可能出现，
  启动时加参数即可：`electron . --disable-gpu --no-sandbox`。
- **npm 命令找不到**：先确认 `node -v`、`npm -v` 能正常输出，DevHub 不会替你安装 Node。

### 首次使用

1. 点右上角 **+ 添加项目** → 选择你的代码根目录（例如 `E:\Projects`）
2. 点「扫描」→ 勾选识别出的项目 → DevHub 自动生成 `npm run dev` 之类的命令
3. 回到列表，点项目卡片上的 **▶ 启动全部**，切到详情页可以看实时日志

### 自检脚本

```bash
node scripts/smoke-test.mjs   # 不启动界面，直接验证：启动命令 / 实时日志 / 杀进程树 / 环境不变
```

## 功能总览（v1）

### P0 核心
- **项目管理**：添加 / 编辑 / 删除 / 复制，多个 Service（名称、工作目录、启动命令）
- **启动 / 停止 / 重启**：服务级 + 项目级（Start All 按顺序 + 启动延迟）
- **实时日志**：内置日志窗口，stdout/stderr/系统消息分色、过滤、自动滚动、复制、保存、打开日志目录
- **日志落盘**：`%APPDATA%\DevHub\logs\<项目>\<服务>.log`
- **项目搜索**：按名称 / 目录 / 服务 / 命令 / 标签搜索

### P1
- 收藏 / 最近启动 / 分组 / 标签
- 服务可选运行方式：**DevHub 内置日志** / **Windows Terminal** / **CMD** / **PowerShell**
- **端口占用检测**：启动前检查声明的端口，被占用时询问（绝不自动杀占用进程）
- 快捷操作：Open in VS Code / Open Terminal / Open Folder
- 系统托盘（运行中的服务、停止全部、退出）、关闭时最小化到托盘

### P2（已实现部分）
- **目录扫描**：识别 package.json / requirements.txt / pyproject.toml / pubspec.yaml /
  go.mod / Cargo.toml / *.csproj / pom.xml / composer.json / index.html
- **npm scripts 自动发现**：检测 dev / start:dev / start 等，点击即生成 `npm run dev`
- 崩溃自动重启（可按服务开启）、配置导入导出（自动剔除密钥值）

## 数据与安全

- 配置保存在 `%APPDATA%\DevHub\config.json`，**绝不写入你的项目目录**
- 环境变量只在子进程内覆盖（`{...process.env, ...serviceEnv}`），**不修改** 系统 PATH /
  NODE_PATH / PYTHONPATH / Registry —— 设置页可只读查看当前继承的环境与可用工具
- 停止流程：关闭 stdin 优雅等待 3 秒 → `taskkill /PID x /T /F` 结束整棵进程树
  （npm → node → 子进程全部退出）
- 标记为「密钥」的环境变量：UI 打码显示、导出配置时剔除值

## 项目结构

```
devhub/
├── electron/
│   ├── main/
│   │   ├── index.ts            # 主进程：窗口 / 托盘 / IPC
│   │   ├── process-manager.ts  # 进程管理：spawn / 状态机 / 停止进程树
│   │   ├── config-manager.ts   # 配置：%APPDATA%\DevHub\config.json
│   │   ├── log-store.ts        # 日志：内存环形缓冲 + 磁盘文件
│   │   ├── scanner.ts          # 项目 / npm scripts 自动识别
│   │   ├── system.ts           # 端口检测 / where / 打开 VS Code 等
│   │   └── icon.ts             # 运行时生成托盘 / 窗口图标
│   ├── preload/index.ts        # contextBridge 暴露 DevHubApi
│   └── shared/                 # 类型 + IPC 通道定义（主/渲染共用）
├── src/                        # React 渲染层
│   ├── components/             # Sidebar / ProjectCard / ProjectDetail /
│   │                           # LogViewer / ProjectEditor / AddProjectWizard / Settings
│   ├── lib/                    # api / store(全局状态) / format
│   └── App.tsx
└── scripts/                    # start.mjs 启动器 / smoke-test.mjs 核心行为自检
```

## 验收情况

| 用例 | 结果 |
| --- | --- |
| Case 1 Node 项目 `npm run start:dev` 启动 | ✅（真实应用内验证，日志实时捕获） |
| Case 3 多服务 Start All | ✅ 按顺序 + startupDelay |
| Case 4 Stop 后 npm/node/子进程全部退出 | ✅ `taskkill /T /F` 验证无残留进程 |
| Case 5 环境安全（PATH/NODE_PATH/PYTHONPATH 不变） | ✅ `scripts/smoke-test.mjs` 断言通过 |

运行 `node scripts/smoke-test.mjs` 可随时重新执行核心行为自检（无需 Electron）。

## 说明与边界

- npm/npx/pnpm 在 Windows 上是 `.cmd`，因此使用 `spawn(cmd, { shell: true })`；日志中的
  PID 是外层 shell 的 PID，停止时按进程树整棵结束
- DevHub 不会帮你修复 Node/Python 环境：工具缺失时设置页会明确显示「未找到」
- 打包安装包（NSIS）暂未配置，当前以 `npm run dev` / `npm start` 方式使用
