'use client';
import { useState, DragEvent } from 'react';
import { FolderArchive, FileInput, CheckCircle, AlertCircle, Loader2, UploadCloud } from 'lucide-react';

// Tip tanımlamasını güncelledik: Hem 'path' hem 'name' tutuyoruz
type PendingFile = {
  path: string;
  name: string;
  type: 'compress' | 'extract';
};

export default function Home() {
  const [status, setStatus] = useState<string>('Hazır');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [loading, setLoading] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // State tipini güncelledik
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);

  const runProcess = async (command: string, filePath: string | null = null) => {
    setLoading(true);
    setStatus('İşleniyor...');
    setStatusType('info');
    setModalOpen(false);

    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke(command, filePath);

      if (result.success) {
        setStatus(result.message);
        setStatusType('success');
      } else {
        setStatus(result.message);
        setStatusType('error');
      }
    } catch (error: any) {
      setStatus('Hata: ' + error.message);
      setStatusType('error');
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0] as any; 
      // Güvenlik önlemi: Eğer path yoksa (tarayıcıdaysan) boş string ver
      const filePath = file.path || ''; 
      const fileName = file.name;
      const fileNameLower = fileName.toLowerCase();

      let actionType: 'compress' | 'extract' = 'compress';

      if (fileNameLower.endsWith('.zip') || fileNameLower.endsWith('.rar')) {
        actionType = 'extract';
      } else {
        actionType = 'compress';
      }
      
      // Dosya ismini de state'e ekledik
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

      <div className="h-10 w-full draggable-area flex items-center justify-center relative z-20">
        <span className="text-xs font-medium text-slate-400 opacity-50 mt-2">ZipHUB</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
        <div className="mb-10 text-center">
          <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent drop-shadow-sm">
            ZipHUB
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-2 text-lg font-light">
            Sürükle, Bırak, Yönet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          <button
            onClick={() => runProcess('create-zip')}
            disabled={loading}
            className="group relative overflow-hidden bg-white dark:bg-gray-800/50 shadow-xl dark:shadow-none border border-slate-200 dark:border-gray-700/50 p-8 rounded-3xl hover:border-blue-500/50 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] text-left"
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="bg-blue-100 dark:bg-blue-500/20 p-4 rounded-2xl mb-4 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FolderArchive size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Sıkıştır</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">Klasör seç ve ZIP yap.</p>
            </div>
          </button>

          <button
            onClick={() => runProcess('extract-archive')}
            disabled={loading}
            className="group relative overflow-hidden bg-white dark:bg-gray-800/50 shadow-xl dark:shadow-none border border-slate-200 dark:border-gray-700/50 p-8 rounded-3xl hover:border-purple-500/50 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] text-left"
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="bg-purple-100 dark:bg-purple-500/20 p-4 rounded-2xl mb-4 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <FileInput size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Dışarı Aktar</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">Arşiv dosyasını aç.</p>
            </div>
          </button>
        </div>

        <div className={`mt-10 px-6 py-3 rounded-full flex items-center gap-3 transition-all duration-500 
          ${statusType === 'success' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20' :
            statusType === 'error' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20' :
            'bg-slate-100 dark:bg-gray-800/50 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-700/50'
          }`}>
          {loading ? <Loader2 className="animate-spin" size={20} /> : 
           statusType === 'success' ? <CheckCircle size={20} /> :
           statusType === 'error' ? <AlertCircle size={20} /> : null
          }
          <span className="font-medium text-sm">{status}</span>
        </div>
      </div>

      {modalOpen && pendingFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
              {pendingFile.type === 'compress' ? 'Sıkıştırılsın mı?' : 'Dışarı Aktarılsın mı?'}
            </h3>
            <p className="text-slate-500 dark:text-gray-300 text-sm mb-6 break-all">
              <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                {/* HATA DÜZELTİLDİ: Artık split yapmıyoruz, direkt ismi basıyoruz */}
                {pendingFile.name}
              </span> dosyası üzerinde işlem yapmak üzeresiniz.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                İptal
              </button>
              <button 
                onClick={() => runProcess(pendingFile.type === 'compress' ? 'create-zip' : 'extract-archive', pendingFile.path)}
                className={`flex-1 py-3 rounded-xl font-medium text-white shadow-lg transition transform hover:scale-105
                  ${pendingFile.type === 'compress' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'}`}
              >
                {pendingFile.type === 'compress' ? 'ZIP Oluştur' : 'Ayıkla'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}