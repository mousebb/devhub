/**
 * 界面文案词典（中 / 英）
 *
 * 主进程与渲染进程共用：托盘菜单、系统弹窗、日志系统行也需要按语言切换。
 * 用法：
 *   渲染进程 —— `const { t, lang } = useT()`
 *   主进程   —— `translate(configManager.get().settings.language, 'main.open')`
 *
 * 加文案时只需改这里的 zh，en 少一条会编译报错（类型是 Record<MsgKey, string>）。
 */

export type Lang = 'zh' | 'en'

export const DEFAULT_LANG: Lang = 'zh'

export const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'zh', label: '简体中文' },
  { value: 'en', label: 'English' }
]

export const LANG_SET = new Set<string>(LANG_OPTIONS.map((o) => o.value))

const zh = {
  /* ------------------------------ 侧栏 / 应用 ------------------------------ */
  'app.allProjects': '全部项目',
  'app.favorites': '收藏',
  'app.recent': '最近启动',
  'app.settings': '设置',
  'app.tags': '标签',
  'app.tagline': '本地项目启动器',
  'app.runningCount': '{n} 个服务运行中',
  'app.collapseSidebar': '收起侧栏',
  'app.expandSidebar': '展开侧栏',
  'app.expandTree': '展开分组与项目',
  'app.collapseTree': '收起分组与项目',
  'app.projectsCount': '{n} 个项目',
  'app.allProjectsTooltip': '全部项目（{n}）',

  /* --------------------------------- 列表 --------------------------------- */
  'list.searchPlaceholder': '搜索项目 / 目录 / 服务 / 标签…',
  'list.sortName': '按名称',
  'list.sortRecent': '按最近启动',
  'list.sortCreated': '按创建时间',
  'list.addProject': '添加项目',
  'list.loading': '加载中…',
  'list.emptyMatchTitle': '没有匹配的项目',
  'list.emptyMatchHint': '换个关键词试试',
  'list.emptyTitle': '还没有项目',
  'list.emptyHint':
    '点击「添加项目」，选择一个目录，DevHub 会自动识别 package.json / pubspec.yaml / requirements.txt 并生成启动命令。',
  'list.noProjects': '还没有项目',

  /* --------------------------------- 动作 --------------------------------- */
  'act.start': '启动',
  'act.stop': '停止',
  'act.restart': '重启',
  'act.restartAll': '重启全部',
  'act.logs': '日志',
  'act.viewLogs': '查看运行日志（npm run dev 输出）',
  'act.favorite': '收藏',
  'act.unfavorite': '取消收藏',
  'act.openVSCode': '在 VS Code 中打开',
  'act.openFolder': '打开文件夹',
  'act.openDir': '打开目录',
  'act.duplicate': '复制',
  'act.edit': '编辑',
  'act.delete': '删除',
  'act.cancel': '取消',
  'act.save': '保存',
  'act.confirm': '确定',
  'act.close': '关闭',
  'act.back': '返回列表',
  'act.browse': '浏览',
  'act.copy': '复制',

  /* --------------------------------- 卡片 --------------------------------- */
  'card.noServices': '还没有服务，点击「编辑」添加',
  'card.noPath': '未设置目录',
  'card.servicesCount': '{n} 个服务',
  'card.groupSubtitle': '{p} 个项目 · {s} 个服务',

  /* --------------------------------- 服务行 -------------------------------- */
  'svc.recovered': '已恢复 · ',

  /* --------------------------------- 详情页 -------------------------------- */
  'detail.lastStarted': '最近启动：{time}',
  'detail.noPath': '未设置目录',
  'detail.noCwd': '(未配置目录)',
  'detail.uptime': '运行时间 {duration}',
  'detail.recoveredBadge': '已恢复',
  'detail.recoveredNote': '已恢复会话 · 实时日志不可用，停止后重新启动可恢复日志',
  'detail.noServices': '还没有服务，点击「编辑」添加第一个服务',
  'detail.logsTab': '日志',
  'detail.logBuffer': '日志目录：{n} 行内存缓冲 · 同时写入磁盘',
  'detail.builtinLog': '内置日志',
  'detail.external': '外部 {mode}',
  'detail.noDir': '未配置目录',
  'detail.opFailed': '操作失败',

  /* --------------------------------- 日志 --------------------------------- */
  'log.filterPlaceholder': '过滤日志…',
  'log.autoScroll': '自动滚动',
  'log.wrap': '自动换行',
  'log.lines': '{n} 行',
  'log.copied': '已复制 {n} 行日志',
  'log.saveFile': '保存为文件',
  'log.openFolder': '打开日志目录',
  'log.clear': '清空',
  'log.empty': '暂无日志',
  'log.backToBottom': '回到底部',

  /* -------------------------------- 添加向导 ------------------------------- */
  'wiz.title': '添加项目',
  'wiz.scanRoot': '扫描目录',
  'wiz.scanRootHint': 'DevHub 只读取目录，不会修改任何文件',
  'wiz.scan': '扫描',
  'wiz.groupLabel': '分组名称（可选）',
  'wiz.groupHint':
    '填写后，所选多个项目会合并成一个分组卡片，可一键启动/停止全部成员（如前后端）',
  'wiz.groupPlaceholder': '留空则各项目独立显示',
  'wiz.hintPick':
    '选择一个目录后点击「扫描」，DevHub 会自动识别 package.json / pubspec.yaml / requirements.txt 等项目',
  'wiz.noneFound': '没有识别到项目',
  'wiz.manual': '手动创建',
  'wiz.addSelected': '添加所选（{n}）',
  'wiz.pickFolder': '请选择要扫描的目录',
  'wiz.noProjectHint': '没有识别到项目，可以手动添加',
  'wiz.added': '已添加 {n} 个项目',

  /* --------------------------------- 编辑器 -------------------------------- */
  'ed.titleEdit': '编辑项目 · {name}',
  'ed.titleNew': '新建项目',
  'ed.icon': '图标',
  'ed.name': '项目名称',
  'ed.path': '项目目录',
  'ed.pathHint': 'DevHub 不会写入项目目录',
  'ed.scanSub': '扫描子项目',
  'ed.group': '分组',
  'ed.groupHint':
    '填同一个分组名的多个项目会合并成一张卡片，可一键启停全部成员（如前后端）',
  'ed.groupPlaceholder': '如 MyApp（前后端同名）',
  'ed.tags': '标签',
  'ed.tagsHint': '逗号分隔',
  'ed.notes': '备注',
  'ed.services': '服务（{n}）',
  'ed.addService': '添加服务',
  'ed.startupOrder': '#{n} 启动顺序',
  'ed.moveUp': '上移',
  'ed.moveDown': '下移',
  'ed.removeService': '删除服务',
  'ed.cwd': '工作目录',
  'ed.detect': '检测',
  'ed.command': '启动命令',
  'ed.detectedScripts': '检测到脚本：',
  'ed.startupDelay': '启动延迟(ms)',
  'ed.ports': '端口',
  'ed.runMode': '运行方式',
  'ed.includeInStartAll': '参与启动全部',
  'ed.autoRestart': '崩溃自动重启',
  'ed.envTitle': '环境变量（仅作用于该服务子进程）',
  'ed.envAdd': '添加',
  'ed.secret': '密钥',
  'ed.emptyServices':
    '还没有服务。点击「添加服务」手动添加，或点「扫描子项目」自动识别。',
  'ed.needCwd': '请先填写工作目录',
  'ed.needPath': '请先填写项目目录',
  'ed.notDetected': '未在该目录识别到项目（package.json / pubspec.yaml / requirements.txt 等）',
  'ed.noScanned': '没有扫描到可识别的项目',
  'ed.addedServices': '已添加 {n} 个服务，请检查命令是否正确',
  'ed.untitled': '未命名项目',

  /* --------------------------------- 设置 --------------------------------- */
  'set.title': '设置',
  'set.back': '返回项目列表',
  'set.general': '通用',
  'set.language': '语言 / Language',
  'set.theme': '主题',
  'set.themeDark': '深色',
  'set.themeLight': '浅色',
  'set.themeSystem': '跟随系统',
  'set.defaultRunMode': '默认运行方式',
  'set.maxLogLines': '内存日志上限（行）',
  'set.checkPorts': '启动前检测端口占用',
  'set.confirmStopAll': '停止全部前确认',
  'set.minimizeToTray': '关闭窗口时最小化到托盘',
  'set.config': '配置',
  'set.version': '版本',
  'set.dataDir': '数据目录',
  'set.configFile': '配置文件',
  'set.logDir': '日志目录',
  'set.projectCount': '项目数',
  'set.exportConfig': '导出配置',
  'set.importConfig': '导入配置',
  'set.exported': '已导出到 {path}',
  'set.imported': '已导入配置',
  'set.dataNote':
    '配置与日志都放在 DevHub 自身目录下的 data 文件夹（不再占用 C 盘用户目录），依然不会写入被管理的项目目录。导出时会剔除标记为「密钥」的环境变量值。',
  'set.env': '环境（只读）',
  'set.envNote': 'DevHub 继承当前用户环境，且不会修改 PATH / NODE_PATH / PYTHONPATH。',
  'set.tools': '可用工具',
  'set.toolsNote': 'DevHub 不管理、也不安装这些运行时 —— 能否使用取决于你自己的 Windows 环境。',
  'set.notFound': '未找到',
  'set.detectFailed': '未能检测',
  'set.notSet': '（未设置）',

  /* ------------------------------ 提示 / 确认框 ----------------------------- */
  'msg.savedProject': '已保存项目「{name}」',
  'msg.deleteTitle': '删除项目',
  'msg.deleteMessage': '确定删除「{name}」吗？正在运行的服务会被停止，此操作不可撤销。',
  'msg.deleted': '已删除「{name}」',
  'msg.duplicated': '已复制项目',
  'msg.service': '服务',
  'msg.startFailedShort': '启动失败',
  'msg.startFailed': '{name} 启动失败：{error}',
  'msg.exited': '{name} 已退出（exit code {code}）',
  'msg.portBusyTitle': '端口已被占用',
  'msg.portBusy': '端口 {port} 被占用（PID {pid} / {name}）',
  'msg.portBusyNoPid': '端口 {port} 被占用',
  'msg.portBusyMessage': '{detail}\n\nDevHub 不会自动结束占用端口的程序。是否仍然启动？',
  'msg.startAnyway': '仍然启动',
  'msg.alreadyRunning': '「{name}」的服务已在运行',
  'msg.startedCount': '已启动「{name}」的 {n} 个服务',
  'msg.stopAllTitle': '停止全部服务',
  'msg.stopAllMessage': '确定停止「{name}」的 {n} 个正在运行的服务吗？',
  'msg.stopped': '已停止「{name}」',
  'msg.groupAlreadyRunning': '分组「{name}」的服务已在运行',
  'msg.groupStartedCount': '已启动分组「{name}」的 {n} 个服务',
  'msg.groupStopTitle': '停止分组服务',
  'msg.groupStopMessage': '确定停止分组「{name}」的 {n} 个运行中的服务吗？',
  'msg.groupStopped': '已停止分组「{name}」',
  'msg.noProjectPath': '项目没有配置目录',

  /* ------------------------------ 相对时间 ------------------------------- */
  'time.never': '从未',
  'time.justNow': '刚刚',
  'time.minutesAgo': '{n} 分钟前',
  'time.hoursAgo': '{n} 小时前',
  'time.daysAgo': '{n} 天前',

  /* ---------------------------- 主进程：托盘 / 弹窗 --------------------------- */
  'main.open': '打开 DevHub',
  'main.noRunning': '没有正在运行的服务',
  'main.stopAll': '停止全部',
  'main.quit': '退出 DevHub',
  'main.exportTitle': '导出配置',
  'main.importTitle': '导入配置',
  'main.saveLogTitle': '保存日志',

  /* ---------------------------- 主进程：日志系统行 --------------------------- */
  'main.noService': '服务不存在',
  'main.noCwd': '未配置工作目录',
  'main.noCommand': '未配置启动命令',
  'main.cwdMissing': '工作目录不存在：{cwd}',
  'main.procExited': '# 进程退出 code={code} signal={signal}',
  'main.autoRestart': '# 将在 {delay}ms 后自动重启（第 {n} 次）',
  'main.externalStarted': '# 已在外部窗口启动（{mode}），日志请查看对应终端窗口',
  'main.wtFallback': '# Windows Terminal 不可用，回退到 CMD：{error}',
  'main.startFailed': '启动失败：{message}',
  'main.serviceExited': '# 服务已退出（PID {pid}）',
  'main.killOk': '# 已强制结束进程树（PID {pid}）',
  'main.killFail': '# 无法结束进程树（PID {pid}），请手动检查',
  'main.recovered':
    '# 已从上次会话恢复（PID {pid}）。实时日志不可用，但可在此停止该进程。',

  /* ---------------------------- 运行方式名称 ----------------------------- */
  'mode.devhub': 'DevHub 内置日志',
  'mode.terminal': 'Windows Terminal',
  'mode.cmd': 'CMD',
  'mode.powershell': 'PowerShell'
} as const

export type MsgKey = keyof typeof zh

const en: Record<MsgKey, string> = {
  'app.allProjects': 'All projects',
  'app.favorites': 'Favorites',
  'app.recent': 'Recently started',
  'app.settings': 'Settings',
  'app.tags': 'TAGS',
  'app.tagline': 'Local project launcher',
  'app.runningCount': '{n} service running|{n} services running',
  'app.collapseSidebar': 'Collapse sidebar',
  'app.expandSidebar': 'Expand sidebar',
  'app.expandTree': 'Expand groups and projects',
  'app.collapseTree': 'Collapse groups and projects',
  'app.projectsCount': '{n} project|{n} projects',
  'app.allProjectsTooltip': 'All projects ({n})',

  'list.searchPlaceholder': 'Search projects / folders / services / tags…',
  'list.sortName': 'By name',
  'list.sortRecent': 'By last started',
  'list.sortCreated': 'By created',
  'list.addProject': 'Add project',
  'list.loading': 'Loading…',
  'list.emptyMatchTitle': 'No matching projects',
  'list.emptyMatchHint': 'Try another keyword',
  'list.emptyTitle': 'No projects yet',
  'list.emptyHint':
    'Click "Add project", pick a folder, and DevHub will detect package.json / pubspec.yaml / requirements.txt and generate the start commands for you.',
  'list.noProjects': 'No projects yet',

  'act.start': 'Start',
  'act.stop': 'Stop',
  'act.restart': 'Restart',
  'act.restartAll': 'Restart all',
  'act.logs': 'Logs',
  'act.viewLogs': 'View run logs (npm run dev output)',
  'act.favorite': 'Favorite',
  'act.unfavorite': 'Unfavorite',
  'act.openVSCode': 'Open in VS Code',
  'act.openFolder': 'Open folder',
  'act.openDir': 'Open folder',
  'act.duplicate': 'Duplicate',
  'act.edit': 'Edit',
  'act.delete': 'Delete',
  'act.cancel': 'Cancel',
  'act.save': 'Save',
  'act.confirm': 'OK',
  'act.close': 'Close',
  'act.back': 'Back to list',
  'act.browse': 'Browse',
  'act.copy': 'Copy',

  'card.noServices': 'No services yet — click "Edit" to add one',
  'card.noPath': 'No folder set',
  'card.servicesCount': '{n} service|{n} services',
  'card.groupSubtitle': '{p} projects · {s} services',

  'svc.recovered': 'Recovered · ',

  'detail.lastStarted': 'Last started: {time}',
  'detail.noPath': 'No folder set',
  'detail.noCwd': '(no folder configured)',
  'detail.uptime': 'Uptime {duration}',
  'detail.recoveredBadge': 'Recovered',
  'detail.recoveredNote':
    'Recovered session · live logs unavailable. Stop and start again to restore logs.',
  'detail.noServices': 'No services yet — click "Edit" to add the first one',
  'detail.logsTab': 'Logs',
  'detail.logBuffer': 'Log folder: {n} lines buffered in memory · also written to disk',
  'detail.builtinLog': 'Built-in log',
  'detail.external': 'External {mode}',
  'detail.noDir': 'No folder configured',
  'detail.opFailed': 'Operation failed',

  'log.filterPlaceholder': 'Filter logs…',
  'log.autoScroll': 'Auto scroll',
  'log.wrap': 'Wrap',
  'log.lines': '{n} line|{n} lines',
  'log.copied': 'Copied {n} log lines',
  'log.saveFile': 'Save to file',
  'log.openFolder': 'Open log folder',
  'log.clear': 'Clear',
  'log.empty': 'No logs yet',
  'log.backToBottom': 'Back to bottom',

  'wiz.title': 'Add project',
  'wiz.scanRoot': 'Folder to scan',
  'wiz.scanRootHint': 'DevHub only reads folders — it never modifies any file',
  'wiz.scan': 'Scan',
  'wiz.groupLabel': 'Group name (optional)',
  'wiz.groupHint':
    'If set, the selected projects are merged into one group card whose members can be started/stopped together (e.g. frontend + backend)',
  'wiz.groupPlaceholder': 'Leave empty to keep projects separate',
  'wiz.hintPick':
    'Pick a folder and click "Scan" — DevHub detects projects such as package.json / pubspec.yaml / requirements.txt',
  'wiz.noneFound': 'No projects detected',
  'wiz.manual': 'Create manually',
  'wiz.addSelected': 'Add selected ({n})',
  'wiz.pickFolder': 'Choose a folder to scan first',
  'wiz.noProjectHint': 'No projects detected — you can add one manually',
  'wiz.added': 'Added {n} project|Added {n} projects',

  'ed.titleEdit': 'Edit project · {name}',
  'ed.titleNew': 'New project',
  'ed.icon': 'Icon',
  'ed.name': 'Project name',
  'ed.path': 'Project folder',
  'ed.pathHint': 'DevHub never writes into your project folder',
  'ed.scanSub': 'Scan sub-projects',
  'ed.group': 'Group',
  'ed.groupHint':
    'Projects sharing the same group name are merged into one card, where every member can be started/stopped at once (e.g. frontend + backend)',
  'ed.groupPlaceholder': 'e.g. MyApp (same name for frontend and backend)',
  'ed.tags': 'Tags',
  'ed.tagsHint': 'comma separated',
  'ed.notes': 'Notes',
  'ed.services': 'Services ({n})',
  'ed.addService': 'Add service',
  'ed.startupOrder': '#{n} start order',
  'ed.moveUp': 'Move up',
  'ed.moveDown': 'Move down',
  'ed.removeService': 'Remove service',
  'ed.cwd': 'Working directory',
  'ed.detect': 'Detect',
  'ed.command': 'Start command',
  'ed.detectedScripts': 'Detected scripts:',
  'ed.startupDelay': 'Start delay (ms)',
  'ed.ports': 'Ports',
  'ed.runMode': 'Run mode',
  'ed.includeInStartAll': 'Include in Start all',
  'ed.autoRestart': 'Auto-restart on crash',
  'ed.envTitle': 'Env vars (applied only to this service)',
  'ed.envAdd': 'Add',
  'ed.secret': 'Secret',
  'ed.emptyServices':
    'No services yet. Click "Add service" to add one manually, or "Scan sub-projects" to detect them.',
  'ed.needCwd': 'Fill in the working directory first',
  'ed.needPath': 'Fill in the project folder first',
  'ed.notDetected':
    'No project detected in that folder (package.json / pubspec.yaml / requirements.txt, …)',
  'ed.noScanned': 'No recognizable project found',
  'ed.addedServices': 'Added {n} service — please verify the commands|Added {n} services — please verify the commands',
  'ed.untitled': 'Untitled project',

  'set.title': 'Settings',
  'set.back': 'Back to projects',
  'set.general': 'General',
  'set.language': 'Language / 语言',
  'set.theme': 'Theme',
  'set.themeDark': 'Dark',
  'set.themeLight': 'Light',
  'set.themeSystem': 'System',
  'set.defaultRunMode': 'Default run mode',
  'set.maxLogLines': 'In-memory log limit (lines)',
  'set.checkPorts': 'Check ports before start',
  'set.confirmStopAll': 'Confirm before stopping all',
  'set.minimizeToTray': 'Minimize to tray when closing',
  'set.config': 'Configuration',
  'set.version': 'Version',
  'set.dataDir': 'Data folder',
  'set.configFile': 'Config file',
  'set.logDir': 'Log folder',
  'set.projectCount': 'Projects',
  'set.exportConfig': 'Export config',
  'set.importConfig': 'Import config',
  'set.exported': 'Exported to {path}',
  'set.imported': 'Config imported',
  'set.dataNote':
    'Config and logs live in the "data" folder next to DevHub itself (no more C-drive user directory), and are still never written into the projects it manages. Values of env vars marked as secrets are stripped on export.',
  'set.env': 'Environment (read-only)',
  'set.envNote':
    'DevHub inherits the current user environment and never modifies PATH / NODE_PATH / PYTHONPATH.',
  'set.tools': 'Available tools',
  'set.toolsNote':
    'DevHub neither manages nor installs these runtimes — availability depends on your own Windows setup.',
  'set.notFound': 'Not found',
  'set.detectFailed': 'Detection failed',
  'set.notSet': '(not set)',

  'msg.savedProject': 'Saved project "{name}"',
  'msg.deleteTitle': 'Delete project',
  'msg.deleteMessage':
    'Delete "{name}"? Running services will be stopped. This cannot be undone.',
  'msg.deleted': 'Deleted "{name}"',
  'msg.duplicated': 'Project duplicated',
  'msg.service': 'Service',
  'msg.startFailedShort': 'Failed to start',
  'msg.startFailed': '{name} failed to start: {error}',
  'msg.exited': '{name} exited (exit code {code})',
  'msg.portBusyTitle': 'Port already in use',
  'msg.portBusy': 'Port {port} is in use (PID {pid} / {name})',
  'msg.portBusyNoPid': 'Port {port} is in use',
  'msg.portBusyMessage':
    '{detail}\n\nDevHub will not kill the process holding the port. Start anyway?',
  'msg.startAnyway': 'Start anyway',
  'msg.alreadyRunning': 'Services of "{name}" are already running',
  'msg.startedCount': 'Started {n} service of "{name}"|Started {n} services of "{name}"',
  'msg.stopAllTitle': 'Stop all services',
  'msg.stopAllMessage': 'Stop the {n} running service of "{name}"?|Stop the {n} running services of "{name}"?',
  'msg.stopped': 'Stopped "{name}"',
  'msg.groupAlreadyRunning': 'Services of group "{name}" are already running',
  'msg.groupStartedCount': 'Started {n} service of group "{name}"|Started {n} services of group "{name}"',
  'msg.groupStopTitle': 'Stop group services',
  'msg.groupStopMessage': 'Stop the {n} running service of group "{name}"?|Stop the {n} running services of group "{name}"?',
  'msg.groupStopped': 'Stopped group "{name}"',
  'msg.noProjectPath': 'This project has no folder configured',

  'time.never': 'Never',
  'time.justNow': 'Just now',
  'time.minutesAgo': '{n} min ago',
  'time.hoursAgo': '{n} h ago',
  'time.daysAgo': '{n} d ago',

  'main.open': 'Open DevHub',
  'main.noRunning': 'No services running',
  'main.stopAll': 'Stop all',
  'main.quit': 'Quit DevHub',
  'main.exportTitle': 'Export config',
  'main.importTitle': 'Import config',
  'main.saveLogTitle': 'Save logs',

  'main.noService': 'Service not found',
  'main.noCwd': 'No working directory configured',
  'main.noCommand': 'No start command configured',
  'main.cwdMissing': 'Working directory does not exist: {cwd}',
  'main.procExited': '# Process exited code={code} signal={signal}',
  'main.autoRestart': '# Auto-restarting in {delay}ms (attempt {n})',
  'main.externalStarted': '# Started in an external window ({mode}); check that terminal for logs',
  'main.wtFallback': '# Windows Terminal unavailable, falling back to CMD: {error}',
  'main.startFailed': 'Failed to start: {message}',
  'main.serviceExited': '# Service exited (PID {pid})',
  'main.killOk': '# Process tree killed (PID {pid})',
  'main.killFail': '# Could not kill process tree (PID {pid}) — please check manually',
  'main.recovered':
    '# Restored from the previous session (PID {pid}). Live logs are unavailable, but you can stop the process here.',

  'mode.devhub': 'DevHub built-in log',
  'mode.terminal': 'Windows Terminal',
  'mode.cmd': 'CMD',
  'mode.powershell': 'PowerShell'
}

const DICTS: Record<Lang, Record<MsgKey, string>> = { zh, en }

export type MsgParams = Record<string, string | number>

/** 取一条文案并做 {name} 占位替换；缺 key 时回退到 key 本身，方便定位 */
export function translate(lang: Lang | undefined, key: MsgKey, params?: MsgParams): string {
  const dict = DICTS[lang === 'en' ? 'en' : 'zh']
  let raw = dict[key] ?? key
  // 英文单复数：文案里用 `单数|复数` 书写，params.n === 1 时取前半段（中文不用管）
  if (params && typeof params.n === 'number' && raw.includes('|')) {
    const [one, other] = raw.split('|')
    raw = params.n === 1 ? one : other
  }
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name])
  )
}

/** 校验来自配置文件的值，非法则回退默认 */
export function normalizeLang(value: unknown): Lang {
  return typeof value === 'string' && LANG_SET.has(value) ? (value as Lang) : DEFAULT_LANG
}

/** 运行方式的中文名在 types.ts 里，这里按语言取 */
export function terminalModeLabel(lang: Lang | undefined, mode: string): string {
  const key = `mode.${mode}` as MsgKey
  return DICTS[lang === 'en' ? 'en' : 'zh'][key] ?? mode
}
