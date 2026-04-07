import { useState } from 'react';
import axios from 'axios';
import { Upload as UploadIcon, CheckCircle2, AlertCircle, FileAudio, FileText } from 'lucide-react';

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [type, setType] = useState('book');
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [volumeNumber, setVolumeNumber] = useState('');
  const [genres, setGenres] = useState('');
  const [uploadSummary, setUploadSummary] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;
    
    setStatus('uploading');
    setUploadSummary(null);
    const formData = new FormData();
    const isBulk = files.length > 1;
    const fieldName = type === 'music' ? (isBulk ? 'music_files' : 'music') : (isBulk ? 'book_files' : 'book');
    files.forEach((selectedFile) => {
      formData.append(fieldName, selectedFile);
    });
    formData.append('type', type);
    if (title.trim()) formData.append('title', title.trim());
    if (author.trim()) formData.append('author', author.trim());
    if (volumeNumber.trim()) formData.append('volume_number', volumeNumber.trim());
    if (genres.trim()) formData.append('genres', genres.trim());

    try {
      const endpoint = type === 'music'
        ? (isBulk ? '/api/upload/music/bulk' : '/api/upload/music')
        : (isBulk ? '/api/upload/book/bulk' : '/api/upload/book');
      const response = await axios.post(`http://127.0.0.1:5000${endpoint}`, formData, {
        onUploadProgress: (p) => setProgress(Math.round((p.loaded * 100) / p.total))
      });
      setStatus('success');
      setFiles([]);
      setTitle('');
      setAuthor('');
      setVolumeNumber('');
      setGenres('');
      setUploadSummary(response.data || null);
    } catch (err) { setStatus('error'); }
  };

  return (
    <div className="max-w-5xl mx-auto page-shell">
      <header className="space-y-4 border-b border-border pb-8 text-center">
        <div className="flex justify-center items-center gap-3">
          <span className="status-online" />
          <span className="tech-label text-primary">Inbound Data Terminal</span>
        </div>
        <h1 className="heading-lg">Integrate</h1>
        <p className="tech-label-sm">System Input Ready // Multi Format Supported</p>
      </header>

      <div className="card rounded-3xl p-8 md:p-12 shadow-[0_18px_54px_rgba(0,0,0,0.35)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <form onSubmit={handleUpload} className="space-y-8">
          <div className="flex justify-center gap-4">
            {['book', 'manga', 'music'].map(t => (
              <button key={t} type="button" onClick={() => setType(t)} className={`px-6 py-2.5 rounded-xl font-semibold text-[10px] uppercase tracking-wider transition-all tap-press ${type === t ? 'bg-primary text-black' : 'bg-white/5 text-white/40 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>

          {(type === 'book' || type === 'manga') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="Title (optional)"
              />
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="input"
                placeholder="Author (optional)"
              />
              <input
                value={volumeNumber}
                onChange={(e) => setVolumeNumber(e.target.value)}
                className="input"
                placeholder="Volume Number (optional)"
              />
              <input
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                className="input"
                placeholder="Genres as tags (comma separated)"
              />
            </div>
          )}

          <label className="block group cursor-pointer">
            <div className={`aspect-video rounded-[1.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-6 ${status === 'uploading' ? 'border-primary/50 bg-primary/5' : 'border-white/15 hover:border-primary/40 hover:bg-white/[0.02]'}`}>
              {status === 'success' ? (
                <div className="text-center space-y-4 animate-in">
                  <CheckCircle2 size={64} className="text-primary mx-auto" />
                    <p className="text-2xl font-display text-white">Integration Complete</p>
                  </div>
                ) : status === 'error' ? (
                  <div className="text-center space-y-4 animate-in text-red-500">
                    <AlertCircle size={64} className="mx-auto" />
                    <p className="text-2xl font-display uppercase">Link Failure</p>
                  </div>
                ) : (
                <>
                  <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    {type === 'music' ? <FileAudio size={40} className="text-white/20" /> : <FileText size={40} className="text-white/20" />}
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-display text-white">
                      {files.length === 0 ? `Select ${type} artifact(s)` : `${files.length} file${files.length > 1 ? 's' : ''} selected`}
                    </p>
                    {files.length > 0 && (
                      <p className="text-xs text-white/60 mt-2 truncate max-w-[28rem] mx-auto">
                        {files.slice(0, 2).map((f) => f.name).join(' • ')}
                        {files.length > 2 ? ` • +${files.length - 2} more` : ''}
                      </p>
                    )}
                    <p className="tech-label mt-2">Max size: 500MB // Encrypted path</p>
                  </div>
                </>
              )}
            </div>
            <input type="file" multiple className="hidden" onChange={(e) => { setFiles(Array.from(e.target.files || [])); setStatus('idle'); setProgress(0); setUploadSummary(null); }} />
          </label>

          {status === 'success' && uploadSummary?.successCount !== undefined && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              Uploaded {uploadSummary.successCount} file{uploadSummary.successCount !== 1 ? 's' : ''}
              {uploadSummary.failedCount ? `, ${uploadSummary.failedCount} failed` : ''}.
            </div>
          )}

          <button 
            type="submit" 
            disabled={files.length === 0 || status === 'uploading'}
            className="w-full btn-primary btn-lg h-16 rounded-2xl uppercase tracking-wider disabled:opacity-20 justify-center tap-press"
          >
            <UploadIcon size={20} />
            {status === 'uploading' ? `Ingesting Data ${progress}%` : 'Commence Integration'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Upload;
