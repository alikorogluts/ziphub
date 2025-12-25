const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const { createExtractorFromFile } = require('node-unrar-js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Dosya yolu erişimi için
    },
  });

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'out/index.html'));
  }

  // Drag & Drop için dosya yolu desteği
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// BİLDİRİM FONKSİYONU - DÜZELTME
function sendNotification(title, body) {
  console.log('🔔 Bildirim gönderiliyor:', title, body);
  try {
    const notification = new Notification({
      title: title,
      body: body,
      silent: false
    });
    notification.show();
    console.log('✅ Bildirim başarıyla gönderildi');
  } catch (error) {
    console.error('❌ Bildirim hatası:', error);
  }
}

// PROGRESS GÖNDERME
function sendProgress(percent, message) {
  console.log(`📊 Progress: ${percent}% - ${message}`);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('operation-progress', { percent, message });
  }
}

// DOSYA İSMİ ÇAKIŞMASINI ÇÖZ
function getUniqueFileName(filePath) {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);

  let counter = 1;
  let newPath = filePath;

  while (fs.existsSync(newPath)) {
    newPath = path.join(dir, `${baseName} (${counter})${ext}`);
    counter++;
  }

  console.log(`📝 Dosya ismi çakışması çözüldü: ${path.basename(newPath)}`);
  return newPath;
}

ipcMain.handle('show-in-folder', async (event, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
});

// Sürüklenen dosyanın yolunu al (Fallback)
ipcMain.handle('get-file-path-from-drop', async (event, fileName) => {
  console.log('🔍 Dosya yolu aranıyor:', fileName);
  
  // Masaüstü ve Downloads klasörlerinde ara
  const searchPaths = [
    app.getPath('desktop'),
    app.getPath('downloads'),
    app.getPath('documents'),
    app.getPath('home')
  ];

  for (const searchPath of searchPaths) {
    const potentialPath = path.join(searchPath, fileName);
    if (fs.existsSync(potentialPath)) {
      console.log('✅ Dosya bulundu:', potentialPath);
      return { success: true, path: potentialPath };
    }
  }

  console.log('❌ Dosya bulunamadı');
  return { success: false, path: null };
});

// ÖN İZLEME - DÜZELTİLDİ
ipcMain.handle('get-archive-content', async (event, filePath) => {
  console.log('🔍 Ön izleme isteği - Gelen veri:', filePath, 'Tip:', typeof filePath);
  
  // Dosya yolunu al
  let actualPath = filePath;
  if (typeof filePath === 'object' && filePath !== null) {
    actualPath = filePath.filePath || filePath.path;
  }

  console.log('📂 İşlenecek dosya yolu:', actualPath);
  
  if (!actualPath || actualPath === '' || !fs.existsSync(actualPath)) {
    console.error('❌ Geçersiz dosya yolu');
    return { success: false, message: 'Geçersiz dosya yolu', files: [] };
  }

  try {
    const fileList = [];
    const ext = path.extname(actualPath).toLowerCase();
    console.log('📄 Dosya uzantısı:', ext);
    
    if (ext === '.zip') {
      const zip = new AdmZip(actualPath);
      const zipEntries = zip.getEntries();
      zipEntries.forEach(entry => {
        if (!entry.isDirectory) {
          fileList.push(entry.entryName);
        }
      });
      console.log(`✅ ZIP okundu: ${fileList.length} dosya`);
      return { success: true, files: fileList };
    
    } else if (ext === '.rar') {
      const extractor = await createExtractorFromFile({ filepath: actualPath });
      const list = extractor.getFileList();
      const fileNames = [...list.fileHeaders].map(header => header.name);
      console.log(`✅ RAR okundu: ${fileNames.length} dosya`);
      return { success: true, files: fileNames };
    }
    
    return { success: false, message: 'Desteklenmeyen format', files: [] };
  } catch (error) {
    console.error('❌ Ön izleme hatası:', error);
    return { success: false, message: error.message, files: [] };
  }
});

// SIKIŞTIRMA - DÜZELTİLDİ
ipcMain.handle('create-zip', async (event, filePath) => {
  console.log('📤 Sıkıştırma isteği - Gelen veri:', filePath, 'Tip:', typeof filePath);
  
  // Dosya yolunu al
  let sourceDir = filePath;
  if (typeof filePath === 'object' && filePath !== null) {
    sourceDir = filePath.filePath || filePath.path;
  }

  console.log('📂 İşlenecek klasör:', sourceDir);

  // Eğer path yoksa veya boşsa dialog aç
  if (!sourceDir || sourceDir === '' || sourceDir === 'null') {
    console.log('⚠️ Path boş, dialog açılıyor...');
    const { filePaths, canceled } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Ziplenecek Klasörü Seç'
    });
    
    if (canceled || !filePaths || filePaths.length === 0) {
      console.log('❌ Kullanıcı iptal etti');
      return { success: false, message: '❌ İptal edildi' };
    }
    sourceDir = filePaths[0];
    console.log('✅ Kullanıcı seçti:', sourceDir);
  }

  try {
    if (!fs.existsSync(sourceDir)) {
      console.error('❌ Klasör bulunamadı:', sourceDir);
      return { success: false, message: '❌ Klasör bulunamadı' };
    }

    const stats = fs.statSync(sourceDir);
    const folderName = path.basename(sourceDir);
    const desktopPath = app.getPath('desktop');
    
    // Benzersiz dosya adı oluştur
    const initialPath = path.join(desktopPath, `${folderName}.zip`);
    const targetPath = getUniqueFileName(initialPath);
    const finalFileName = path.basename(targetPath);

    console.log('🎯 Hedef dosya:', targetPath);
    sendProgress(0, 'Hazırlanıyor...');

    return new Promise((resolve) => {
      const output = fs.createWriteStream(targetPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      let progressInterval;
      let currentPercent = 0;

      // Simüle edilmiş progress (archiver progress bazen çalışmaz)
      progressInterval = setInterval(() => {
        if (currentPercent < 90) {
          currentPercent += 5;
          sendProgress(currentPercent, `Sıkıştırılıyor... ${currentPercent}%`);
        }
      }, 300);

      output.on('close', () => {
        clearInterval(progressInterval);
        const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        sendProgress(100, 'Tamamlandı! ✅');
        
        console.log('✅ Sıkıştırma tamamlandı:', finalFileName);
        
        // BİLDİRİM GÖNDER
        sendNotification(
          '🎉 Sıkıştırma Tamamlandı!',
          `${finalFileName} (${sizeMB} MB) masaüstüne kaydedildi.`
        );

        resolve({ 
          success: true, 
          message: `✅ ${sizeMB} MB - ${finalFileName}`,
          outputPath: targetPath
        });
      });

      archive.on('error', (err) => {
        clearInterval(progressInterval);
        console.error('❌ Sıkıştırma hatası:', err);
        sendNotification('❌ Sıkıştırma Hatası', err.message);
        resolve({ success: false, message: `❌ ${err.message}` });
      });

      archive.pipe(output);

      if (stats.isDirectory()) {
        archive.directory(sourceDir, false);
      } else {
        archive.file(sourceDir, { name: folderName });
      }
      
      archive.finalize();
    });
  } catch (error) {
    console.error('❌ Hata:', error);
    sendNotification('❌ Hata', error.message);
    return { success: false, message: `❌ ${error.message}` };
  }
});

// EXTRACT - DÜZELTİLDİ
ipcMain.handle('extract-archive', async (event, filePathArg) => {
  console.log('📥 Extract isteği - Gelen veri:', filePathArg, 'Tip:', typeof filePathArg);
  
  // Dosya yolunu al
  let filePath = filePathArg;
  if (typeof filePathArg === 'object' && filePathArg !== null) {
    filePath = filePathArg.filePath || filePathArg.path;
  }

  console.log('📂 İşlenecek arşiv:', filePath);

  // Eğer path yoksa dialog aç
  if (!filePath || filePath === '' || filePath === 'null') {
    console.log('⚠️ Path boş, dialog açılıyor...');
    const { filePaths, canceled } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Arşivler', extensions: ['zip', 'rar'] }],
      title: 'Açılacak Arşivi Seç'
    });
    
    if (canceled || !filePaths || filePaths.length === 0) {
      console.log('❌ Kullanıcı iptal etti');
      return { success: false, message: '❌ İptal edildi' };
    }
    filePath = filePaths[0];
    console.log('✅ Kullanıcı seçti:', filePath);
  }

  if (!fs.existsSync(filePath)) {
    console.error('❌ Dosya bulunamadı:', filePath);
    return { success: false, message: '❌ Dosya bulunamadı' };
  }

  const fileName = path.basename(filePath, path.extname(filePath));
  const desktopPath = app.getPath('desktop');
  
  // Benzersiz klasör adı oluştur
  const initialDir = path.join(desktopPath, fileName);
  const outputDir = getUniqueFileName(initialDir);
  const finalFolderName = path.basename(outputDir);

  if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🎯 Hedef klasör:', outputDir);

  try {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.zip') {
      sendProgress(10, 'ZIP okunuyor...');
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      const totalFiles = entries.filter(e => !e.isDirectory).length;

      sendProgress(30, 'Dosyalar çıkartılıyor...');
      
      let processedFiles = 0;
      entries.forEach((entry) => {
        if (!entry.isDirectory) {
          processedFiles++;
          const percent = 30 + Math.round((processedFiles / totalFiles) * 60);
          sendProgress(percent, `${processedFiles}/${totalFiles} dosya`);
        }
      });

      zip.extractAllTo(outputDir, true);
      sendProgress(100, 'Tamamlandı! ✅');
      
      console.log('✅ ZIP açıldı:', finalFolderName);
      
      // BİLDİRİM GÖNDER
      sendNotification(
        '🎉 ZIP Açıldı!',
        `${finalFolderName} (${totalFiles} dosya) masaüstüne çıkartıldı.`
      );

      return { 
        success: true, 
        message: `✅ ${totalFiles} dosya - ${finalFolderName}`, 
        outputPath: outputDir 
      };
      
    } else if (ext === '.rar') {
      sendProgress(10, 'RAR okunuyor...');
      const extractor = await createExtractorFromFile({ 
        filepath: filePath, 
        targetPath: outputDir 
      });

      sendProgress(30, 'Dosyalar çıkartılıyor...');
      const extracted = extractor.extract({ files: () => true });
      const fileCount = [...extracted.files].length;

      sendProgress(100, 'Tamamlandı! ✅');
      
      if (fileCount > 0) {
        console.log('✅ RAR açıldı:', finalFolderName);
        
        // BİLDİRİM GÖNDER
        sendNotification(
          '🎉 RAR Açıldı!',
          `${finalFolderName} (${fileCount} dosya) masaüstüne çıkartıldı.`
        );

        return { 
          success: true, 
          message: `✅ ${fileCount} dosya - ${finalFolderName}`, 
          outputPath: outputDir 
        };
      } else {
        sendNotification('❌ RAR Hatası', 'Arşiv boş veya şifreli.');
        return { success: false, message: '❌ RAR boş veya şifreli' };
      }
    }
    
    return { success: false, message: '❌ Desteklenmeyen format' };

  } catch (error) {
    console.error('❌ Hata:', error);
    sendNotification('❌ Hata', error.message);
    return { success: false, message: `❌ ${error.message}` };
  }
});