import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Download, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  RefreshCw, 
  Clock,
  X,
  Play,
  Pause,
  HardDrive
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://127.0.0.1:5000';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString();
};

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Pending' },
  downloading: { icon: Loader2, color: 'text-primary', bg: 'bg-primary/10', label: 'Downloading', spin: true },
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
  cancelled: { icon: X, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Cancelled' }
};

const DownloadItem = ({ download, onCancel, onRetry, onRemove }) => {
  const config = statusConfig[download.status] || statusConfig.pending;
  const Icon = config.icon;
  const isActive = download.status === 'downloading';
  const showProgress = isActive || download.status === 'pending';
  
  const thumbnail = download.thumbnail_url?.startsWith('http') 
    ? download.thumbnail_url 
    : download.thumbnail_url 
      ? `${API_BASE}${download.thumbnail_url}` 
      : null;

  return (
    <div className="p-4 rounded-xl bg-surface/50 border border-white/5 hover:border-white/10 transition-all group">
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="w-16 h-20 rounded-lg overflow-hidden bg-white/5 shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HardDrive size={20} className="text-white/20" />
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate">{download.title}</h3>
              {download.parent_title && (
                <p className="text-sm text-white/50 truncate">{download.parent_title}</p>
              )}
            </div>
            
            {/* Status Badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} shrink-0`}>
              <Icon size={12} className={`${config.color} ${config.spin ? 'animate-spin' : ''}`} />
              <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          {showProgress && (
            <div className="mt-3 space-y-2">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${isActive ? 'bg-primary' : 'bg-white/20'}`}
                  style={{ width: `${download.progress || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>
                  {formatBytes(download.downloaded_bytes)} / {formatBytes(download.total_bytes)}
                </span>
                <span>{download.progress || 0}%</span>
              </div>
              {download.current_page && download.total_pages && (
                <p className="text-xs text-white/40">
                  Page {download.current_page} of {download.total_pages}
                </p>
              )}
            </div>
          )}
          
          {/* Error Message */}
          {download.status === 'failed' && download.error_message && (
            <p className="mt-2 text-xs text-red-400/80 truncate">{download.error_message}</p>
          )}
          
          {/* Timestamps */}
          <div className="mt-2 flex items-center gap-3 text-[10px] text-white/30">
            <span>Added: {formatTime(download.created_at)}</span>
            {download.completed_at && <span>Completed: {formatTime(download.completed_at)}</span>}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {download.status === 'downloading' && (
            <button
              onClick={() => onCancel(download.id)}
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-red-400 transition-colors"
              title="Cancel"
            >
              <X size={16} />
            </button>
          )}
          {(download.status === 'failed' || download.status === 'cancelled') && (
            <button
              onClick={() => onRetry(download.id)}
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-primary transition-colors"
              title="Retry"
            >
              <RefreshCw size={16} />
            </button>
          )}
          {(download.status === 'completed' || download.status === 'failed' || download.status === 'cancelled') && (
            <button
              onClick={() => onRemove(download.id)}
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-red-400 transition-colors"
              title="Remove"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Downloads = () => {
  const toast = useToast();
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [autoProcess, setAutoProcess] = useState(() => localStorage.getItem('downloads-auto-process') !== 'false');

  const fetchDownloads = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/downloads`);
      setDownloads(res.data);
    } catch (err) {
      console.error('Failed to fetch downloads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
    
    // Poll for updates every 2 seconds if there are active downloads
    const interval = setInterval(() => {
      fetchDownloads();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [fetchDownloads]);

  useEffect(() => {
    localStorage.setItem('downloads-auto-process', String(autoProcess));
  }, [autoProcess]);

  // Auto-process pending downloads
  useEffect(() => {
    const hasPending = downloads.some(d => d.status === 'pending');
    const hasDownloading = downloads.some(d => d.status === 'downloading');
    
    if (autoProcess && hasPending && !hasDownloading && !processing) {
      processNext();
    }
  }, [downloads, processing, autoProcess]);

  const processNext = async () => {
    setProcessing(true);
    try {
      await axios.post(`${API_BASE}/api/downloads/process`);
      await fetchDownloads();
    } catch (err) {
      console.error('Failed to process download:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      await axios.post(`${API_BASE}/api/downloads/${id}/cancel`);
      toast.info('Download cancelled');
      await fetchDownloads();
    } catch (err) {
      toast.error('Failed to cancel download');
    }
  };

  const handleRetry = async (id) => {
    try {
      await axios.post(`${API_BASE}/api/downloads/${id}/retry`);
      toast.info('Download re-queued');
      await fetchDownloads();
    } catch (err) {
      toast.error('Failed to retry download');
    }
  };

  const handleRemove = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/downloads/${id}`);
      setDownloads(prev => prev.filter(d => d.id !== id));
      toast.success('Download removed');
    } catch (err) {
      toast.error('Failed to remove download');
    }
  };

  const clearCompleted = async () => {
    try {
      await axios.delete(`${API_BASE}/api/downloads/clear?status=completed`);
      toast.success('Cleared completed downloads');
      await fetchDownloads();
    } catch (err) {
      toast.error('Failed to clear downloads');
    }
  };

  const clearAll = async () => {
    try {
      await axios.delete(`${API_BASE}/api/downloads/clear?status=all`);
      toast.success('Cleared all finished downloads');
      await fetchDownloads();
    } catch (err) {
      toast.error('Failed to clear downloads');
    }
  };

  const activeCount = downloads.filter(d => d.status === 'downloading' || d.status === 'pending').length;
  const pendingCount = downloads.filter(d => d.status === 'pending').length;
  const completedCount = downloads.filter(d => d.status === 'completed').length;
  const failedCount = downloads.filter(d => d.status === 'failed').length;

  const totalDownloading = downloads
    .filter(d => d.status === 'downloading')
    .reduce((acc, d) => acc + (d.downloaded_bytes || 0), 0);

  return (
    <div className="page-shell">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h1 className="heading-lg flex items-center gap-3">
            <Download className="text-primary" />
            Downloads
          </h1>
          <p className="tech-label mt-1">
            {activeCount > 0 ? `${activeCount} active` : 'No active downloads'}
            {completedCount > 0 && ` • ${completedCount} completed`}
            {failedCount > 0 && ` • ${failedCount} failed`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoProcess((value) => !value)}
            className="btn-secondary text-sm"
            title={autoProcess ? 'Pause automatic queue processing' : 'Resume automatic queue processing'}
          >
            {autoProcess ? <Pause size={14} /> : <Play size={14} />}
            {autoProcess ? 'Pause Auto' : 'Resume Auto'}
          </button>
          <button
            onClick={processNext}
            disabled={processing || pendingCount === 0}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            <Play size={14} />
            Process Next
          </button>
          {completedCount > 0 && (
            <button onClick={clearCompleted} className="btn-secondary text-sm">
              Clear Completed
            </button>
          )}
          {(completedCount > 0 || failedCount > 0) && (
            <button onClick={clearAll} className="btn-secondary text-sm">
              Clear All
            </button>
          )}
        </div>
      </header>

      {/* Active Download Summary */}
      {activeCount > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Loader2 size={20} className="text-primary animate-spin" />
              </div>
              <div>
                <p className="font-medium text-white">Downloading...</p>
                <p className="text-sm text-white/50">
                  {formatBytes(totalDownloading)} downloaded
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!autoProcess && pendingCount > 0 && (
        <div className="mt-4 p-3 rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-yellow-300 text-xs">
          Queue is paused. Click <strong>Process Next</strong> to run downloads manually.
        </div>
      )}

      {/* Download List */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 size={24} className="animate-spin text-primary mx-auto" />
            <p className="mt-3 text-white/50 text-sm">Loading downloads...</p>
          </div>
        ) : downloads.length === 0 ? (
          <div className="py-20 text-center">
            <Download size={48} className="text-white/10 mx-auto" />
            <p className="mt-4 text-white/50">No downloads yet</p>
            <p className="mt-1 text-white/30 text-sm">
              Download manga chapters from the chapter list to see them here
            </p>
          </div>
        ) : (
          downloads.map(download => (
            <DownloadItem
              key={download.id}
              download={download}
              onCancel={handleCancel}
              onRetry={handleRetry}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Downloads;
