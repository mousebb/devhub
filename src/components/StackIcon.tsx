import type { IconType } from 'react-icons'
import {
  SiNodedotjs,
  SiPython,
  SiFlutter,
  SiGo,
  SiRust,
  SiDotnet,
  SiOpenjdk,
  SiPhp,
  SiHtml5
} from 'react-icons/si'
import type { ProjectConfig, StackKind } from '@shared/types'

interface StackMeta {
  Icon: IconType
  color: string
}

const STACK_META: Record<StackKind, StackMeta> = {
  node: { Icon: SiNodedotjs, color: '#539E43' },
  python: { Icon: SiPython, color: '#3776AB' },
  flutter: { Icon: SiFlutter, color: '#44A8FF' },
  go: { Icon: SiGo, color: '#00ADD8' },
  rust: { Icon: SiRust, color: '#CE422B' },
  dotnet: { Icon: SiDotnet, color: '#512BD4' },
  java: { Icon: SiOpenjdk, color: '#E76F00' },
  php: { Icon: SiPhp, color: '#777BB4' },
  static: { Icon: SiHtml5, color: '#E34F26' },
  unknown: { Icon: SiHtml5, color: '#9CA3AF' }
}

/** 渲染技术栈品牌图标；unknown 时回退到 emoji（项目自带 icon） */
export function StackIcon({
  stack,
  fallbackEmoji = '📦',
  size = 22
}: {
  stack: StackKind
  fallbackEmoji?: string
  size?: number
}) {
  if (stack === 'unknown') {
    return (
      <span style={{ fontSize: size * 0.95, lineHeight: 1 }} aria-hidden>
        {fallbackEmoji}
      </span>
    )
  }
  const { Icon, color } = STACK_META[stack] ?? STACK_META.unknown
  return <Icon size={size} color={color} aria-label={stack} />
}

/** 从服务命令自动推断技术栈（渲染进程纯函数，无需读文件系统） */
const STACK_PATTERNS: { kind: StackKind; re: RegExp }[] = [
  { kind: 'python', re: /(^|\s)(python|pip|pipenv|poetry|conda)(\.exe)?(\s|$|;)/ },
  { kind: 'flutter', re: /(^|\s)(flutter|dart)(\.exe)?(\s|$|;)/ },
  { kind: 'go', re: /(^|\s)(go|golang)(\.exe)?(\s|$|;)/ },
  { kind: 'rust', re: /(^|\s)(cargo|rustc)(\.exe)?(\s|$|;)/ },
  { kind: 'dotnet', re: /(^|\s)(dotnet)(\.exe)?(\s|$|;)/ },
  { kind: 'java', re: /(^|\s)(java|mvn|gradle|mvnw|gradlew)(\.exe)?(\s|$|;)/ },
  { kind: 'php', re: /(^|\s)(php|artisan|composer)(\.exe)?(\s|$|;)/ },
  {
    kind: 'node',
    re: /(^|\s)(npm|npx|yarn|pnpm|bun|deno|node|next|vite|nest|nuxt|astro|svelte|sveltekit|tsc|esbuild|vue)(\.exe)?(\s|$|;)/
  }
]

export function resolveProjectStack(project: ProjectConfig): StackKind {
  for (const s of project.services) {
    const c = s.command.toLowerCase()
    for (const { kind, re } of STACK_PATTERNS) {
      if (re.test(c)) return kind
    }
  }
  return project.services.length ? 'static' : 'unknown'
}

/** 统一入口：优先用显式 stack，缺失或 unknown 时再从服务命令推断 */
export function projectStack(project: ProjectConfig): StackKind {
  return project.stack && project.stack !== 'unknown' ? project.stack : resolveProjectStack(project)
}
