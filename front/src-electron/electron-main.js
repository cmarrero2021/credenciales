import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import os from 'os'

// needed in case process is undefined under Linux
const platform = process.platform || os.platform()

let mainWindow

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, 'icons/icon.png'), // tray icon
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD)
    }
  })

  mainWindow.loadURL(process.env.APP_URL)

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools()
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// ============================================
// MANEJO DE IMPRESIÓN
// ============================================

// Escuchar solicitud de impresión desde el renderer
ipcMain.handle('print-credential', async (event, options) => {
  return new Promise((resolve, reject) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)

      // Configuración de impresión
      const printOptions = {
        silent: false, // Mostrar diálogo de impresión
        printBackground: true,
        color: true,
        margins: {
          marginType: 'none'
        },
        landscape: false,
        pagesPerSheet: 1,
        collate: false,
        copies: 1,
        pageSize: { width: 55000, height: 85000 } // 55mm x 85mm en micrones
      }

      // Usar el método con callback para detectar el resultado
      win.webContents.print(printOptions, (success, failureReason) => {
        if (success === undefined) {
          // El usuario canceló
          resolve({ success: true, printed: false })
        } else if (success) {
          // Se imprimió exitosamente
          resolve({ success: true, printed: true })
        } else {
          // Hubo un error
          resolve({ success: false, error: failureReason, printed: false })
        }
      })
    } catch (error) {
      // console.error('Error al imprimir:', error)
      // resolve({ success: false, error: error.message, printed: false })
      resolve({ success: false, error: "Impresión cancelada por el usuario", printed: false })
      resolve({ success: false, error: error.message, printed: false })
    }
  })
})

// Alternativa: Imprimir a PDF primero (más control)
ipcMain.handle('print-credential-pdf', async (event, options) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)

    const pdfOptions = {
      marginsType: 1,
      pageSize: {
        width: 55000, // 55mm en micrones
        height: 85000 // 85mm en micrones
      },
      printBackground: true,
      printSelectionOnly: false,
      landscape: false
    }

    // Generar PDF
    const data = await win.webContents.printToPDF(pdfOptions)

    // Aquí podrías guardar el PDF temporalmente y abrirlo con el visor del sistema
    // para que el usuario lo imprima desde ahí

    return { success: true, pdfData: data }
  } catch (error) {
    console.error('Error al generar PDF:', error)
    return { success: false, error: error.message }
  }
})
