'use client';
import { useState, useRef, useEffect, DragEvent } from 'react';
import { FolderArchive, FileInput, Loader2, UploadCloud, Terminal, FolderOpen, FileText, X } from 'lucide-react';

type PendingFile = {
  path: string;
  name: string;
  type: 'compress' | 'extract';
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  
  const [previewFiles, setPreviewFiles] = useState<string[]>([]);
  const [fetchingPreview, setFetchingPreview] = useState(false);

  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showProgress, setShowProgress] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString('tr-TR');
    setLogs(prev => [...prev, `[${time}] ${message}`]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // PROGRESS DİNLEYİCİ
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const { ipcRenderer } = (window as any).require('electron');
      
      const progressHandler = (_: any, data: { percent: number; message: string }) => {
        console.log('📊 Frontend Progress:', data);
        setProgress(data.percent);
        setProgressMessage(data.message);
        setShowProgress(true);
        
        if (data.percent === 100) {
          setTimeout(() => setShowProgress(false), 2000);
        }
      };

      ipcRenderer.on('operation-progress', progressHandler);

      return () => {
        ipcRenderer.removeListener('operation-progress', progressHandler);
      };
    } catch (error) {
      console.error('IPC Renderer hatası:', error);
    }
  }, []);

  const openInFinder = () => {
    if (outputPath) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.invoke('show-in-folder', outputPath);
    }
  };

  const getPreview = async (filePath: string) => {
    setFetchingPreview(true);
    setPreviewFiles([]);
    
    console.log('🔍 Ön izleme isteniyor:', filePath);
    
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('get-archive-content', filePath);
      
      console.log('📋 Ön izleme sonucu:', result);
      
      if (result.success && result.files.length > 0) {
        setPreviewFiles(result.files);
        addLog(`📋 ${result.files.length} dosya tespit edildi`);
      } else {
        setPreviewFiles(['❌ İçerik okunamadı veya arşiv boş/şifreli.']);
        addLog('⚠️ Ön izleme başarısız');
      }
    } catch (error: any) {
      console.error('Ön izleme hatası:', error);
      setPreviewFiles([`⚠️ Hata: ${error.message}`]);
      addLog(`❌ Hata: ${error.message}`);
    } finally {
      setFetchingPreview(false);
    }
  };

  const runProcess = async (command: string, filePath: string | null = null) => {
    setLoading(true);
    setLogs([]);
    setOutputPath(null);
    setModalOpen(false);
    setProgress(0);
    setProgressMessage('');
    setShowProgress(false);

    addLog('🚀 İşlem başlatılıyor...');
    
    console.log('🎯 RunProcess çağrıldı:', { command, filePath });
    
    if (filePath) {
      addLog(`📄 Dosya: ${filePath.split('/').pop()}`);
    } else {
      addLog('📂 Dosya seçim penceresi açılıyor...');
    }

    try {
      const { ipcRenderer } = (window as any).require('electron');
      
      // Backend'e string olarak gönder
      const result = await ipcRenderer.invoke(command, filePath);

      console.log('✅ Backend sonucu:', result);

      if (result.success) {
        addLog(`✅ ${result.message}`);
        if (result.outputPath) {
          addLog(`💾 Kaydedildi: ${result.outputPath}`);
          setOutputPath(result.outputPath);
        }
      } else {
        addLog(`❌ ${result.message}`);
      }
    } catch (error: any) {
      console.error('RunProcess hatası:', error);
      addLog(`🔥 HATA: ${error.message}`);
    } finally {
      setLoading(false);
      setPendingFile(null);
      setPreviewFiles([]);
      addLog('🏁 Tamamlandı.');
      
      setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    console.log('📦 Dosya bırakıldı');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0] as any;
      const fileName = file.name;
      
      // Dosya yolunu Electron API ile al
      let filePath = '';
      
      try {
        // Yöntem 1: file.path (standart Electron)
        if (file.path && file.path !== '') {
          filePath = file.path;
          console.log('✅ Yöntem 1: file.path kullanıldı:', filePath);
        } 
        // Yöntem 2: DataTransfer items API
        else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          const item = e.dataTransfer.items[0];
          if (item.kind === 'file') {
            const droppedFile = item.getAsFile();
            if (droppedFile && (droppedFile as any).path) {
              filePath = (droppedFile as any).path;
              console.log('✅ Yöntem 2: DataTransfer item.path kullanıldı:', filePath);
            }
          }
        }
        // Yöntem 3: Backend'den dosya ara
        else {
          console.log('⚠️ Dosya yolu alınamadı, backend\'de aranıyor...');
          const { ipcRenderer } = (window as any).require('electron');
          const result = await ipcRenderer.invoke('get-file-path-from-drop', fileName);
          
          if (result.success) {
            filePath = result.path;
            console.log('✅ Yöntem 3: Backend\'de bulundu:', filePath);
          }
        }
      } catch (error) {
        console.error('Dosya yolu alma hatası:', error);
      }

      // Son çare: Manuel seçim yap
      if (!filePath || filePath.trim() === '') {
        addLog('⚠️ Dosya yolu otomatik alınamadı - Manuel seçim açılıyor');
        console.warn('File.path alınamadı. File objesi:', {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          path: file.path
        });
        
        // Manuel dialog aç
        const actionType = fileName.toLowerCase().endsWith('.zip') || fileName.toLowerCase().endsWith('.rar') ? 'extract-archive' : 'create-zip';
        runProcess(actionType, null);
        return;
      }

      console.log('📂 Dosya bilgisi:', { fileName, filePath });

      const fileNameLower = fileName.toLowerCase();
      let actionType: 'compress' | 'extract' = 'compress';

      if (fileNameLower.endsWith('.zip') || fileNameLower.endsWith('.rar')) {
        actionType = 'extract';
        addLog(`📦 Arşiv dosyası algılandı: ${fileName}`);
        await getPreview(filePath);
      } else {
        actionType = 'compress';
        addLog(`📁 Klasör/Dosya algılandı: ${fileName}`);
        setPreviewFiles([]);
      }
      
      setPendingFile({ path: filePath, name: fileName, type: actionType });
      setModalOpen(true);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col h-screen font-sans overflow-hidden transition-colors duration-300 
        ${isDragging ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-[#0f172a]'} 
        text-slate-900 dark:text-white`}
    >
      
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm border-4 border-dashed border-blue-500 m-4 rounded-3xl pointer-events-none">
          <div className="text-center animate-bounce">
            <UploadCloud size={64} className="text-blue-500 mx-auto mb-2" />
            <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Dosyayı Buraya Bırak</h2>
          </div>
        </div>
      )}

      <div className="h-10 w-full draggable-area flex items-center justify-center relative z-20 bg-transparent">
        <span className="text-xs font-medium text-slate-400 opacity-50 mt-2">ZipHUB</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full max-w-4xl mx-auto">
        
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent drop-shadow-sm">
            ZipHUB
          </h1>
        </div>

        {/* PROGRESS BAR */}
        {showProgress && (
          <div className="w-full mb-6 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl border-2 border-blue-200 dark:border-blue-700 animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={18} />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {progressMessage || 'İşlem devam ediyor...'}
                </span>
              </div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                style={{ width: `${progress}%` }}
              >
                {progress > 10 && (
                  <span className="text-xs font-bold text-white drop-shadow">
                    {progress}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-6">
          <button
            onClick={() => runProcess('create-zip', null)}
            disabled={loading}
            className="group relative overflow-hidden bg-white dark:bg-gray-800/50 shadow-lg border border-slate-200 dark:border-gray-700/50 p-6 rounded-2xl hover:border-blue-500/50 hover:shadow-xl transition-all duration-300 hover:scale-[1.01] text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="bg-blue-100 dark:bg-blue-500/20 p-3 rounded-xl mb-3 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                {loading ? <Loader2 size={32} className="animate-spin" /> : <FolderArchive size={32} />}
              </div>
              <h2 className="text-xl font-bold">Sıkıştır</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">Klasör → ZIP</p>
            </div>
          </button>

          <button
            onClick={() => runProcess('extract-archive', null)}
            disabled={loading}
            className="group relative overflow-hidden bg-white dark:bg-gray-800/50 shadow-lg border border-slate-200 dark:border-gray-700/50 p-6 rounded-2xl hover:border-purple-500/50 hover:shadow-xl transition-all duration-300 hover:scale-[1.01] text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="bg-purple-100 dark:bg-purple-500/20 p-3 rounded-xl mb-3 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                {loading ? <Loader2 size={32} className="animate-spin" /> : <FileInput size={32} />}
              </div>
              <h2 className="text-xl font-bold">Dışarı Aktar</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">ZIP/RAR → Klasör</p>
            </div>
          </button>
        </div>

        <div className="w-full bg-slate-900 rounded-xl border border-slate-700 shadow-inner overflow-hidden flex flex-col h-56">
          <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
              <Terminal size={14} />
              <span>Sistem Logları</span>
            </div>
            {outputPath && !loading && (
              <button 
                onClick={openInFinder}
                className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition font-medium"
              >
                <FolderOpen size={12} />
                Klasörde Göster
              </button>
            )}
          </div>
          
          <div className="p-4 overflow-y-auto font-mono text-xs space-y-1 flex-1">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Terminal size={32} className="mb-2 opacity-30" />
                <span className="italic">Hazır. Dosya sürükleyin veya işlem seçin...</span>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`
                  ${log.includes('✅') ? 'text-green-400 font-semibold' : 
                    log.includes('❌') || log.includes('🔥') ? 'text-red-400 font-semibold' : 
                    log.includes('🚀') ? 'text-yellow-400 font-semibold' : 
                    log.includes('📊') ? 'text-blue-400' : 'text-slate-300'}
                `}>
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {modalOpen && pendingFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-2xl max-w-lg w-full border-2 border-slate-200 dark:border-gray-700 flex flex-col max-h-[85vh]">
            
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {pendingFile.type === 'compress' ? <FolderArchive className="text-blue-500"/> : <FileInput className="text-purple-500"/>}
                  {pendingFile.type === 'compress' ? 'Sıkıştırılacak Klasör' : 'Arşiv İçeriği'}
                </h3>
                <p className="text-slate-500 dark:text-gray-400 text-sm mt-1 truncate font-medium">
                  {pendingFile.name}
                </p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="ml-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {pendingFile.type === 'extract' && (
              <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 mb-6 flex-1 overflow-y-auto min-h-[150px] max-h-[350px] border border-slate-200 dark:border-slate-700">
                {fetchingPreview ? (
                  <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                    <Loader2 className="animate-spin" size={18}/> 
                    <span className="font-medium">İçerik okunuyor...</span>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {previewFiles.slice(0, 100).map((file, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 p-1 rounded transition">
                        <FileText size={14} className="opacity-50 flex-shrink-0 mt-0.5"/> 
                        <span className="break-all">{file}</span>
                      </li>
                    ))}
                    {previewFiles.length > 100 && (
                      <li className="text-xs text-slate-400 italic pt-3 font-medium">
                        ...ve {previewFiles.length - 100} dosya daha.
                      </li>
                    )}
                    {previewFiles.length === 0 && (
                      <li className="text-sm text-slate-400 italic text-center py-8">
                        Dosya listesi alınamadı.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {pendingFile.type === 'compress' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6 border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                  Bu klasör <strong>.zip</strong> formatında Masaüstüne kaydedilecek.
                </p>
              </div>
            )}
            
            <div className="flex gap-3 mt-auto">
              <button 
                onClick={() => setModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                İptal
              </button>
              <button 
                onClick={() => runProcess(pendingFile.type === 'compress' ? 'create-zip' : 'extract-archive', pendingFile.path)}
                className={`flex-[2] py-3 rounded-xl font-bold text-white shadow-lg transition transform hover:scale-105 flex items-center justify-center gap-2
                  ${pendingFile.type === 'compress' ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400' : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400'}`}
              >
                {pendingFile.type === 'compress' ? '🗜️ Sıkıştır' : '📂 Çıkart'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}