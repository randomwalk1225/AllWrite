export interface ElectronAPI {
  saveImage: (dataUrl: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>
  openWritingWindow: () => Promise<void>
  captureScreen: () => Promise<string | undefined>
  setIgnoreMouseEvents: (ignore: boolean) => Promise<void>
  savePDF: (pdfData: Uint8Array) => Promise<void>
  onExportPDF: (callback: () => void) => () => void
  copyImageToClipboard: (dataUrl: string) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electron?: ElectronAPI
  }
}
