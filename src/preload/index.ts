import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const backendUrlArg = process.argv.find((arg) => arg.startsWith('--jarvis-backend-url='))
const backendUrl = backendUrlArg?.split('=')[1] ?? 'http://127.0.0.1:8000'

const backendTokenArg = process.argv.find((arg) => arg.startsWith('--jarvis-backend-token='))
const backendToken = backendTokenArg?.split('=')[1] ?? ''

export interface SetupProgress {
  pct: number
  phase: string
  detail: string
}

export interface JarvisApi {
  platform: string
  version: string
  backend: {
    url: string
    token: string
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
  setup: {
    status: () => Promise<{ needed: boolean }>
    begin: () => void
    retry: () => void
    onProgress: (cb: (p: SetupProgress) => void) => () => void
    onLog: (cb: (line: string) => void) => () => void
    onDone: (cb: () => void) => () => void
    onError: (cb: (e: { message: string }) => void) => () => void
  }
}

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const jarvisApi: JarvisApi = {
  platform: process.platform,
  version: '3.0.0',
  backend: {
    url: backendUrl,
    token: backendToken
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },
  setup: {
    status: () => ipcRenderer.invoke('setup:status'),
    begin: () => ipcRenderer.send('setup:begin'),
    retry: () => ipcRenderer.send('setup:retry'),
    onProgress: (cb) => subscribe('setup:progress', cb),
    onLog: (cb) => subscribe('setup:log', cb),
    onDone: (cb) => subscribe<void>('setup:done', () => cb()),
    onError: (cb) => subscribe('setup:error', cb)
  }
}

contextBridge.exposeInMainWorld('jarvis', jarvisApi)
