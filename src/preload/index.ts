import { contextBridge, ipcRenderer } from 'electron'

const backendUrlArg = process.argv.find((arg) => arg.startsWith('--jarvis-backend-url='))
const backendUrl = backendUrlArg?.split('=')[1] ?? 'http://127.0.0.1:8000'

const backendTokenArg = process.argv.find((arg) => arg.startsWith('--jarvis-backend-token='))
const backendToken = backendTokenArg?.split('=')[1] ?? ''

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
  }
}

contextBridge.exposeInMainWorld('jarvis', jarvisApi)
