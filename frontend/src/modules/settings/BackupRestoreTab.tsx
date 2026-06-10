import { useState, useRef } from 'react';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';
import { toast } from 'sonner';
import {
  useBackupHistory,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
} from '../../hooks/useApi';
import {
  Database,
  Trash2,
  Upload,
  AlertTriangle,
  RefreshCw,
  Server,
  Calendar,
  Loader2,
  X,
  FileArchive,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BackupRestoreTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats, isLoading, isError, refetch } = useBackupHistory();
  const createBackupMutation = useCreateBackup();
  const deleteBackupMutation = useDeleteBackup();
  const restoreBackupMutation = useRestoreBackup();

  const [isRestoring, setIsRestoring] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [restoreTarget, setRestoreTarget] = useState<any>(null); // For history backup restore confirmation
  const [deleteTarget, setDeleteTarget] = useState<any>(null); // For delete backup confirmation
  const [dragActive, setDragActive] = useState(false);

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-500">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
        <p className="font-black">Failed to connect to Backup service.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const handleCreateBackup = () => {
    toast.promise(createBackupMutation.mutateAsync(), {
      loading: 'Generating database backup snapshot...',
      success: 'Database backup created successfully!',
      error: (err) => err?.response?.data?.message || 'Failed to create database backup.',
    });
  };

  const handleDelete = (filename: string) => {
    deleteBackupMutation.mutate(filename, {
      onSuccess: () => {
        toast.success('Backup file deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || 'Failed to delete backup file');
      },
    });
  };

  const handleDownload = async (filename: string) => {
    const downloadToast = toast.loading(`Downloading ${filename}...`);
    try {
      const response = await api.get(ENDPOINTS.BACKUP.DOWNLOAD(filename), {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.dismiss(downloadToast);
      toast.success('Backup download complete');
    } catch (err: any) {
      toast.dismiss(downloadToast);
      toast.error('Failed to download backup file');
    }
  };

  const handleRestoreFromHistory = (filename: string) => {
    setIsRestoring(true);
    setRestoreTarget(null);
    setUploadProgress(0);

    restoreBackupMutation.mutate(
      { filename },
      {
        onSuccess: () => {
          setIsRestoring(false);
          toast.success('Database restored successfully! Reloading data...');
          // Full state invalidation is done by hook onSuccess
          setTimeout(() => window.location.reload(), 1500);
        },
        onError: (err: any) => {
          setIsRestoring(false);
          toast.error(err?.response?.data?.message || 'Failed to restore database.');
        },
      }
    );
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.zip')) {
      toast.error('Only ZIP backup files are supported.');
      return;
    }

    setIsRestoring(true);
    setUploadProgress(0);

    restoreBackupMutation.mutate(
      {
        file,
        onProgress: (percent) => setUploadProgress(percent),
      },
      {
        onSuccess: () => {
          setIsRestoring(false);
          toast.success('Uploaded database restored successfully! Reloading data...');
          setTimeout(() => window.location.reload(), 1500);
        },
        onError: (err: any) => {
          setIsRestoring(false);
          toast.error(err?.response?.data?.message || 'Failed to restore database from file.');
        },
      }
    );
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const confirmRestoreFile = window.confirm(
        `WARNING: You are uploading "${file.name}" to restore the database.\n\nRestoring a backup will completely replace all current database data. This action cannot be undone.\n\nAre you sure you want to proceed?`
      );
      if (confirmRestoreFile) {
        handleFileUpload(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const confirmRestoreFile = window.confirm(
        `WARNING: You are uploading "${file.name}" to restore the database.\n\nRestoring a backup will completely replace all current database data. This action cannot be undone.\n\nAre you sure you want to proceed?`
      );
      if (confirmRestoreFile) {
        handleFileUpload(file);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    if (dateStr === '—') return '—';
    try {
      const d = new Date(dateStr);
      return `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Cards Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
          <div className="p-4 bg-indigo-100 rounded-2xl text-indigo-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Database Size</div>
            <div className="text-xl font-black text-slate-800 mt-1">{stats.databaseSize}</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
          <div className="p-4 bg-emerald-100 rounded-2xl text-emerald-600">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Backups</div>
            <div className="text-xl font-black text-slate-800 mt-1">{stats.totalBackups}</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
          <div className="p-4 bg-amber-100 rounded-2xl text-amber-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latest Backup</div>
            <div className="text-sm font-black text-slate-800 mt-1.5 truncate max-w-[150px]">
              {stats.lastBackupDate === '—' ? '—' : formatDate(stats.lastBackupDate)}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
          <div className="p-4 bg-rose-100 rounded-2xl text-rose-600">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Restore</div>
            <div className="text-sm font-black text-slate-800 mt-1.5 truncate max-w-[150px]">
              {stats.lastRestoreDate === '—' ? '—' : formatDate(stats.lastRestoreDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Console Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Drag & Drop Restore + Backup Action (Left Column) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col items-center text-center space-y-6">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-800 tracking-tight">Restore Database</h4>
              <p className="text-xs font-semibold text-slate-500 mt-1 px-4">
                Upload a backup file directly from your computer to restore all ERP database tables.
              </p>
            </div>

            {/* Drag Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-10 px-4 border-2 border-dashed rounded-2xl cursor-pointer flex flex-col items-center justify-center transition-all ${
                dragActive
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 hover:border-indigo-400 text-slate-400 bg-slate-50 hover:bg-white'
              }`}
            >
              <FileArchive className="w-10 h-10 mb-3 text-slate-400" />
              <span className="text-xs font-black text-slate-700">Click or Drag Backup ZIP</span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".zip"
                className="hidden"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm text-center space-y-4">
            <h4 className="text-sm font-black text-slate-800 tracking-tight">Create Manual Backup</h4>
            <p className="text-xs font-semibold text-slate-500 px-4">
              Capture a complete snapshot of all tables, dispatches, audits, and settings at this exact moment.
            </p>
            <button
              onClick={handleCreateBackup}
              disabled={createBackupMutation.isPending || isRestoring}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 disabled:shadow-none"
            >
              {createBackupMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating Snapshot...
                </>
              ) : (
                <>Create Snapshot</>
              )}
            </button>
          </div>
        </div>

        {/* Backup History Table (Right Column) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Backup Archives</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">List of historical database snapshots saved on server.</p>
            </div>
            <span className="px-3.5 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-black text-slate-600">
              Storage Used: {stats.backupStorageUsed}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Time</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created By</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.backups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 font-bold text-sm">
                      No historical backups found.
                    </td>
                  </tr>
                ) : (
                  stats.backups.map((item) => (
                    <tr key={item.filename} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 text-xs font-bold text-slate-700">
                        {formatDate(item.createdAt)}
                        <span className="block text-[9px] font-medium text-slate-400 mt-0.5 font-mono">
                          {item.filename}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs font-black text-slate-800">{item.size}</td>
                      <td className="py-4 px-6 text-xs font-semibold text-slate-600">{item.userName}</td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            item.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleDownload(item.filename)}
                            disabled={item.status === 'FAILED'}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-30 disabled:hover:bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black transition-all"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => setRestoreTarget(item)}
                            disabled={item.status === 'FAILED' || isRestoring}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-30 disabled:hover:bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black transition-all"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Confirmation Dialogs */}
      <AnimatePresence>
        {/* Restore History Dialog */}
        {restoreTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full border border-slate-100 shadow-2xl relative"
            >
              <button
                onClick={() => setRestoreTarget(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 border border-amber-100">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Restore Database Backup</h2>
              <p className="text-slate-500 font-semibold text-xs mb-6">
                Are you sure you want to restore this database snapshot? Restoring will completely overwrite the current database tables. Current active states and logs will be replaced. This action cannot be undone.
              </p>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6 text-xs space-y-2 font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-400">Backup File:</span>
                  <span className="text-slate-800 font-mono">{restoreTarget.filename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created At:</span>
                  <span className="text-slate-800">{formatDate(restoreTarget.createdAt)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRestoreTarget(null)}
                  className="px-5 py-3 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRestoreFromHistory(restoreTarget.filename)}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
                >
                  Yes, Restore Database
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Backup Dialog */}
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full border border-slate-100 shadow-2xl relative"
            >
              <button
                onClick={() => setDeleteTarget(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>

              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Delete Backup File</h2>
              <p className="text-slate-500 font-semibold text-xs mb-6">
                Are you sure you want to permanently delete this database backup? The backup archive file will be deleted from the server storage.
              </p>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6 text-xs space-y-2 font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-400">Backup File:</span>
                  <span className="text-slate-800 font-mono text-[10px]">{deleteTarget.filename}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-5 py-3 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget.filename)}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Restore Progress Overlay Blocker */}
      {isRestoring && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white p-6">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-500 mb-6" />
          <h3 className="text-2xl font-black tracking-tight">Restoring Database State...</h3>
          <p className="text-slate-400 text-sm mt-2 text-center max-w-sm">
            Applying the SQL transaction block. Please do not close this browser window or refresh the page.
          </p>
          {uploadProgress > 0 && (
            <div className="mt-8 flex flex-col items-center">
              <span className="text-xs font-black text-indigo-400 mb-2">Uploading: {uploadProgress}%</span>
              <div className="w-64 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
