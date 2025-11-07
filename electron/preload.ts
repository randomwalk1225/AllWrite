import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Save image file to downloads/icannote_img folder
  saveImage: (dataUrl: string, filename: string) =>
    ipcRenderer.invoke('save-image', dataUrl, filename),
  // Open transparent writing window
  openWritingWindow: () => ipcRenderer.invoke('open-writing-window'),
  // Capture screen for background
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  // Set mouse event passthrough for writing window
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.invoke('set-ignore-mouse-events', ignore),
  // Save PDF file
  savePDF: (pdfData: Uint8Array) =>
    ipcRenderer.invoke('save-pdf', pdfData),
  // Listen for export PDF command
  onExportPDF: (callback: () => void) => {
    ipcRenderer.on('export-pdf', callback)
    return () => ipcRenderer.removeListener('export-pdf', callback)
  },
  // Copy image to clipboard
  copyImageToClipboard: (dataUrl: string) =>
    ipcRenderer.invoke('copy-image-to-clipboard', dataUrl)
})
