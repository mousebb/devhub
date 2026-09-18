import { useCallback, useMemo } from 'react'
import { DEFAULT_LANG, normalizeLang, translate, type Lang, type MsgKey, type MsgParams } from '@shared/i18n'
import { useStore } from './store'

export type TFunc = (key: MsgKey, params?: MsgParams) => string

/** 当前界面语言 */
export function useLang(): Lang {
  const { config } = useStore()
  return normalizeLang(config.settings.language ?? DEFAULT_LANG)
}

/**
 * 取翻译函数。
 * 用法：`const { t, lang } = useT()`，`t('act.start')` / `t('msg.startedCount', { n: 3 })`
 */
export function useT(): { t: TFunc; lang: Lang } {
  const lang = useLang()
  const t = useCallback<TFunc>((key, params) => translate(lang, key, params), [lang])
  return useMemo(() => ({ t, lang }), [t, lang])
}
