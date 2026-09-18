import { useEffect, useState } from 'react'

/** 每秒返回一个新的时间戳，用于刷新 "运行时长" */
export function useNow(interval = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(timer)
  }, [interval])
  return now
}
