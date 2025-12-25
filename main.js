const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
// RAR için gerekli (WASM tabanlı güvenli çözüm)
const { createExtractorFromFile } = require('node-unrar-js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    titleBarStyle: 'hiddenInset', // Mac stili
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // React ile iletişim için
    },
  });

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'out/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- 1. DOSYA SIKIŞTIRMA (ZIP YAPMA) ---
ipcMain.handle('create-zip', async (event, directPath = null) => {
  let sourceDir = directPath;

  // Eğer sürükle-bırak ile dosya gelmediyse, Dialog aç
  if (!sourceDir) {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Ziplenecek Klasörü Seç'
    });
    if (filePaths.length === 0) return { success: false, message: 'İptal edildi.' };
    sourceDir = filePaths[0];
  }
  
  // Dosya mı Klasör mü kontrolü (Tekil dosya da ziplenebilsin diye)
  const stats = fs.statSync(sourceDir);
  const folderName = path.basename(sourceDir);
  const desktopPath = app.getPath('desktop');
  const targetPath = path.join(desktopPath, `${folderName}.zip`);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      resolve({ success: true, message: `Masaüstüne kaydedildi: ${folderName}.zip` });
    });

    archive.on('error', (err) => {
      reject({ success: false, message: err.message });
    });

    archive.pipe(output);
    
    // Eğer klasörse klasör olarak, dosyaysa dosya olarak ekle
    if (stats.isDirectory()) {
      archive.directory(sourceDir, false);
    } else {
      archive.file(sourceDir, { name: folderName });
    }
    
    archive.finalize();
  });
});

// --- 2. DOSYA AÇMA (ZIP veya RAR EXTRACT) ---
ipcMain.handle('extract-archive', async (event, directPath = null) => {
  let filePath = directPath;

  // Eğer sürükle-bırak yoksa Dialog aç
  if (!filePath) {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Arşivler', extensions: ['zip', 'rar'] }],
      title: 'Açılacak Arşivi Seç (ZIP/RAR)'
    });
    if (filePaths.length === 0) return { success: false, message: 'İptal edildi.' };
    filePath = filePaths[0];
  }

  const fileName = path.basename(filePath, path.extname(filePath));
  const desktopPath = app.getPath('desktop');
  const outputDir = path.join(desktopPath, fileName);

  if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
  }

  try {
    if (filePath.toLowerCase().endsWith('.zip')) {
      const zip = new AdmZip(filePath);
      zip.extractAllTo(outputDir, true);
      return { success: true, message: `${fileName} klasörü masaüstüne çıkarıldı!` };
    } else if (filePath.toLowerCase().endsWith('.rar')) {
      const extractor = await createExtractorFromFile({ filepath: filePath, targetPath: outputDir });
      const extracted = extractor.extract({ files: (entry) => true });
      if ([...extracted.files].length > 0) {
           return { success: true, message: `${fileName} (RAR) masaüstüne çıkarıldı!` };
      } else {
           return { success: false, message: 'RAR boş veya şifreli olabilir.' };
      }
    }
    return { success: false, message: 'Desteklenmeyen format.' };
  } catch (error) {
    return { success: false, message: 'Hata: ' + error.message };
  }
});