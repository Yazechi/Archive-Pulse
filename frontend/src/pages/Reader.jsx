import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ePub from 'epubjs';
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Settings,
  Minus,
  Plus,
  X,
  Menu,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music2,
  Highlighter,
  Trash2,
  Edit3,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import PdfPane from '../components/reader/PdfPane';
import { useMusic } from '../context/useMusic';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://127.0.0.1:5000';
const HIGHLIGHT_COLORS = ['#fde047', '#f97316', '#22c55e', '#38bdf8', '#a78bfa', '#fb7185'];

const ReaderMiniPlayer = () => {
  const { currentTrack, isPlaying, togglePlay, nextTrack, prevTrack, analyser, visualizerSettings } = useMusic();
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const primary = visualizerSettings?.primaryColor || '#22d3ee';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const data = new Uint8Array(128);
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (analyser) {
        analyser.getByteFrequencyData(data);
        const barCount = 24;
        const gap = 2;
        const bw = (w - gap * (barCount - 1)) / barCount;
        ctx.shadowBlur = 6;
        ctx.shadowColor = primary;
        for (let i = 0; i < barCount; i++) {
          const idx = Math.floor((i / barCount) * 48);
          const amp = (data[idx] / 255) * 0.9;
          const barH = Math.max(2, amp * h * 0.85);
          const x = i * (bw + gap);
          const y = (h - barH) / 2;
          const alpha = Math.floor((0.5 + amp * 0.5) * 255).toString(16).padStart(2, '0');
          ctx.fillStyle = `${primary}${alpha}`;
          ctx.beginPath();
          ctx.roundRect(x, y, bw, barH, 1);
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, primary]);

  const thumb = currentTrack?.thumbnail_url?.startsWith('http')
    ? currentTrack.thumbnail_url
    : currentTrack?.thumbnail_url
      ? `${API_BASE}${currentTrack.thumbnail_url}`
      : null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[400] flex items-center gap-3 bg-black/90 backdrop-blur-2xl border border-white/15 rounded-2xl px-3 py-2.5 shadow-2xl"
      style={{ boxShadow: `0 8px 32px ${primary}30, 0 0 0 1px ${primary}20` }}
    >
      <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/15 shrink-0 bg-white/5 flex items-center justify-center">
        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <Music2 size={18} className="text-white/40" />}
      </div>
      <div className="w-24 h-9 rounded-lg overflow-hidden border border-white/10" style={{ background: `linear-gradient(135deg, ${primary}15, transparent)` }}>
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      <div className="flex items-center gap-0.5">
        <button onClick={prevTrack} className="p-2 text-white/50 hover:text-white transition-colors"><SkipBack size={14} /></button>
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-all hover:scale-105"
          style={{ boxShadow: isPlaying ? `0 0 12px ${primary}40` : 'none' }}
        >
          {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
        </button>
        <button onClick={nextTrack} className="p-2 text-white/50 hover:text-white transition-colors"><SkipForward size={14} /></button>
      </div>
    </div>
  );
};

// Highlight Card with Notes
const HighlightCard = ({ highlight, bookId, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(highlight.note || '');
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    if (note === (highlight.note || '')) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/api/books/${bookId}/highlights/${highlight.id}`, { note });
      onUpdate({ note });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save note', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] text-white/70 line-clamp-3">{highlight.text_excerpt}</p>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className="text-white/40 hover:text-primary"
            title="Add note"
          >
            <MessageSquare size={12} />
          </button>
          <button onClick={onDelete} className="text-white/40 hover:text-red-400">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      
      {/* Note Section */}
      {(isEditing || highlight.note) && (
        <div className="pt-2 border-t border-white/10">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add your note..."
                className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-[10px] text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/50 resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button 
                  onClick={saveNote}
                  disabled={saving}
                  className="flex-1 text-[9px] py-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button 
                  onClick={() => { setIsEditing(false); setNote(highlight.note || ''); }}
                  className="flex-1 text-[9px] py-1.5 bg-white/5 text-white/50 rounded-lg hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-white/50 italic cursor-pointer hover:text-white/70" onClick={() => setIsEditing(true)}>
              {highlight.note}
            </p>
          )}
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm border border-white/20" style={{ backgroundColor: highlight.color || '#fde047' }} />
        <span className="text-[9px] text-white/40">{new Date(highlight.created_at).toLocaleDateString()}</span>
        {highlight.note && !isEditing && (
          <span className="text-[9px] text-primary/60 ml-auto">Has note</span>
        )}
      </div>
    </div>
  );
};

const clampProgress = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const Reader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { book: initialBook, chapter: initialChapter } = location.state || {};

  const [book, setBook] = useState(initialBook || null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [theme, setTheme] = useState('dark');
  const [toc, setToc] = useState([]);
  const [currentChapter, setCurrentChapter] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [readerDataLoaded, setReaderDataLoaded] = useState(false);

  const [epubLocation, setEpubLocation] = useState(undefined);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  const [highlights, setHighlights] = useState([]);
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0]);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [showHighlightsPanel, setShowHighlightsPanel] = useState(true);
  const [mangaChapters, setMangaChapters] = useState([]);
  const [loadingMangaChapters, setLoadingMangaChapters] = useState(false);
  const [mangaPages, setMangaPages] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);

  const readerRef = useRef(null);
  const renditionRef = useRef(null);
  const epubBookRef = useRef(null);
  const progressTimerRef = useRef(null);
  const latestProgressRef = useRef({});
  const tocRef = useRef(null);
  const appliedHighlightLocatorsRef = useRef(new Set());
  const pendingPreviewLocatorRef = useRef(null);

  const isEpub = Boolean(book?.source_url?.toLowerCase().endsWith('.epub'));
  const isPdf = Boolean(book?.source_url?.toLowerCase().endsWith('.pdf'));
  const isManga = book?.type === 'manga';
  const canHighlight = !isManga && (isEpub || isPdf);

  const themes = useMemo(() => ({
    light: { body: { background: '#ffffff', color: '#1a1a1a' } },
    sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
    dark: { body: { background: '#0d0d0d', color: '#e0e0e0' } },
  }), []);

  const bookUrl = useMemo(() => {
    if (!book?.source_url) return '';
    return book.source_url.startsWith('http')
      ? book.source_url
      : `${API_BASE}/uploads/books/${book.source_url}`;
  }, [book]);

  const persistProgress = (partial) => {
    if (!book?.id) return;
    latestProgressRef.current = { ...latestProgressRef.current, ...partial };
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(async () => {
      try {
        await axios.put(`${API_BASE}/api/books/${book.id}/progress`, latestProgressRef.current);
      } catch (err) {
        console.error('Failed to persist book progress', err);
      }
    }, 400);
  };

  // Reading session tracking
  const sessionIdRef = useRef(null);
  const startPageRef = useRef(null);

  useEffect(() => {
    // Start reading session when reader opens
    if (!book?.id || !readerDataLoaded) return;
    
    const startSession = async () => {
      try {
        const startPage = isPdf ? pageNumber : 0;
        startPageRef.current = startPage;
        const res = await axios.post(`${API_BASE}/api/reading-sessions/start`, {
          book_id: book.id,
          start_page: startPage
        });
        sessionIdRef.current = res.data.session_id;
        
        // Log activity
        axios.post(`${API_BASE}/api/activity`, {
          action_type: 'read',
          content_type: 'book',
          content_id: book.id,
          content_title: book.title,
          content_thumbnail: book.thumbnail_url
        }).catch(() => {});
      } catch (err) {
        console.error('Failed to start reading session', err);
      }
    };
    
    startSession();
    
    // End session on unmount
    return () => {
      if (sessionIdRef.current) {
        const endPage = isPdf ? pageNumber : 0;
        const pagesRead = Math.abs(endPage - (startPageRef.current || 0));
        axios.put(`${API_BASE}/api/reading-sessions/${sessionIdRef.current}/end`, {
          end_page: endPage,
          pages_read: pagesRead
        }).catch(() => {});
      }
    };
  }, [book?.id, readerDataLoaded]);

  useEffect(() => () => {
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
  }, []);

  useEffect(() => {
    if (!initialBook?.id) return;
    let mounted = true;
    const loadReaderData = async () => {
      try {
        const [bookRes, highlightRes] = await Promise.all([
          axios.get(`${API_BASE}/api/books/by-id/${initialBook.id}`),
          axios.get(`${API_BASE}/api/books/${initialBook.id}/highlights`),
        ]);
        if (!mounted) return;
        const freshBook = bookRes.data;
        setBook(freshBook);
        setHighlights(Array.isArray(highlightRes.data) ? highlightRes.data : []);
        setReadingProgress(clampProgress(freshBook.progress));
        if (freshBook.last_cfi) setEpubLocation(freshBook.last_cfi);
        if (freshBook.last_page && freshBook.type !== 'manga') {
          const savedPage = Number(freshBook.last_page);
          if (Number.isFinite(savedPage) && savedPage > 0) setPageNumber(Math.floor(savedPage));
        }
      } catch (err) {
        console.error('Failed to load reader data', err);
      } finally {
        if (mounted) setReaderDataLoaded(true);
      }
    };
    loadReaderData();
    return () => { mounted = false; };
  }, [initialBook?.id]);

  useEffect(() => {
    if (!isManga || !book?.source_url) return;
    const loadMangaChapters = async () => {
      try {
        setLoadingMangaChapters(true);
        const [localRes, onlineRes] = await Promise.all([
          axios.get(`${API_BASE}/api/manga/local/${book.source_url}/chapters`).catch(() => ({ data: [] })),
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(book.source_url)
            ? axios.get(`${API_BASE}/api/manga/${book.source_url}/chapters`).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] })
        ]);

        const localChapters = (Array.isArray(localRes.data) ? localRes.data : []).map((c) => ({ ...c, isLocal: true }));
        const onlineChapters = (Array.isArray(onlineRes.data) ? onlineRes.data : []).map((c) => ({ ...c, isLocal: false }));
        const chapters = [...onlineChapters, ...localChapters];
        setMangaChapters(chapters);

        setShowToc(false);

        // Resume to saved chapter or fallback to latest local chapter
        const savedChapterPath = (book.last_page || '').toString();
        const savedId = savedChapterPath.includes('/uploads/manga/')
          ? savedChapterPath.split('/').pop()
          : savedChapterPath || null;
        const targetChapter =
          chapters.find((c) => c.id === initialChapter?.id) ||
          chapters.find((c) => c.id === savedId) ||
          localChapters[localChapters.length - 1] ||
          onlineChapters[onlineChapters.length - 1] ||
          null;
        if (targetChapter) {
          await openMangaChapter(targetChapter, false, chapters);
        }
      } catch (err) {
        console.error('Failed to load manga chapters/pages', err);
      } finally {
        setLoadingMangaChapters(false);
      }
    };
    loadMangaChapters();
  }, [isManga, book?.source_url, book?.last_page, initialChapter?.id]);

  const openMangaChapter = useCallback(async (chapter, closeToc = true, chaptersArr = null) => {
    if (!book?.id || !chapter?.id) return;
    // Use passed chapters array or fall back to state
    const chaptersToUse = chaptersArr || mangaChapters;
    try {
      const endpoint = chapter.isLocal
        ? `${API_BASE}/api/manga/local/${book.source_url}/chapter/${encodeURIComponent(chapter.id)}/pages`
        : `${API_BASE}/api/manga/chapter/${encodeURIComponent(chapter.id)}/pages`;
      const pagesRes = await axios.get(endpoint);
      const pages = Array.isArray(pagesRes.data) ? pagesRes.data : [];
      setMangaPages(pages);
      const chapterTitle = chapter.title || `Chapter ${chapter.chapter || '?'}`;
      setCurrentChapter(chapterTitle);
      
      // Track chapter index for navigation
      const idx = chaptersToUse.findIndex(c => c.id === chapter.id);
      setCurrentChapterIndex(idx);
      
      if (closeToc) setShowToc(false);
      await axios.put(`${API_BASE}/api/books/${book.id}/progress`, {
        last_page: chapter.id,
        last_chapter_title: chapterTitle
      });
      
      // Log activity with chapter info
      await axios.post(`${API_BASE}/api/activity`, {
        action_type: 'read',
        content_type: 'book',
        content_id: book.id,
        content_title: `${book.title} - ${chapterTitle}`,
        content_thumbnail: book.thumbnail_url,
        metadata: { chapter: chapterTitle, chapter_id: chapter.id }
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to open manga chapter', err);
      toast.error('Failed to open chapter');
    }
  }, [book?.id, book?.source_url, book?.title, book?.thumbnail_url, mangaChapters, toast]);

  const goToNextChapter = useCallback(() => {
    if (currentChapterIndex < 0 || currentChapterIndex >= mangaChapters.length - 1) return;
    const nextChapter = mangaChapters[currentChapterIndex + 1];
    if (nextChapter) openMangaChapter(nextChapter);
  }, [currentChapterIndex, mangaChapters, openMangaChapter]);

  const goToPrevChapter = useCallback(() => {
    if (currentChapterIndex <= 0) return;
    const prevChapter = mangaChapters[currentChapterIndex - 1];
    if (prevChapter) openMangaChapter(prevChapter);
  }, [currentChapterIndex, mangaChapters, openMangaChapter]);

  const finishReading = useCallback(async () => {
    if (!book?.id) return;
    try {
      await axios.put(`${API_BASE}/api/books/${book.id}/progress`, {
        progress: 100,
        last_chapter_title: currentChapter || 'Completed'
      });
      toast.success('Reading marked as complete!');
      navigate('/books');
    } catch (err) {
      toast.error('Failed to mark as complete');
    }
  }, [book?.id, currentChapter, navigate, toast]);

  const hasPrevChapter = currentChapterIndex > 0;
  const hasNextChapter = currentChapterIndex >= 0 && currentChapterIndex < mangaChapters.length - 1;

  const applyRenditionTheme = useCallback(() => {
    if (!renditionRef.current) return;
    const selected = themes[theme];
    renditionRef.current.themes.register('reader-theme', {
      body: {
        background: `${selected.body.background} !important`,
        color: `${selected.body.color} !important`,
        'font-size': `${fontSize}% !important`,
        'line-height': '1.7 !important',
        'font-family': '"Inter", "Segoe UI", system-ui, sans-serif !important',
        padding: '24px 48px !important',
      },
    });
    renditionRef.current.themes.select('reader-theme');
  }, [fontSize, theme, themes]);

  useEffect(() => {
    if (!readerDataLoaded || !isEpub || !readerRef.current || !bookUrl) return undefined;

    let active = true;
    setLoadError(null);
    setIsReady(false);

    const epubBook = ePub(bookUrl, { openAs: 'epub' });
    const rendition = epubBook.renderTo(readerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'paginated',
      manager: 'default',
    });

    epubBookRef.current = epubBook;
    renditionRef.current = rendition;

    rendition.on('selected', (cfiRange, contents) => {
      const selectedText = contents?.window?.getSelection?.()?.toString()?.trim();
      if (selectedText) {
        setPendingSelection({ format: 'epub', locator: cfiRange, text: selectedText });
      }
      contents?.window?.getSelection?.()?.removeAllRanges?.();
    });

    rendition.on('relocated', (loc) => {
      if (!active) return;
      const cfi = loc?.start?.cfi;
      const chapterHref = loc?.start?.href;
      if (chapterHref) {
        const navItem = epubBook.navigation?.get(chapterHref);
        if (navItem?.label) setCurrentChapter(navItem.label);
      }
      if (!cfi) return;
      setEpubLocation(cfi);

      let pct = 0;
      if (typeof loc?.start?.percentage === 'number') {
        pct = loc.start.percentage * 100;
      } else if (epubBook.locations) {
        pct = epubBook.locations.percentageFromCfi(cfi) * 100;
      }
      const normalized = clampProgress(pct);
      setReadingProgress(normalized);
      persistProgress({
        progress: normalized,
        last_cfi: cfi,
        last_page: chapterHref || null,
      });
    });

    (async () => {
      try {
        await epubBook.ready;
        await epubBook.loaded.navigation.then((nav) => {
          if (active) setToc(nav?.toc || []);
        });
        await epubBook.locations.generate(1200);
        applyRenditionTheme();
        setIsReady(true);
        try {
          const resumeLocation = book?.last_cfi || epubLocation || undefined;
          await rendition.display(resumeLocation);
        } catch (err) {
          console.warn('Invalid saved location, opening first section', err);
          const first = epubBook.spine?.spineItems?.[0]?.href || undefined;
          await rendition.display(first);
        }
      } catch (err) {
        console.error('EPUB load error', err);
        if (active) setLoadError('Unable to render EPUB content');
      }
    })();

    return () => {
      active = false;
      try {
        rendition.destroy();
      } catch (err) {
        console.warn('Failed to destroy rendition cleanly', err);
      }
      try {
        epubBook.destroy();
      } catch (err) {
        console.warn('Failed to destroy epub instance cleanly', err);
      }
      renditionRef.current = null;
      epubBookRef.current = null;
    };
  }, [book?.last_cfi, bookUrl, isEpub, readerDataLoaded]);

  useEffect(() => {
    applyRenditionTheme();
  }, [applyRenditionTheme]);

  const removePendingPreview = useCallback(() => {
    if (!renditionRef.current || !pendingPreviewLocatorRef.current) return;
    try {
      renditionRef.current.annotations.remove(pendingPreviewLocatorRef.current, 'highlight');
    } catch (err) {
      console.warn('Failed removing preview highlight', err);
    }
    pendingPreviewLocatorRef.current = null;
  }, []);

  const syncEpubHighlights = useCallback(() => {
    if (!renditionRef.current || !isEpub) return;
    const rendition = renditionRef.current;
    const nextLocators = new Set(highlights.filter((h) => h.format === 'epub').map((h) => h.locator));

    for (const locator of appliedHighlightLocatorsRef.current) {
      if (!nextLocators.has(locator)) {
        try {
          rendition.annotations.remove(locator, 'highlight');
        } catch (err) {
          console.warn('Failed removing stale highlight', err);
        }
      }
    }

    highlights
      .filter((h) => h.format === 'epub')
      .forEach((h) => {
        try {
          rendition.annotations.highlight(
            h.locator,
            { id: h.id, text: h.text_excerpt },
            null,
            `reader-hl-${h.id}`,
            {
              fill: h.color || '#fde047',
              'fill-opacity': '0.35',
              'mix-blend-mode': 'multiply',
            }
          );
        } catch (err) {
          console.warn('Failed to apply highlight', err);
        }
      });

    appliedHighlightLocatorsRef.current = nextLocators;
  }, [highlights, isEpub]);

  useEffect(() => {
    syncEpubHighlights();
  }, [syncEpubHighlights]);

  useEffect(() => {
    const handleClick = (e) => {
      if (showToc && tocRef.current && !tocRef.current.contains(e.target)) {
        setShowToc(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showToc]);

  const handleProgressFromPdf = useCallback((nextPage, total) => {
    if (!book?.id || !total) return;
    const normalizedPage = Math.max(1, Math.min(total, nextPage));
    const pct = clampProgress((normalizedPage / total) * 100);
    setReadingProgress(pct);
    persistProgress({
      progress: pct,
      last_page: String(normalizedPage),
      total_pages: total,
      last_cfi: null,
    });
  }, [book?.id, persistProgress]);

  const goToTocItem = useCallback((href) => {
    if (!renditionRef.current) return;
    renditionRef.current.display(href);
    setShowToc(false);
  }, []);

  const goPrevPage = useCallback(() => {
    if (isEpub && renditionRef.current) {
      renditionRef.current.prev();
      return;
    }
    if (isPdf) {
      setPageNumber((v) => Math.max(1, v - 1));
    }
  }, [isEpub, isPdf]);

  const goNextPage = useCallback(() => {
    if (isEpub && renditionRef.current) {
      renditionRef.current.next();
      return;
    }
    if (isPdf) {
      setPageNumber((v) => Math.min(numPages || Number.MAX_SAFE_INTEGER, v + 1));
    }
  }, [isEpub, isPdf, numPages]);

  const addHighlight = useCallback(async () => {
    if (!book?.id || !pendingSelection || !canHighlight) return;
    const normalizedText = pendingSelection.text.trim().toLowerCase();
    const duplicate = highlights.some((h) =>
      h.format === pendingSelection.format && (h.locator === pendingSelection.locator || h.text_excerpt.trim().toLowerCase() === normalizedText)
    );
    if (duplicate) {
      toast.warning('This text is already highlighted');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/api/books/${book.id}/highlights`, {
        format: pendingSelection.format,
        locator: pendingSelection.locator,
        text_excerpt: pendingSelection.text.trim(),
        color: selectedColor,
      });
      const created = res.data;
      setHighlights((prev) => [created, ...prev]);
      removePendingPreview();
      setPendingSelection(null);
      toast.success('Highlight added');
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.warning('This text is already highlighted');
        return;
      }
      console.error('Failed to add highlight', err);
      toast.error('Failed to add highlight');
    }
  }, [book?.id, canHighlight, highlights, pendingSelection, removePendingPreview, selectedColor, toast]);

  const deleteHighlight = useCallback(async (highlightId) => {
    if (!book?.id) return;
    try {
      await axios.delete(`${API_BASE}/api/books/${book.id}/highlights/${highlightId}`);
      const existing = highlights.find((h) => h.id === highlightId);
      if (existing?.format === 'epub' && renditionRef.current) {
        try {
          renditionRef.current.annotations.remove(existing.locator, 'highlight');
        } catch (err) {
          console.warn('Failed to remove highlight annotation', err);
        }
      }
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      toast.success('Highlight removed');
    } catch (err) {
      console.error('Failed to remove highlight', err);
      toast.error('Failed to remove highlight');
    }
  }, [book?.id, highlights, toast]);

  useEffect(() => {
    if (!isEpub || !renditionRef.current || !pendingSelection?.locator) return;
    removePendingPreview();
    try {
      renditionRef.current.annotations.highlight(
        pendingSelection.locator,
        { id: 'pending', text: pendingSelection.text },
        null,
        'reader-hl-pending',
        {
          fill: selectedColor,
          'fill-opacity': '0.3',
          'mix-blend-mode': 'multiply',
        }
      );
      pendingPreviewLocatorRef.current = pendingSelection.locator;
    } catch (err) {
      console.warn('Failed to render pending preview highlight', err);
    }
  }, [isEpub, pendingSelection, removePendingPreview, selectedColor]);

  useEffect(() => {
    return () => {
      removePendingPreview();
      appliedHighlightLocatorsRef.current.clear();
    };
  }, [removePendingPreview]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevPage();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNextPage();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNextPage, goPrevPage]);

  if (!book) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-dark">
        <div className="text-center space-y-4">
          <p className="tech-label text-primary">No record loaded</p>
          <button onClick={() => navigate('/books')} className="btn-primary uppercase tracking-wider">Return to vault</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-bg-dark flex flex-col overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-mesh opacity-15" />

      <header className={`h-12 border-b border-white/5 flex items-center justify-between px-3 md:px-5 shrink-0 relative z-50 bg-bg-dark/95 backdrop-blur-xl transition-all duration-300 ${controlsVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/books')} className="btn-icon w-8 h-8"><ChevronLeft size={16} /></button>
          {(isEpub || isManga) && (
            <button onClick={() => setShowToc((v) => !v)} className={`btn-icon w-8 h-8 ${showToc ? 'bg-primary/20 border-primary/50' : ''}`}>
              <Menu size={14} />
            </button>
          )}
          <div className="h-4 w-px bg-white/10" />
          <div className="min-w-0">
            <h1 className="text-[11px] font-semibold text-white truncate max-w-[300px]">{book.title}</h1>
            <p className="text-[9px] text-white/40 truncate">{currentChapter || book.author || (isManga ? 'Manga' : isPdf ? 'PDF' : 'EPUB')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 min-w-[180px]">
              {isManga ? (
                <span className="text-[10px] font-mono text-primary truncate max-w-[180px]">
                  {currentChapter ? `Last: ${currentChapter}` : 'Last: none'}
                </span>
              ) : (
                <>
                  <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-primary shadow-[0_0_10px_var(--color-primary)]" style={{ width: `${readingProgress}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-primary w-10 text-right">{Math.round(readingProgress)}%</span>
                </>
              )}
            </div>
          {canHighlight && (
            <button
              onClick={() => setShowHighlightsPanel((v) => !v)}
              className={`btn-icon w-8 h-8 ${showHighlightsPanel ? 'bg-primary/20 border-primary/50 text-primary' : ''}`}
              title="Toggle highlights panel"
            >
              <Highlighter size={14} />
            </button>
          )}
          {isEpub && (
            <button onClick={() => setShowSettings((v) => !v)} className={`btn-icon w-8 h-8 ${showSettings ? 'bg-primary/20 border-primary/50' : ''}`}>
              <Settings size={14} />
            </button>
          )}
          <button
            onClick={() => {
              if (!document.fullscreenElement) document.documentElement.requestFullscreen();
              else document.exitFullscreen();
            }}
            className="btn-icon w-8 h-8"
          >
            <Maximize size={14} />
          </button>
        </div>
      </header>

      {(isEpub || isManga) && (
        <div
          ref={tocRef}
          className={`fixed left-0 top-12 bottom-0 w-64 z-[60] bg-surface/95 backdrop-blur-xl border-r border-white/10 transform transition-transform duration-300 overflow-hidden ${showToc ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="p-3 border-b border-white/10">
            <h2 className="text-xs font-semibold text-white">Contents</h2>
          </div>
          <div className="overflow-y-auto h-[calc(100%-48px)] custom-scrollbar">
            {isManga ? (
              loadingMangaChapters ? (
                <p className="px-3 py-2.5 text-[11px] text-white/60">Loading chapters...</p>
              ) : mangaChapters.length === 0 ? (
                <p className="px-3 py-2.5 text-[11px] text-white/60">No chapters found.</p>
              ) : (
                mangaChapters.map((chapter, i) => (
                  <button
                    key={`${chapter.id}-${i}`}
                    onClick={() => openMangaChapter(chapter)}
                    className="w-full text-left px-3 py-2.5 text-[11px] text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 truncate"
                  >
                    {(chapter.title || `Chapter ${chapter.chapter}`) + (chapter.isLocal ? ' (Local)' : '')}
                  </button>
                ))
              )
            ) : (
              toc.map((item, i) => (
                <button
                  key={`${item.href}-${i}`}
                  onClick={() => goToTocItem(item.href)}
                  className="w-full text-left px-3 py-2.5 text-[11px] text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 truncate"
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {isEpub && showSettings && (
        <div className="absolute top-14 right-3 z-[80] bg-surface/95 backdrop-blur-xl border border-white/15 rounded-lg p-3 shadow-2xl w-56">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-white">Settings</span>
            <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white"><X size={12} /></button>
          </div>
          <div className="mb-3">
            <span className="text-[9px] text-white/40 uppercase tracking-wider">Theme</span>
            <div className="flex gap-1.5 mt-1.5">
              {['light', 'sepia', 'dark'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-1 px-1.5 rounded-md border text-[10px] capitalize transition-all ${theme === t ? 'bg-primary/20 text-white border-primary/50' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[9px] text-white/40 uppercase tracking-wider">Font Size</span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <button onClick={() => setFontSize((v) => Math.max(70, v - 1))} className="btn-icon w-6 h-6"><Minus size={10} /></button>
              <div className="flex-1 text-center"><span className="text-white text-[11px] font-medium">{fontSize}%</span></div>
              <button onClick={() => setFontSize((v) => Math.min(170, v + 1))} className="btn-icon w-6 h-6"><Plus size={10} /></button>
            </div>
            <input
              type="range"
              min={70}
              max={170}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="mt-2 w-full accent-cyan-400"
            />
          </div>
        </div>
      )}

      <main
        className="flex-1 relative overflow-hidden"
        style={{ background: isEpub ? themes[theme].body.background : 'rgba(8,8,8,0.95)' }}
        onClick={() => setControlsVisible((v) => !v)}
      >
        {loadError ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-red-400 text-sm">{loadError}</p>
              <button onClick={() => navigate('/books')} className="btn-primary">Return to Library</button>
            </div>
          </div>
        ) : isEpub ? (
          <div className="h-full w-full relative" style={{ background: themes[theme].body.background }}>
            <div ref={readerRef} className="h-full w-full" />
            <div className="absolute left-4 right-4 bottom-6 z-[70] flex items-center justify-center gap-3 pointer-events-none">
              <button onClick={goPrevPage} className="btn-icon w-9 h-9 pointer-events-auto"><ChevronLeft size={14} /></button>
              <button onClick={goNextPage} className="btn-icon w-9 h-9 pointer-events-auto"><ChevronRight size={14} /></button>
            </div>
          </div>
        ) : isManga ? (
          <div className="h-full w-full overflow-auto bg-[#080b13] custom-scrollbar px-4 py-6">
            {mangaPages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">
                {loadingMangaChapters ? 'Loading manga pages...' : 'No chapter selected. Open the chapter list.'}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4 pb-24">
                {mangaPages.map((page, idx) => (
                  <img
                    key={`${currentChapter || 'chapter'}-${idx}`}
                    src={page}
                    alt={`Manga page ${idx + 1}`}
                    className="w-full object-contain rounded-lg border border-white/10"
                  />
                ))}
                
                {/* Chapter Navigation Footer */}
                <div className="flex items-center justify-center gap-3 py-8 border-t border-white/10 mt-8">
                  <button
                    onClick={(e) => { e.stopPropagation(); goToPrevChapter(); }}
                    disabled={!hasPrevChapter}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      hasPrevChapter 
                        ? 'bg-white/10 hover:bg-white/20 border-white/20' 
                        : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    <SkipBack size={16} />
                    <span className="text-sm font-medium">Previous</span>
                  </button>
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); finishReading(); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/80 hover:bg-green-600 text-white transition-colors"
                  >
                    <CheckCircle size={16} />
                    <span className="text-sm font-medium">Complete</span>
                  </button>
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); goToNextChapter(); }}
                    disabled={!hasNextChapter}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      hasNextChapter 
                        ? 'bg-primary/80 hover:bg-primary text-black' 
                        : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-sm font-medium">Next</span>
                    <SkipForward size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <PdfPane
            bookUrl={bookUrl}
            pageNumber={pageNumber}
            numPages={numPages}
            setNumPages={setNumPages}
            setPageNumber={setPageNumber}
            controlsVisible={controlsVisible}
            setControlsVisible={setControlsVisible}
            highlights={highlights.filter((h) => h.format === 'pdf')}
            onProgress={handleProgressFromPdf}
            onSelection={(selection) => setPendingSelection(selection)}
            isManga={isManga}
          />
        )}

        {(isEpub || isPdf) && !isManga && (
          <>
            <button
              type="button"
              aria-label="Previous page"
              className="absolute left-0 top-0 bottom-0 w-[12%] z-[55] bg-transparent cursor-w-resize"
              onClick={(e) => {
                e.stopPropagation();
                goPrevPage();
              }}
            />
            <button
              type="button"
              aria-label="Next page"
              className="absolute right-0 top-0 bottom-0 w-[12%] z-[55] bg-transparent cursor-e-resize"
              onClick={(e) => {
                e.stopPropagation();
                goNextPage();
              }}
            />
          </>
        )}
      </main>

      {canHighlight && showHighlightsPanel && (
        <section className="absolute top-14 right-3 z-[90] w-80 rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl p-3 space-y-3 max-h-[70vh] overflow-hidden">
          <div className="flex items-center gap-2">
            <Highlighter size={14} className="text-primary" />
            <p className="text-[11px] font-semibold text-white uppercase tracking-wider">Annotations</p>
            <button onClick={() => setShowHighlightsPanel(false)} className="ml-auto text-white/50 hover:text-white" title="Close highlights"><X size={12} /></button>
          </div>

          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`w-6 h-6 rounded-md border ${selectedColor === c ? 'border-white' : 'border-white/20'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          <button
            onClick={addHighlight}
            disabled={!pendingSelection}
            className={`w-full text-[11px] py-2 rounded-lg border ${pendingSelection ? 'border-primary/50 bg-primary/15 text-primary hover:bg-primary/20' : 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'}`}
          >
            {pendingSelection ? 'Add selected text' : 'Select text in reader first'}
          </button>

          <div className="space-y-2 overflow-y-auto max-h-[45vh] custom-scrollbar pr-1">
            {highlights
              .filter((h) => h.format === (isEpub ? 'epub' : 'pdf'))
              .map((h) => (
                <HighlightCard 
                  key={h.id} 
                  highlight={h} 
                  bookId={book.id}
                  onDelete={() => deleteHighlight(h.id)}
                  onUpdate={(updated) => setHighlights(prev => prev.map(item => item.id === h.id ? { ...item, ...updated } : item))}
                />
              ))}
          </div>
        </section>
      )}

      <ReaderMiniPlayer />
      <div className="md:hidden absolute bottom-20 left-4 right-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${readingProgress}%` }} />
      </div>
      {isEpub && !isReady && !loadError && (
        <div className="absolute inset-0 z-[95] grid place-items-center pointer-events-none">
          <p className="text-xs text-primary">Loading EPUB...</p>
        </div>
      )}
    </div>
  );
};

export default Reader;
