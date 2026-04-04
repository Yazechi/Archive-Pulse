import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, BookOpen, Download, Loader2, CheckCircle, Cloud, HardDrive } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://127.0.0.1:5000';
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MangaChapters = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const book = state?.book || null;
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingChapters, setDownloadingChapters] = useState(new Set());
  const [downloadedChapters, setDownloadedChapters] = useState(new Set());
  const [queuedChapters, setQueuedChapters] = useState(new Set());

  useEffect(() => {
    if (!book || book.type !== 'manga') {
      navigate('/books');
      return;
    }

    const loadChapters = async () => {
      try {
        const [localRes, onlineRes, downloadsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/manga/local/${book.source_url}/chapters`).catch(() => ({ data: [] })),
          uuidRegex.test(book.source_url)
            ? axios.get(`${API_BASE}/api/manga/${book.source_url}/chapters`).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          axios.get(`${API_BASE}/api/downloads`).catch(() => ({ data: [] }))
        ]);
        const local = (Array.isArray(localRes.data) ? localRes.data : []).map((c) => ({ ...c, isLocal: true }));
        const online = (Array.isArray(onlineRes.data) ? onlineRes.data : []).map((c) => ({ ...c, isLocal: false }));
        
        // Track which chapters are already downloaded locally
        const localChapterNums = new Set(local.map(c => c.chapter?.toString()));
        setDownloadedChapters(localChapterNums);
        
        // Track which chapters are queued/downloading
        const downloads = Array.isArray(downloadsRes.data) ? downloadsRes.data : [];
        const queued = new Set(
          downloads
            .filter(d => d.content_type === 'manga_chapter' && (d.status === 'pending' || d.status === 'downloading'))
            .map(d => d.content_id)
        );
        setQueuedChapters(queued);
        
        setChapters([...online, ...local]);
      } catch (err) {
        toast.error('Failed to load chapter list');
      } finally {
        setLoading(false);
      }
    };

    loadChapters();
  }, [book, navigate, toast]);

  const openChapter = (chapter) => {
    navigate('/reader', { state: { book, chapter } });
  };

  const downloadChapter = async (chapter, e) => {
    e.stopPropagation();
    if (chapter.isLocal || downloadingChapters.has(chapter.id)) return;
    
    setDownloadingChapters(prev => new Set([...prev, chapter.id]));
    
    try {
      // Queue the download instead of downloading directly
      const res = await axios.post(`${API_BASE}/api/downloads/queue`, {
        content_type: 'manga_chapter',
        content_id: chapter.id,
        title: chapter.title || `Chapter ${chapter.chapter}`,
        parent_title: book.title,
        parent_id: book.source_url,
        thumbnail_url: book.thumbnail_url,
        metadata: {
          mangaId: book.source_url,
          chapterNum: chapter.chapter,
          thumbnailUrl: book.thumbnail_url
        }
      });
      
      toast.success(`Added to download queue! View progress in Downloads page.`);
      
      // Trigger processing
      axios.post(`${API_BASE}/api/downloads/process`).catch(() => {});
      
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to queue download';
      if (msg === 'Already downloaded') {
        setDownloadedChapters(prev => new Set([...prev, chapter.chapter?.toString()]));
      }
      toast.error(msg);
    } finally {
      setDownloadingChapters(prev => {
        const newSet = new Set(prev);
        newSet.delete(chapter.id);
        return newSet;
      });
    }
  };

  if (!book) return null;

  return (
    <div className="page-shell">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/books')} className="btn-icon w-9 h-9">
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="heading-md">{book.title}</h1>
            <p className="tech-label-sm">Select chapter before opening reader</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {queuedChapters.size > 0 && (
            <button 
              onClick={() => navigate('/downloads')} 
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Loader2 size={14} className="animate-spin" />
              <span>{queuedChapters.size} downloading</span>
            </button>
          )}
          <span className="tech-label">{chapters.length} Chapters</span>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center tech-label">Loading chapters...</div>
      ) : chapters.length === 0 ? (
        <div className="py-20 text-center tech-label">No chapters found.</div>
      ) : (
        <div className="section-card divide-y divide-white/5">
          {chapters.map((chapter, index) => {
            const isDownloading = downloadingChapters.has(chapter.id);
            const isQueued = queuedChapters.has(chapter.id);
            const isDownloaded = chapter.isLocal || downloadedChapters.has(chapter.chapter?.toString());
            const chapterTitle = chapter.title || `Chapter ${chapter.chapter || '?'}`;
            
            return (
              <div
                key={`${chapter.id}-${index}`}
                className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group"
              >
                <button
                  onClick={() => openChapter(chapter)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  {/* Source indicator */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    chapter.isLocal ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'
                  }`}>
                    {chapter.isLocal ? <HardDrive size={14} /> : <Cloud size={14} />}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{chapterTitle}</p>
                    <div className="flex items-center gap-2">
                      <span className={`tech-label-sm ${chapter.isLocal ? 'text-green-400/70' : 'text-blue-400/70'}`}>
                        {chapter.isLocal ? 'Local archive' : 'Online (MangaDex)'}
                      </span>
                      {isQueued && !isDownloading && (
                        <span className="text-[10px] text-yellow-400 font-medium">Queued</span>
                      )}
                      {chapter.justDownloaded && (
                        <span className="text-[10px] text-primary font-medium">Just downloaded</span>
                      )}
                    </div>
                  </div>
                </button>
                
                <div className="flex items-center gap-2">
                  {/* Download button for online chapters */}
                  {!chapter.isLocal && (
                    <button
                      onClick={(e) => downloadChapter(chapter, e)}
                      disabled={isDownloading || isDownloaded || isQueued}
                      className={`p-2 rounded-lg transition-all ${
                        isDownloading || isQueued
                          ? 'bg-primary/20 text-primary cursor-wait'
                          : isDownloaded
                          ? 'bg-green-600/20 text-green-400 cursor-default'
                          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white opacity-0 group-hover:opacity-100'
                      }`}
                      title={isDownloaded ? 'Already downloaded' : isQueued ? 'In download queue' : isDownloading ? 'Adding to queue...' : 'Download chapter'}
                    >
                      {isDownloading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isQueued ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isDownloaded ? (
                        <CheckCircle size={16} />
                      ) : (
                        <Download size={16} />
                      )}
                    </button>
                  )}
                  
                  {/* Read button */}
                  <button
                    onClick={() => openChapter(chapter)}
                    className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Read chapter"
                  >
                    <BookOpen size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MangaChapters;
