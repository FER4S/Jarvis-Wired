import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { randomBytes } from 'crypto'

const BACKEND_URL = process.env.JARVIS_BACKEND_URL ?? 'http://127.0.0.1:8000'
const BACKEND_PORT = new URL(BACKEND_URL).port || '8000'
// Generated once per launch and shared with both sides: injected into the backend's
// env (JARVIS_API_TOKEN) and handed to the renderer via preload. The backend fails
// closed without it, so /start, /stop and /events all require this exact value.
const BACKEND_TOKEN = randomBytes(32).toString('hex')

let backendProcess: ChildProcess | null = null

function resolveBackendPaths(): { python: string; script: string; cwd: string } {
  const appRoot = app.isPackaged
    ? join(process.resourcesPath, 'backend')
    : join(app.getAppPath(), 'backend')

  const isWin = process.platform === 'win32'
  // Preferred: a self-contained Python runtime shipped with the app (backend/runtime),
  // so the boss needs no system Python. Fall back to a local dev venv, then system python.
  const candidates = isWin
    ? [join(appRoot, 'runtime', 'python.exe'), join(appRoot, '.venv', 'Scripts', 'python.exe')]
    : [join(appRoot, 'runtime', 'bin', 'python3'), join(appRoot, '.venv', 'bin', 'python')]

  const python = candidates.find((p) => existsSync(p)) ?? (isWin ? 'python' : 'python3')
  const script = join(appRoot, 'main.py')

  return { python, script, cwd: appRoot }
}

function startBackend(): void {
  const { python, script, cwd } = resolveBackendPaths()

  if (!existsSync(script)) {
    console.warn(`[jarvis] Backend not found at ${script} — expecting manual backend on ${BACKEND_URL}`)
    return
  }

  // Redirect the backend's writable data (memory, email store, cache) to a per-user
  // dir. When packaged, resources/backend is read-only (Program Files), so writing to
  // the project-local ./data would fail — %APPDATA%\Jarvis\data is always writable.
  const dataDir = join(app.getPath('appData'), 'Jarvis', 'data')

  console.log(`[jarvis] Starting backend: ${python} ${script}`)
  backendProcess = spawn(python, [script], {
    cwd,
    env: {
      ...process.env,
      SERVER_PORT: BACKEND_PORT,
      JARVIS_API_TOKEN: BACKEND_TOKEN,
      JARVIS_DATA_DIR: dataDir,
      // Force UTF-8 stdout/stderr so the backend's emoji log lines aren't mangled into
      // mojibake when Electron captures them on a non-UTF-8 Windows locale.
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  backendProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.on('exit', (code) => {
    console.log(`[jarvis] Backend exited with code ${code}`)
    backendProcess = null
  })
}

function stopBackend(): void {
  if (!backendProcess) return
  backendProcess.kill('SIGTERM')
  backendProcess = null
}

async function waitForBackend(timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BACKEND_URL}/health`)
      if (res.ok) return true
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#000814',
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--jarvis-backend-url=${BACKEND_URL}`, `--jarvis-backend-token=${BACKEND_TOKEN}`]
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  startBackend()
  const ready = await waitForBackend()
  if (!ready) {
    console.warn('[jarvis] Backend health check timed out — UI will start in offline mode')
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackend()
})
