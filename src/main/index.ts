import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { createHash, randomBytes } from 'crypto'

const BACKEND_URL = process.env.JARVIS_BACKEND_URL ?? 'http://127.0.0.1:8000'
const BACKEND_PORT = new URL(BACKEND_URL).port || '8000'
// Generated once per launch and shared with both sides: injected into the backend's
// env (JARVIS_API_TOKEN) and handed to the renderer via preload. The backend fails
// closed without it, so /start, /stop and /events all require this exact value.
const BACKEND_TOKEN = randomBytes(32).toString('hex')

let backendProcess: ChildProcess | null = null
let provisionProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null

function backendRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'backend') : join(app.getAppPath(), 'backend')
}

function runtimePython(): string {
  const root = backendRoot()
  return process.platform === 'win32'
    ? join(root, 'runtime', 'python.exe')
    : join(root, 'runtime', 'bin', 'python3')
}

// The provisioned dependencies live OUTSIDE the install folder, because the
// installer wipes $INSTDIR on every update (see backend/provision.py's module
// docstring). Keep this in sync with provision.py's pydeps_root().
function pydepsRoot(): string {
  // %LOCALAPPDATA%, NOT %APPDATA%: the latter roams, and an 8.4 GB roaming
  // profile is a bad outcome on a managed machine. Must stay identical to
  // provision.py's pydeps_root().
  const base = process.env.LOCALAPPDATA ?? app.getPath('appData')
  return join(base, 'Jarvis', 'pydeps')
}

function pydepsPython(): string {
  return process.platform === 'win32'
    ? join(pydepsRoot(), 'Scripts', 'python.exe')
    : join(pydepsRoot(), 'bin', 'python')
}

function resolveBackendPaths(): { python: string; script: string; cwd: string } {
  const appRoot = backendRoot()
  const isWin = process.platform === 'win32'
  // Preferred: the provisioned venv (holds torch et al, survives updates). Then
  // the bundled runtime, then a local dev venv, then system python. The backend
  // SOURCE always comes from the install folder — only the interpreter moves.
  const candidates = isWin
    ? [
        pydepsPython(),
        join(appRoot, 'runtime', 'python.exe'),
        join(appRoot, '.venv', 'Scripts', 'python.exe')
      ]
    : [
        pydepsPython(),
        join(appRoot, 'runtime', 'bin', 'python3'),
        join(appRoot, '.venv', 'bin', 'python')
      ]
  const python = candidates.find((p) => existsSync(p)) ?? (isWin ? 'python' : 'python3')
  return { python, script: join(appRoot, 'main.py'), cwd: appRoot }
}

// First-run setup is needed when we ship the bundled runtime but the dependency
// venv isn't there or doesn't match the shipped lock file. With no bundled
// runtime (pure dev with a .venv), there's nothing to provision.
//
// The lock-hash comparison is what makes updates cheap: an unchanged dependency
// list means the existing venv is reused as-is and no setup screen appears.
function needsProvision(): boolean {
  if (!existsSync(runtimePython())) return false
  if (!existsSync(pydepsPython())) return true

  try {
    const stamp = JSON.parse(readFileSync(join(pydepsRoot(), '.provisioned'), 'utf-8'))
    const lock = readFileSync(join(backendRoot(), 'requirements-lock.txt'))
    const lockHash = createHash('sha256').update(lock).digest('hex')
    return stamp?.lock_sha256 !== lockHash
  } catch {
    return true // missing/unreadable stamp -> provision
  }
}

function childEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    JARVIS_DATA_DIR: join(app.getPath('appData'), 'Jarvis', 'data'),
    // Recorded in the provisioning stamp for diagnostics (not used to decide
    // whether to re-provision — that's the lock hash).
    JARVIS_APP_VERSION: app.getVersion(),
    // Force UTF-8 so the backend's emoji log lines aren't mangled when captured
    // on a non-UTF-8 Windows locale.
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8'
  }
}

function startBackend(): void {
  if (backendProcess) return
  const { python, script, cwd } = resolveBackendPaths()
  if (!existsSync(script)) {
    console.warn(`[jarvis] Backend not found at ${script} — expecting manual backend on ${BACKEND_URL}`)
    return
  }
  console.log(`[jarvis] Starting backend: ${python} ${script}`)
  backendProcess = spawn(python, [script], {
    cwd,
    env: { ...childEnv(), SERVER_PORT: BACKEND_PORT, JARVIS_API_TOKEN: BACKEND_TOKEN },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  backendProcess.stdout?.on('data', (d: Buffer) => console.log(`[backend] ${d.toString().trim()}`))
  backendProcess.stderr?.on('data', (d: Buffer) => console.error(`[backend] ${d.toString().trim()}`))
  backendProcess.on('exit', (code) => {
    console.log(`[jarvis] Backend exited with code ${code}`)
    backendProcess = null
  })
}

function sendSetup(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

// Spawn the first-run provisioner (pip-install the GPU deps + download the models)
// and stream its JSON progress to the renderer's setup screen. On success, boot the
// backend; on failure, surface it so the user can retry.
function runProvision(): void {
  if (provisionProcess) return
  const python = runtimePython()
  const script = join(backendRoot(), 'provision.py')
  if (!existsSync(python) || !existsSync(script)) {
    sendSetup('setup:error', { message: 'Setup files are missing from the installation.' })
    return
  }
  console.log('[jarvis] Running first-run provisioner…')
  provisionProcess = spawn(python, [script], { cwd: backendRoot(), env: childEnv(), stdio: ['ignore', 'pipe', 'pipe'] })

  let buf = ''
  let lastError = ''
  const onData = (data: Buffer): void => {
    buf += data.toString()
    let nl = buf.indexOf('\n')
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      nl = buf.indexOf('\n')
      if (!line) continue
      let msg: { type?: string; line?: string; message?: string } | null = null
      try {
        msg = JSON.parse(line)
      } catch {
        sendSetup('setup:log', line) // non-JSON (model warnings etc.) → log tail
        continue
      }
      if (msg?.type === 'progress') sendSetup('setup:progress', msg)
      else if (msg?.type === 'log') sendSetup('setup:log', msg.line ?? '')
      else if (msg?.type === 'error') {
        lastError = msg.message ?? ''
        sendSetup('setup:log', `Error: ${lastError}`)
      }
    }
  }
  provisionProcess.stdout?.on('data', onData)
  provisionProcess.stderr?.on('data', onData)

  provisionProcess.on('exit', (code) => {
    provisionProcess = null
    if (code === 0) {
      sendSetup('setup:done')
      startBackend()
    } else {
      sendSetup('setup:error', {
        message: lastError || `Setup failed (exit code ${code}). Check your internet connection and click Retry.`
      })
    }
  })
}

function stopChildren(): void {
  provisionProcess?.kill()
  provisionProcess = null
  backendProcess?.kill('SIGTERM')
  backendProcess = null
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
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
      additionalArguments: [
        `--jarvis-backend-url=${BACKEND_URL}`,
        `--jarvis-backend-token=${BACKEND_TOKEN}`,
        `--jarvis-app-version=${app.getVersion()}`
      ]
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Frameless window controls
  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

  // First-run setup
  ipcMain.handle('setup:status', () => ({ needed: needsProvision() }))
  ipcMain.on('setup:begin', () => {
    if (needsProvision()) runProvision()
  })
  ipcMain.on('setup:retry', () => {
    if (needsProvision()) runProvision()
  })

  createWindow()

  // If already provisioned, boot the backend now; the renderer polls /health.
  // Otherwise the renderer shows the setup screen and calls setup:begin.
  if (!needsProvision()) startBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopChildren()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopChildren())
