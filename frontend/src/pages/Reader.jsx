import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
const PdfPane = lazy(() => import('../components/reader/PdfPane'));

const API_BASE = 'http://127.0.0.1:5000';

/* ─────────────────────────────────────────────────────────────────────────────
   THE ARCHIVE · Reader
───────────────────────────────────────────────────────────────────────────── */

const THEMES = {
  dark:  { bg: '#050505', text: '#e5e2e1', label: 'Dark' },
  light: { bg: '#fafafa', text: '#1a1a1a', label: 'Light' },
  sepia: { bg: '#f4ecd8', text: '#5b4636', label: 'Sepia' }
};

const Reader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const book = location.state?.book;
  const expandedGroupId = location.state?.expandedGroupId;

  /* ── epub state ── */
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  const epubFactoryRef = useRef(null);
  const zipLibRef = useRef(null);
  const [epubLocation, setEpubLocation] = useState(null);
  const [toc, setToc] = useState([]);
  
  /* ── manga state ── */
  const [mangaPages, setMangaPages] = useState([]);
  const [mangaChapters, setMangaChapters] = useState([]);
  const [onlineChapters, setOnlineChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [downloadingChapter, setDownloadingChapter] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  /* ── pdf state ── */
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  /* ── ui state ── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fontSize, setFontSize] = useState(110);
  const [theme, setTheme] = useState('dark');
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  // Manga specific UI state
  const [mangaMode, setMangaMode] = useState('vertical'); // 'vertical' or 'rtl'
  const [currentPage, setCurrentPage] = useState(0);

  const isManga = book?.type === 'manga';
  const isEpub = book && !isManga && (book.source_url || '').toLowerCase().endsWith('.epub');
  const bookUrl = book ? (book.source === 'local' ? `${API_BASE}/uploads/books/${book.source_url}` : book.source_url) : null;

  /* ──────────────────────────────────────────────────────
     Auto-hide controls
  ────────────────────────────────────────────────────── */
  useEffect(() => {
    let timeout;
    const handleMouseMove = () => {
      setControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!showSettings && !showToc) setControlsVisible(false);
      }, 3500);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [showSettings, showToc]);

  /* ──────────────────────────────────────────────────────
     Progress save
  ────────────────────────────────────────────────────── */
  const saveProgress = async (cfi, progressPercentage) => {
    if (!book?.id || book.source !== 'local') return;
    try { 
      const payload = { last_cfi: cfi };
      if (progressPercentage !== undefined) {
        payload.progress = Math.round(progressPercentage * 100);
      }
      await axios.put(`${API_BASE}/api/books/${book.id}/progress`, payload); 
    }
    catch { /* silent */ }
  };

  /* ──────────────────────────────────────────────────────
     EPUB Theme Application
  ────────────────────────────────────────────────────── */
  const applyRenditionStyles = useCallback(() => {
    if (!renditionRef.current) return;
    const r = renditionRef.current;
    const active = THEMES[theme];

    console.log("Applying theme:", theme, active);

    r.themes.register(theme, {
      body: {
        background: `${active.bg} !important`,
        color: `${active.text} !important`,
        'font-family': "'Lora', serif !important",
        'line-height': '1.8 !important',
        padding: '2rem 10vw !important',
      },
      'p, h1, h2, h3, h4, h5, h6, span, div, li, a': {
        color: `${active.text} !important`,
        background: 'transparent !important',
      }
    });
    r.themes.select(theme);
    r.themes.fontSize(`${fontSize}%`);
    
    // Force direct styling for stubborn epubs
    try {
      const contents = r.getContents();
      if (contents && contents.length > 0) {
        contents.forEach(content => {
          content.addStylesheetRules({
            'body': {
              'background': `${active.bg} !important`,
              'color': `${active.text} !important`,
            },
            'p, span, div, h1, h2, h3, h4, h5, h6, li, a': {
              'color': `${active.text} !important`,
              'background': 'transparent !important',
            }
          });
        });
      }
    } catch (e) { console.error("Style injection error:", e); }
  }, [theme, fontSize]);

  /* ──────────────────────────────────────────────────────
     EPUB Initialization
  ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isEpub || !bookUrl || !viewerRef.current) return;

    console.log("Initializing EPUB:", bookUrl);
    setLoading(true);
    setError(null);

    const cfi = book.last_cfi?.includes('/') ? book.last_cfi : null;
    let epubBook;
    let cancelled = false;
    
    try {
      (async () => {
        if (!epubFactoryRef.current) {
          const mod = await import('epubjs');
          epubFactoryRef.current = mod.default;
        }
        if (cancelled) return;

        const createEpub = epubFactoryRef.current;
        epubBook = createEpub(bookUrl);
        bookRef.current = epubBook;

        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          manager: 'continuous',
          flow: 'paginated',
          snap: true
        });
        renditionRef.current = rendition;

        applyRenditionStyles();

        rendition.hooks.content.register(() => {
          applyRenditionStyles();
        });

        epubBook.ready.then(() => epubBook.locations.generate(1600)).catch(err => {
          console.error('EPUB Ready Error:', err);
        });

        rendition.display(cfi || undefined).then(() => {
          if (!cancelled) setLoading(false);
        }).catch(err => {
          console.error('EPUB Display Error:', err);
          if (!cancelled) {
            setError(`Failed to render manuscript: ${err.message || 'Unknown error'}`);
            setLoading(false);
          }
        });

        epubBook.loaded.navigation.then(({ toc }) => {
          if (!cancelled) setToc(toc);
        });

        rendition.on('relocated', (location) => {
          let percentage = 0;
          if (epubBook.locations.length() > 0) {
            percentage = epubBook.locations.percentageFromCfi(location.start.cfi);
            if (percentage < 0.01 && location.atEnd) percentage = 1;
          }
          saveProgress(location.start.cfi, percentage);
        });

        const handleKeys = (e) => {
          if (e.key === 'ArrowLeft') rendition.prev();
          if (e.key === 'ArrowRight') rendition.next();
        };
        rendition.on('keyup', handleKeys);
        document.addEventListener('keyup', handleKeys);

        const cleanup = () => {
          try { epubBook.destroy(); } catch (_e) {}
          if (viewerRef.current) viewerRef.current.innerHTML = '';
          document.removeEventListener('keyup', handleKeys);
        };
        if (cancelled) cleanup();
      })();
    } catch (err) {
      console.error("EPUB Init Exception:", err);
      setError(`EPUB Engine Error: ${err.message}`);
      setLoading(false);
    }
    return () => {
      cancelled = true;
      try { epubBook?.destroy(); } catch (_e) {}
      if (viewerRef.current) viewerRef.current.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEpub, bookUrl]);

  // Update styles dynamically on theme or font size change
  useEffect(() => {
    if (renditionRef.current) applyRenditionStyles();
  }, [theme, fontSize, applyRenditionStyles]);

  /* ──────────────────────────────────────────────────────
     Manga Logic
  ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (isManga) {
      const fetchManga = async () => {
        setLoading(true);
        try {
          const [localRes, onlineRes] = await Promise.allSettled([
            axios.get(`${API_BASE}/api/manga/local/${book.source_url}/chapters`),
            axios.get(`${API_BASE}/api/manga/${book.source_url}/chapters`),
          ]);
          let localChapters = [];
          if (localRes.status === 'fulfilled') {
             localChapters = localRes.value.data;
             setMangaChapters(localChapters);
          }
          if (onlineRes.status === 'fulfilled') {
            const downloadedChapterNums = new Set(localChapters.map(c => String(c.chapter)));
            const availableOnline = onlineRes.value.data.filter(ch => !downloadedChapterNums.has(String(ch.chapter)));
            setOnlineChapters(availableOnline);
          }
        } catch (err) {
          setError(`Manga index error: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      fetchManga();
    }
  }, [isManga, book]);

  useEffect(() => {
    const handleMangaKeys = (e) => {
      if (isManga && mangaPages.length > 0 && mangaMode === 'rtl') {
        if (e.key === 'ArrowRight') {
          // Next page in RTL
          setCurrentPage(p => Math.min(mangaPages.length - 1, p + 1));
        } else if (e.key === 'ArrowLeft') {
          // Previous page in RTL
          setCurrentPage(p => Math.max(0, p - 1));
        }
      } else if (!isManga && !isEpub && numPages) {
        if (e.key === 'ArrowLeft') {
          setPageNumber(p => Math.max(1, p - 1));
        } else if (e.key === 'ArrowRight') {
          setPageNumber(p => Math.min(numPages, p + 1));
        }
      }
    };
    document.addEventListener('keyup', handleMangaKeys);
    return () => document.removeEventListener('keyup', handleMangaKeys);
  }, [isManga, mangaPages, mangaMode, isEpub, numPages]);

  const loadCbz = async (url) => {
    setLoading(true);
    setCurrentPage(0);
    try {
      if (!zipLibRef.current) {
        const mod = await import('jszip');
        zipLibRef.current = mod.default;
      }
      const res = await fetch(url);
      const zip = await zipLibRef.current.loadAsync(await res.arrayBuffer());
      const files = Object.values(zip.files)
        .filter(f => !f.dir && /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const urls = await Promise.all(files.map(async f => URL.createObjectURL(await f.async('blob'))));
      setMangaPages(urls);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const downloadChapter = async (ch) => {
    if (downloadingChapter === ch.id || mangaChapters.some(c => String(c.chapter) === String(ch.chapter))) {
      alert('This chapter is already in your local archive or is currently downloading.');
      return;
    }

    setDownloadingChapter(ch.id);
    setDownloadProgress(10);
    
    // Fake progress interval for better UX since server doesn't report streaming progress for ZIP
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 5;
      });
    }, 800);

    try {
      await axios.post(`${API_BASE}/api/manga/chapter/${ch.id}/download`, {
        mangaId: book.source_url,
        mangaTitle: book.title,
        chapterTitle: ch.title,
        chapterNum: ch.chapter,
        thumbnailUrl: book.thumbnail_url
      });
      
      clearInterval(interval);
      setDownloadProgress(100);
      
      // Refresh chapters
      const localRes = await axios.get(`${API_BASE}/api/manga/local/${book.source_url}/chapters`);
      setMangaChapters(localRes.data);
      const downloadedChapterNums = new Set(localRes.data.map(c => String(c.chapter)));
      setOnlineChapters(prev => prev.filter(item => !downloadedChapterNums.has(String(item.chapter))));
      
      setTimeout(() => {
        setDownloadingChapter(null);
        setDownloadProgress(0);
        alert(`Download Finished: Chapter ${ch.chapter} has been integrated into your archive.`);
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setDownloadingChapter(null);
      setDownloadProgress(0);
      setTimeout(() => alert(`Download failed: ${err.response?.data?.error || err.message}`), 500);
    }
  };

  const handleChapterSelect = (ch, isOnline = false) => {
    setSelectedChapter(ch);
    if (ch.chapter && ch.chapter !== 'Unknown') {
      axios.put(`${API_BASE}/api/books/${book.id}/progress`, {
        last_page: ch.chapter,
        progress: 100 
      }).catch(() => {});
    }

    if (isOnline) {
      setLoading(true);
      setCurrentPage(0);
      axios.get(`${API_BASE}/api/manga/chapter/${ch.id}/pages`)
        .then(res => setMangaPages(res.data))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      loadCbz(`${API_BASE}/uploads/manga/${book.source_url}/${ch.id}`);
    }
  };

  const handleMangaClick = (e) => {
    if (mangaMode === 'vertical') {
      setControlsVisible(!controlsVisible);
      return;
    }
    
    // RTL navigation
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    
    if (x > third * 2) {
      // Clicked right side -> Next page
      if (currentPage < mangaPages.length - 1) setCurrentPage(currentPage + 1);
    } else if (x < third) {
      // Clicked left side -> Prev page
      if (currentPage > 0) setCurrentPage(currentPage - 1);
    } else {
      // Clicked middle -> Toggle controls
      setControlsVisible(!controlsVisible);
    }
  };

  const cacheForOffline = async () => {
    if (!selectedChapter && !isEpub && !numPages) return;
    try {
      if (isManga && selectedChapter) {
        // Find next few chapters
        const currentIndex = mangaChapters.findIndex(c => c.id === selectedChapter.id);
        const chaptersToCache = mangaChapters.slice(currentIndex, currentIndex + 3);
        const urlsToCache = [];
        
        for (const ch of chaptersToCache) {
          urlsToCache.push(`${API_BASE}/uploads/manga/${book.source_url}/${ch.id}`);
        }
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_URLS',
            urls: urlsToCache
          });
          alert('Caching next 3 chapters for offline reading.');
        } else {
          alert('Offline caching not available.');
        }
      }
    } catch (err) {
      console.error('Caching failed', err);
    }
  };

  if (!book) return (
    <div className="fixed inset-0 z-[100] bg-[#050505] flex items-center justify-center text-white font-headline italic text-2xl">
      No manuscript selected
    </div>
  );

  const wrapperBg = isEpub ? THEMES[theme].bg : '#050505';

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col font-body overflow-hidden selection:bg-primary/30 transition-colors duration-500"
      style={{ backgroundColor: wrapperBg }}
    >
      
      {/* ── TOP BAR ── */}
      <div 
        className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/90 to-transparent z-50 transition-transform duration-500 flex items-start pt-6 px-6 md:px-10 text-white ${controlsVisible ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => {
                if (expandedGroupId) {
                  navigate('/books', { state: { expandedGroupId } });
                } else {
                  navigate(-1);
                }
              }}
              className="w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all backdrop-blur-md text-white"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-outline/60 block mb-1">
                {isManga ? 'Manga Reader' : 'Manuscript Reader'}
              </span>
              <h1 className="font-headline italic text-2xl tracking-tight leading-none text-white drop-shadow-lg max-w-sm md:max-w-xl truncate">
                {book.title}
              </h1>
              {selectedChapter && <p className="text-xs text-primary font-bold mt-1">CH. {selectedChapter.chapter} — {selectedChapter.title}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isManga && selectedChapter && selectedChapter.isLocal !== true && (
              <button 
                onClick={() => downloadChapter(selectedChapter)}
                disabled={downloadingChapter === selectedChapter.id}
                className="w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white hover:text-black flex items-center justify-center transition-all backdrop-blur-md text-white disabled:opacity-50"
                title="Download to Local Archive"
              >
                <span className={`material-symbols-outlined text-lg ${downloadingChapter === selectedChapter.id ? 'animate-spin' : ''}`}>
                  {downloadingChapter === selectedChapter.id ? 'sync' : 'download'}
                </span>
              </button>
            )}
            {isManga && selectedChapter && (
              <button 
                onClick={cacheForOffline}
                className="w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all backdrop-blur-md text-white"
                title="Cache Next 3 Chapters for Offline"
              >
                <span className="material-symbols-outlined text-lg">offline_pin</span>
              </button>
            )}
            {isManga && (
              <button 
                onClick={() => { setMangaPages([]); setSelectedChapter(null); }}
                className="w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all backdrop-blur-md text-white"
              >
                <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
              </button>
            )}
            {!isManga && toc.length > 0 && (
              <button 
                onClick={() => { setShowToc(!showToc); setShowSettings(false); }}
                className={`w-12 h-12 rounded-full border transition-all flex items-center justify-center backdrop-blur-md text-white ${showToc ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
              >
                <span className="material-symbols-outlined text-lg">toc</span>
              </button>
            )}
            <button 
              onClick={() => { setShowSettings(!showSettings); setShowToc(false); }}
              className={`w-12 h-12 rounded-full border transition-all flex items-center justify-center backdrop-blur-md text-white ${showSettings ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <span className="material-symbols-outlined text-lg">tune</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 relative w-full h-full">
        
        {loading && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#050505] text-white">
            <div className="w-16 h-16 border border-white/10 border-t-primary rounded-full animate-spin mb-6"></div>
            <p className="font-headline italic text-xl text-outline animate-pulse">Initializing manuscript...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#050505] px-6 text-center text-white">
            <span className="material-symbols-outlined text-6xl text-error mb-4 opacity-50">warning</span>
            <p className="font-headline italic text-2xl text-white mb-2">Render Failure</p>
            <p className="text-outline text-sm max-w-md mb-8">{error}</p>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white/10 rounded-full hover:bg-white/20 transition-all font-bold tracking-widest uppercase text-xs">
              Retry Connection
            </button>
          </div>
        )}

        {/* EPUB Render Area */}
        {!error && !isManga && isEpub && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
             <div className="absolute left-0 top-0 bottom-0 w-[15%] md:w-1/4 z-30 cursor-pointer" onClick={() => renditionRef.current?.prev()} />
             <div ref={viewerRef} className="w-full h-full max-w-[1200px] mx-auto transition-opacity duration-500" style={{ opacity: loading ? 0 : 1 }} />
             <div className="absolute right-0 top-0 bottom-0 w-[15%] md:w-1/4 z-30 cursor-pointer" onClick={() => renditionRef.current?.next()} />
          </div>
        )}

        {/* PDF Render Area */}
        {!error && !isManga && !isEpub && (
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-white/40">Loading PDF module...</div>}>
            <PdfPane
              bookUrl={bookUrl}
              pageNumber={pageNumber}
              numPages={numPages}
              setNumPages={setNumPages}
              setPageNumber={setPageNumber}
              controlsVisible={controlsVisible}
              setControlsVisible={setControlsVisible}
            />
          </Suspense>
        )}

        {/* Manga Render Area */}
        {!error && isManga && (
          <div 
            className={`absolute inset-0 w-full h-full ${mangaMode === 'vertical' ? 'overflow-y-auto scroll-smooth no-scrollbar pt-24 pb-12' : 'flex items-center justify-center bg-[#0a0a0a]'}`} 
            onClick={handleMangaClick}
          >
            {mangaPages.length > 0 ? (
              mangaMode === 'vertical' ? (
                <div className="flex flex-col items-center max-w-5xl mx-auto gap-2">
                  {mangaPages.map((p, i) => (
                    <img key={i} src={p} alt={`Page ${i + 1}`} loading="lazy" className="w-full h-auto object-contain bg-[#0a0a0a]" />
                  ))}
                  <div className="py-32 flex flex-col items-center">
                    <button 
                      onClick={() => { setMangaPages([]); setSelectedChapter(null); }}
                      className="px-10 py-4 bg-white/5 border border-white/10 rounded-full font-bold uppercase tracking-[0.2em] text-xs hover:bg-white/10 transition-all text-white"
                    >
                      Return to Chapter List
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full relative flex items-center justify-center select-none">
                   <img src={mangaPages[currentPage]} alt={`Page ${currentPage + 1}`} className="max-w-full max-h-full object-contain" />
                   
                   {/* RTL Page Indicator */}
                   {controlsVisible && (
                     <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-6 py-3 rounded-full text-white text-xs font-bold tracking-widest uppercase z-50">
                       {currentPage + 1} / {mangaPages.length}
                     </div>
                   )}
                </div>
              )
            ) : (
              <div className="max-w-4xl mx-auto px-6 pt-10 text-white w-full">
                <div className="grid gap-4">
                  {mangaChapters.map(ch => (
                    <div key={ch.id} onClick={() => handleChapterSelect(ch, false)} className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-primary/30 hover:bg-white/[0.04] transition-all cursor-pointer group">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 block">Local Archive</span>
                        <p className="font-headline text-xl text-white group-hover:text-primary transition-colors">CH. {ch.chapter} — {ch.title}</p>
                      </div>
                      <span className="material-symbols-outlined text-3xl opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-primary">arrow_forward</span>
                    </div>
                  ))}
                  {onlineChapters.map(ch => (
                    <div key={ch.id} className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/20 hover:bg-white/[0.04] transition-all group">
                      <div onClick={() => handleChapterSelect(ch, true)} className="flex-1 cursor-pointer">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1 block">Online Source</span>
                        <p className="font-headline text-xl text-outline group-hover:text-white transition-colors">CH. {ch.chapter} — {ch.title}</p>
                      </div>
                      <div className="flex gap-4 items-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); downloadChapter(ch); }}
                          disabled={downloadingChapter === ch.id}
                          className="w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white hover:text-black flex items-center justify-center transition-all backdrop-blur-md text-white disabled:opacity-50"
                          title="Download to Archive"
                        >
                          <span className={`material-symbols-outlined text-xl ${downloadingChapter === ch.id ? 'animate-spin' : ''}`}>
                            {downloadingChapter === ch.id ? 'sync' : 'cloud_download'}
                          </span>
                        </button>
                        <span onClick={() => handleChapterSelect(ch, true)} className="material-symbols-outlined text-3xl opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-white cursor-pointer">arrow_forward</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── OVERLAYS ── */}
      {showToc && (
        <div className="absolute top-28 right-6 w-80 max-h-[60vh] bg-[#111]/90 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl z-50 animate-fade-in text-white">
          <div className="p-5 border-b border-white/5">
            <h3 className="font-headline italic text-xl">Index</h3>
          </div>
          <div className="overflow-y-auto p-3 no-scrollbar space-y-1">
            {toc.map((item, i) => (
              <button 
                key={i} 
                onClick={() => { 
                  renditionRef.current?.display(item.href);
                  setShowToc(false);
                }} 
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 text-sm font-body text-outline hover:text-white transition-colors truncate"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute top-28 right-6 w-72 bg-[#111]/90 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-50 animate-fade-in text-white">
          <h3 className="font-headline italic text-xl mb-6">Preferences</h3>
          <div className="space-y-8">
            {!isManga && (
              <>
                <div>
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-outline mb-4">
                    <span>Theme</span>
                    <span className="text-primary">{THEMES[theme].label}</span>
                  </div>
                  <div className="flex gap-4">
                    {Object.entries(THEMES).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => setTheme(k)}
                        className={`w-12 h-12 rounded-full border-[3px] transition-all flex items-center justify-center ${theme === k ? 'border-primary scale-110' : 'border-white/10 hover:border-white/30'}`}
                        style={{ backgroundColor: v.bg }}
                      >
                        {theme === k && <span className="material-symbols-outlined text-xl mix-blend-difference" style={{ color: v.text }}>check</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-outline mb-4">
                    <span>Typography</span>
                    <span className="text-white">{fontSize}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setFontSize(Math.max(60, fontSize - 10))} className="w-10 h-10 rounded-full border border-white/10 hover:bg-white/10 text-white">-</button>
                    <button onClick={() => setFontSize(Math.min(200, fontSize + 10))} className="w-10 h-10 rounded-full border border-white/10 hover:bg-white/10 text-white">+</button>
                  </div>
                </div>
              </>
            )}
            {isManga && (
              <div>
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-outline mb-4">
                  <span>Reading Mode</span>
                  <span className="text-primary">{mangaMode === 'vertical' ? 'Webtoon' : 'RTL Manga'}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => setMangaMode('vertical')} 
                    className={`px-4 py-3 rounded-xl border text-sm font-bold tracking-wider uppercase transition-all ${mangaMode === 'vertical' ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                  >
                    Vertical Scroll
                  </button>
                  <button 
                    onClick={() => setMangaMode('rtl')} 
                    className={`px-4 py-3 rounded-xl border text-sm font-bold tracking-wider uppercase transition-all ${mangaMode === 'rtl' ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                  >
                    Right-To-Left
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DOWNLOAD PROGRESS BAR ── */}
      {downloadingChapter && (
        <div className="fixed bottom-0 left-0 right-0 h-1 bg-white/10 z-[110]">
          <div 
            className="h-full bg-primary shadow-[0_0_10px_rgba(195,192,255,0.8)] transition-all duration-500"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default Reader;
