import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { DetectedProject, StackKind } from '@shared/types'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  'target',
  'bin',
  'obj',
  '.dart_tool',
  'coverage'
])

interface Marker {
  stack: StackKind
  files: string[]
}

const MARKERS: Marker[] = [
  { stack: 'node', files: ['package.json'] },
  { stack: 'python', files: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'manage.py', 'main.py', 'app.py'] },
  { stack: 'flutter', files: ['pubspec.yaml'] },
  { stack: 'go', files: ['go.mod'] },
  { stack: 'rust', files: ['Cargo.toml'] },
  { stack: 'java', files: ['pom.xml', 'build.gradle', 'build.gradle.kts'] },
  { stack: 'php', files: ['composer.json'] },
  { stack: 'dotnet', files: ['.csproj'] },
  { stack: 'static', files: ['index.html'] }
]

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T
  } catch {
    return undefined
  }
}

function detectPackageManager(dir: string): string {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun'
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(dir, 'package-lock.json'))) return 'npm'
  return 'npm'
}

/** 扫描目录，识别其中的项目与可执行脚本 */
export function scanDirectory(root: string, depth = 2): DetectedProject[] {
  const results: DetectedProject[] = []
  if (!existsSync(root)) return results
  walk(root, depth, 0, results)
  return results
}

function walk(dir: string, maxDepth: number, current: number, out: DetectedProject[]) {
  if (current > maxDepth) return
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  const dirs = entries.filter((name) => {
    if (SKIP_DIRS.has(name)) return false
    try {
      return statSync(join(dir, name)).isDirectory()
    } catch {
      return false
    }
  })

  const detected = detectHere(dir, entries)
  if (detected.isProject) {
    out.push(detected)
    // 已是项目根目录时，仅在还有余量时向下找子项目
    if (current < maxDepth) {
      for (const child of dirs) walk(join(dir, child), maxDepth, current + 1, out)
    }
    return
  }

  for (const child of dirs) walk(join(dir, child), maxDepth, current + 1, out)
}

function detectHere(dir: string, entries: string[]): DetectedProject {
  const base: DetectedProject = {
    name: basename(dir),
    path: dir,
    stack: 'unknown',
    scripts: [],
    suggestions: [],
    isProject: false
  }

  const has = (name: string) => entries.includes(name)
  const any = (suffix: string) => entries.some((e) => e.endsWith(suffix))

  // Node.js
  if (has('package.json')) {
    const pkg = readJson<{ name?: string; scripts?: Record<string, string> }>(join(dir, 'package.json'))
    const pm = detectPackageManager(dir)
    const scripts = Object.keys(pkg?.scripts ?? {})
    const priority = ['dev', 'start:dev', 'start', 'serve', 'watch']
    const ordered = [...scripts].sort((a, b) => {
      const ia = priority.indexOf(a)
      const ib = priority.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return {
      ...base,
      name: pkg?.name ? String(pkg.name).replace(/^@[^/]+\//, '') : base.name,
      stack: 'node',
      isProject: true,
      scripts: ordered.map((name) => ({
        name,
        command: pm === 'npm' ? `npm run ${name}` : `${pm} ${name}`
      })),
      suggestions: ordered.slice(0, 3).map((name) => ({
        label: `${pm} ${name}`,
        command: pm === 'npm' ? `npm run ${name}` : `${pm} ${name}`
      }))
    }
  }

  // Flutter / Dart
  if (has('pubspec.yaml')) {
    return {
      ...base,
      stack: 'flutter',
      isProject: true,
      scripts: [{ name: 'run', command: 'flutter run' }],
      suggestions: [{ label: 'flutter run', command: 'flutter run' }]
    }
  }

  // Go
  if (has('go.mod')) {
    return {
      ...base,
      stack: 'go',
      isProject: true,
      scripts: [{ name: 'run', command: 'go run .' }],
      suggestions: [{ label: 'go run .', command: 'go run .' }]
    }
  }

  // Rust
  if (has('Cargo.toml')) {
    return {
      ...base,
      stack: 'rust',
      isProject: true,
      scripts: [{ name: 'run', command: 'cargo run' }],
      suggestions: [{ label: 'cargo run', command: 'cargo run' }]
    }
  }

  // .NET
  if (any('.csproj')) {
    return {
      ...base,
      stack: 'dotnet',
      isProject: true,
      scripts: [{ name: 'run', command: 'dotnet run' }],
      suggestions: [{ label: 'dotnet run', command: 'dotnet run' }]
    }
  }

  // Python
  if (has('requirements.txt') || has('pyproject.toml') || has('Pipfile') || has('manage.py')) {
    const suggestions: { label: string; command: string }[] = []
    if (has('manage.py')) suggestions.push({ label: 'django runserver', command: 'python manage.py runserver' })
    if (has('main.py')) suggestions.push({ label: 'python main.py', command: 'python main.py' })
    if (has('app.py')) suggestions.push({ label: 'python app.py', command: 'python app.py' })
    if (!suggestions.length) {
      suggestions.push({ label: 'uvicorn main:app --reload', command: 'python -m uvicorn main:app --reload' })
    }
    return {
      ...base,
      stack: 'python',
      isProject: true,
      scripts: suggestions.map((s) => ({ name: s.label, command: s.command })),
      suggestions
    }
  }

  // Java
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) {
    const gradle = has('build.gradle') || has('build.gradle.kts')
    return {
      ...base,
      stack: 'java',
      isProject: true,
      scripts: [{ name: 'run', command: gradle ? 'gradlew.bat run' : 'mvn spring-boot:run' }],
      suggestions: [{ label: gradle ? 'gradlew run' : 'mvn spring-boot:run', command: gradle ? 'gradlew.bat run' : 'mvn spring-boot:run' }]
    }
  }

  // PHP
  if (has('composer.json')) {
    return {
      ...base,
      stack: 'php',
      isProject: true,
      scripts: [{ name: 'serve', command: 'php artisan serve' }],
      suggestions: [{ label: 'php artisan serve', command: 'php artisan serve' }]
    }
  }

  // 静态站点
  if (has('index.html')) {
    return {
      ...base,
      stack: 'static',
      isProject: true,
      scripts: [{ name: 'serve', command: 'npx serve -l 8080' }],
      suggestions: [
        { label: 'npx serve -l 8080', command: 'npx serve -l 8080' },
        { label: 'npx http-server -p 8080', command: 'npx http-server -p 8080' }
      ]
    }
  }

  return base
}
