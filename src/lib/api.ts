import type { DevHubApi } from '@shared/ipc'

declare global {
  interface Window {
    devhub: DevHubApi
  }
}

export const api: DevHubApi = window.devhub

export function keyOf(projectId: string, serviceId: string): string {
  return `${projectId}::${serviceId}`
}
