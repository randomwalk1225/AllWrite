import { app, BrowserWindow, Menu, ipcMain, desktopCapturer, screen, dialog, clipboard, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let writingWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'AllWrite',
  })

  // Create menu with default template + custom View menu
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Save as PDF',
          accelerator: 'CommandOrControl+P',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('export-pdf')
            }
          }
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    // View menu with zoom controls
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        {
          label: 'Zoom In',
          accelerator: 'CommandOrControl+Plus',
          click: () => {
            mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 1)
          }
        },
        {
          label: 'Zoom In (Alt)',
          accelerator: 'CommandOrControl+=',
          click: () => {
            mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 1)
          },
          visible: false
        },
        {
          label: 'Zoom Out',
          accelerator: 'CommandOrControl+-',
          click: () => {
            mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 1)
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CommandOrControl+0',
          click: () => {
            mainWindow.webContents.setZoomLevel(0)
          }
        },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
    // Set zoom level to 0 (100%) for dev tools
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.devToolsWebContents?.setZoomLevel(-2)
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function createWritingWindow(mainWindow: BrowserWindow) {
  if (writingWindow) {
    writingWindow.focus()
    return
  }

  // Get the display where the main window is located
  const { screen } = require('electron')
  const mainBounds = mainWindow.getBounds()
  const display = screen.getDisplayMatching(mainBounds)
  const { x, y, width, height } = display.bounds

  console.log('Display bounds:', { x, y, width, height })

  // Minimize the main window
  mainWindow.minimize()

  writingWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    fullscreen: false,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Force maximize to ensure full screen coverage
  writingWindow.maximize()

  if (isDev) {
    writingWindow.loadURL('http://localhost:5173/writing.html')
    // writingWindow.webContents.openDevTools()
  } else {
    writingWindow.loadFile(path.join(__dirname, '../dist/writing.html'))
  }

  writingWindow.on('closed', () => {
    writingWindow = null
    // Restore the main window when writing window closes
    if (!mainWindow.isDestroyed()) {
      mainWindow.restore()
    }
  })
}

// IPC handler for opening writing window
ipcMain.handle('open-writing-window', async () => {
  if (mainWindow) {
    createWritingWindow(mainWindow)
  }
})

// IPC handler for saving images
ipcMain.handle('save-image', async (event, dataUrl: string, filename: string) => {
  try {
    const downloadsPath = app.getPath('downloads')
    const savePath = path.join(downloadsPath, 'allwrite_img')

    // Create directory if it doesn't exist
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true })
    }

    // Convert data URL to buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Save file
    const fullPath = path.join(savePath, filename)
    fs.writeFileSync(fullPath, buffer)

    return { success: true, path: fullPath }
  } catch (error) {
    console.error('Failed to save image:', error)
    return { success: false, error: (error as Error).message }
  }
})

// IPC handler for setting mouse event passthrough
ipcMain.handle('set-ignore-mouse-events', async (event, ignore: boolean) => {
  if (writingWindow && !writingWindow.isDestroyed()) {
    writingWindow.setIgnoreMouseEvents(ignore, { forward: true })
  }
})

// IPC handler for capturing screen
ipcMain.handle('capture-screen', async () => {
  try {
    // Temporarily hide the writing window to capture what's underneath
    let wasVisible = false
    if (writingWindow && !writingWindow.isDestroyed()) {
      wasVisible = writingWindow.isVisible()
      if (wasVisible) {
        writingWindow.hide()
        // Wait a bit for the window to be fully hidden
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Get all displays
    const displays = screen.getAllDisplays()

    // Find which display the writing window is on
    let displayIndex = 0
    if (writingWindow && !writingWindow.isDestroyed()) {
      const windowBounds = writingWindow.getBounds()
      const currentDisplay = screen.getDisplayMatching(windowBounds)

      // Find the index of this display in the displays array
      displayIndex = displays.findIndex(d => d.id === currentDisplay.id)
      if (displayIndex === -1) {
        displayIndex = 0 // fallback to first display
      }

      console.log('Writing window on display:', displayIndex, 'of', displays.length)
      console.log('Display bounds:', currentDisplay.bounds)
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 3840, height: 2160 }
    })

    console.log('Available sources:', sources.map(s => s.name))

    let result = null

    // desktopCapturer returns sources in the same order as screen.getAllDisplays()
    if (sources.length > displayIndex) {
      console.log('Using source:', sources[displayIndex].name)
      result = sources[displayIndex].thumbnail.toDataURL()
    } else if (sources.length > 0) {
      // Fallback to first source
      console.log('Fallback to first source:', sources[0].name)
      result = sources[0].thumbnail.toDataURL()
    }

    // Restore the writing window visibility
    if (writingWindow && !writingWindow.isDestroyed() && wasVisible) {
      writingWindow.show()
    }

    return result
  } catch (error) {
    console.error('Failed to capture screen:', error)

    // Make sure to restore window visibility even on error
    if (writingWindow && !writingWindow.isDestroyed()) {
      writingWindow.show()
    }

    return null
  }
})

// IPC handler for saving PDF
ipcMain.handle('save-pdf', async (event, pdfData: Uint8Array) => {
  try {
    if (!mainWindow) return

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save all pages as PDF',
      defaultPath: path.join(app.getPath('documents'), 'allwrite-pages.pdf'),
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    })

    if (filePath) {
      fs.writeFileSync(filePath, Buffer.from(pdfData))

      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Success',
        message: 'PDF saved successfully',
        detail: filePath
      })
    }
  } catch (error) {
    console.error('Failed to save PDF:', error)
    if (mainWindow) {
      dialog.showErrorBox('Error', 'Failed to save PDF: ' + (error as Error).message)
    }
  }
})

// IPC handler for copying image to clipboard
ipcMain.handle('copy-image-to-clipboard', async (event, dataUrl: string) => {
  try {
    const image = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(image)
    return { success: true }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return { success: false, error: (error as Error).message }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
