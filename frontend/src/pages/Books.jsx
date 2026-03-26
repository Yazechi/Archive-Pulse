import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';

const API_BASE = 'http://127.0.0.1:5000';

const Books = () => {
  const [books, setBooks] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedGroupId, setExpandedGroupId] = useState(location.state?.expandedGroupId || null);
  
  // Manual Grouping States
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesAuthor, setNewSeriesAuthor] = useState('');
  const [volNum, setVolNum] = useState('');

  // Batch Editing States
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(new Set());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [booksRes, seriesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/books?t=${Date.now()}`),
        axios.get(`${API_BASE}/api/series?t=${Date.now()}`)
      ]);
      setBooks(booksRes.data);
      setSeries(seriesRes.data);
    } catch (err) {
      setError('The digital archive is currently unreachable.');
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this manuscript?')) return;
    try {
      await axios.delete(`${API_BASE}/api/books/${id}`);
      setBooks(books.filter(b => b.id !== id));
    } catch (err) {
      alert(`Failed to remove entry`);
    }
  };

  const createSeries = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/series`, {
        title: newSeriesName,
        author: newSeriesAuthor
      });
      setNewSeriesName('');
      setNewSeriesAuthor('');
      setShowSeriesModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to create series');
    }
  };

  const assignToSeries = async (seriesId) => {
    try {
      await axios.put(`${API_BASE}/api/books/${selectedBook.id}/series`, {
        series_id: seriesId,
        volume_number: parseFloat(volNum) || null
      });
      setShowAssignModal(false);
      setVolNum('');
      fetchData();
    } catch (err) {
      alert('Failed to assign to series');
    }
  };

  const removeFromSeries = async (e, bookId) => {
    e.stopPropagation();
    try {
      await axios.put(`${API_BASE}/api/books/${bookId}/series`, {
        series_id: null,
        volume_number: null
      });
      fetchData();
    } catch (err) {
      alert('Failed to remove from series');
    }
  };

  const deleteSeries = async (e, seriesId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this series? The books will not be deleted.')) return;
    try {
      await axios.delete(`${API_BASE}/api/series/${seriesId}`);
      setSeries(series.filter(s => s.id !== seriesId));
      if (expandedGroupId === `manual-${seriesId}`) setExpandedGroupId(null);
      fetchData();
    } catch (err) {
      alert('Failed to delete series');
    }
  };

  // ── GROUPING LOGIC ──
  const groups = {};

  // 1. Initialize all Manual Series (including empty ones)
  series.forEach(s => {
    groups[`manual-${s.id}`] = {
      id: `manual-${s.id}`,
      baseTitle: s.title,
      books: [],
      author: s.author,
      thumbnail_url: s.thumbnail_url,
      isManual: true
    };
  });

  // 2. Distribute books into groups
  const ungrouped = [];
  books.forEach(book => {
    if (book.series_id && groups[`manual-${book.series_id}`]) {
      groups[`manual-${book.series_id}`].books.push(book);
    } else {
      ungrouped.push(book);
    }
  });

  // 3. Auto-group the remaining books
  const finalGroups = { ...groups };
  ungrouped.forEach(book => {
    const volRegex = /(.*?)\s*(?:vol(?:ume)?\.?\s*(\d+\.?\d*)|v(\d+\.?\d*))/i;
    const match = book.title.match(volRegex);
    const baseTitle = match ? match[1].trim() : book.title.trim();
    const autoKey = `auto-${baseTitle}`;

    if (!finalGroups[autoKey]) {
      finalGroups[autoKey] = {
        id: autoKey,
        baseTitle,
        books: [],
        author: book.author,
        thumbnail_url: book.thumbnail_url,
        isManual: false
      };
    }
    finalGroups[autoKey].books.push(book);
  });

  // Sort books within each group
  Object.values(finalGroups).forEach(g => {
    if (g.isManual) {
      g.books.sort((a, b) => (a.volume_number || 0) - (b.volume_number || 0));
    } else {
      g.books.sort((a, b) => a.title.localeCompare(b.title));
    }
    // Update thumbnail to the latest book if group thumbnail is missing
    if (!g.thumbnail_url && g.books.length > 0) {
      g.thumbnail_url = g.books[g.books.length - 1].thumbnail_url;
    }
  });

  const displayItems = Object.values(finalGroups).filter(g => g.isManual || g.books.length > 0);

  useEffect(() => {
    fetchData();
  }, []);

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url}`;
  };

  // Expanded View Content
  const currentItems = expandedGroupId ? (finalGroups[expandedGroupId]?.books || []) : displayItems;

  return (
    <div className="space-y-16 pb-32 animate-fade-in text-white selection:bg-primary/30">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-8">
        <div>
          <h2 className="font-headline italic text-6xl md:text-7xl tracking-tighter">
            {expandedGroupId ? (finalGroups[expandedGroupId]?.baseTitle || 'Series Archives') : 'The Library'}
          </h2>
          <p className="text-outline uppercase tracking-[0.4em] text-[10px] mt-4 font-bold">
            {expandedGroupId ? 'Sequential Data' : 'Digital Literary Curator'}
          </p>
        </div>
        <div className="flex gap-4">
          {isBatchMode && (
            <div className="flex items-center gap-3 mr-4 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full">
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary">{selectedBooks.size} Selected</span>
              <button 
                onClick={() => {
                  if (selectedBooks.size > 0) setShowAssignModal(true);
                }}
                disabled={selectedBooks.size === 0}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-primary hover:text-black flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-white/10 disabled:hover:text-white"
                title="Assign Selected to Series"
              >
                <span className="material-symbols-outlined text-sm">folder_open</span>
              </button>
              <button 
                onClick={() => {
                  if (selectedBooks.size > 0 && window.confirm(`Delete ${selectedBooks.size} selected items?`)) {
                    selectedBooks.forEach(id => axios.delete(`${API_BASE}/api/books/${id}`));
                    setBooks(books.filter(b => !selectedBooks.has(b.id)));
                    setSelectedBooks(new Set());
                    setIsBatchMode(false);
                  }
                }}
                disabled={selectedBooks.size === 0}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-error hover:text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-white/10"
                title="Delete Selected"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          )}
          <button 
            onClick={() => {
              setIsBatchMode(!isBatchMode);
              if (isBatchMode) setSelectedBooks(new Set());
            }} 
            className={`px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 ${isBatchMode ? 'bg-primary text-black' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-sm">checklist</span> {isBatchMode ? 'Cancel' : 'Select'}
          </button>
          
          {expandedGroupId && (
            <button onClick={() => setExpandedGroupId(null)} className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Library
            </button>
          )}
          <button onClick={() => setShowSeriesModal(true)} className="bg-white text-black px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:scale-105 transition-transform flex items-center gap-2 shadow-xl">
            <span className="material-symbols-outlined text-sm">create_new_folder</span> New Series
          </button>
          <button onClick={fetchData} className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">refresh</span> Sync
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 text-outline">
           <div className="w-12 h-12 border border-white/10 border-t-white rounded-full animate-spin mb-6"></div>
           <p className="font-headline italic text-xl">Inventorying...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-40 text-center text-error">
           <span className="material-symbols-outlined text-6xl mb-6 opacity-50">warning</span>
           <p className="font-headline italic text-xl">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {currentItems.map((item) => {
            const isMainView = !expandedGroupId;
            // In main view, item is a group. In expanded view, item is a book.
            const isActuallyGroup = isMainView && (item.isManual || (item.books && item.books.length > 1));
            
            // The representative book for thumbnails and details
            const displayBook = isMainView 
              ? (item.books && item.books.length > 0 ? item.books[item.books.length - 1] : item) 
              : item;
            
            return (
              <div 
                key={item.id} 
                className={`group cursor-pointer flex flex-col relative ${isBatchMode && selectedBooks.has(item.id) ? 'ring-2 ring-primary ring-offset-4 ring-offset-[#050505] rounded-3xl' : ''}`}
                onClick={() => {
                  if (isBatchMode && !isActuallyGroup) {
                    const newSet = new Set(selectedBooks);
                    if (newSet.has(item.id)) newSet.delete(item.id);
                    else newSet.add(item.id);
                    setSelectedBooks(newSet);
                    return;
                  }

                  if (isActuallyGroup) {
                    setExpandedGroupId(item.id);
                  } else {
                    // Navigate using the actual book object
                    const targetBook = isMainView ? (item.books && item.books.length > 0 ? item.books[0] : item) : item;
                    navigate('/reader', { state: { book: targetBook, expandedGroupId: expandedGroupId } });
                  }
                }}
              >
                {isBatchMode && !isActuallyGroup && (
                  <div className={`absolute top-4 left-4 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedBooks.has(item.id) ? 'bg-primary border-primary' : 'border-white/50 bg-black/50'}`}>
                    {selectedBooks.has(item.id) && <span className="material-symbols-outlined text-black text-sm">check</span>}
                  </div>
                )}
                <div className="aspect-[2/3] bg-[#0a0a0a] rounded-3xl overflow-hidden relative border border-white/5 transition-all duration-500 group-hover:border-white/20 shadow-xl mb-4">
                  {getFullUrl(item.thumbnail_url || displayBook.thumbnail_url) ? (
                    <img 
                      src={getFullUrl(item.thumbnail_url || displayBook.thumbnail_url)} 
                      alt={item.baseTitle || displayBook.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                      <span className="material-symbols-outlined text-4xl mb-2">{isActuallyGroup ? 'folder' : 'menu_book'}</span>
                    </div>
                  )}
                  
                  {isActuallyGroup && (
                    <div className="absolute top-4 left-4 bg-white text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl">
                      {item.books.length} VOLS
                    </div>
                  )}

                  {!isActuallyGroup && displayBook.volume_number !== null && displayBook.volume_number !== undefined && (
                     <div className="absolute top-4 left-4 bg-primary text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl">
                        VOL. {displayBook.volume_number}
                     </div>
                  )}

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
                    {isActuallyGroup && item.isManual && (
                      <button 
                        onClick={(e) => deleteSeries(e, item.id.replace('manual-', ''))}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-error hover:text-white transition-all flex items-center justify-center"
                        title="Delete Series"
                      >
                        <span className="material-symbols-outlined text-sm">delete_forever</span>
                      </button>
                    )}
                    {!isActuallyGroup && (
                      <div className="absolute top-4 right-4 flex flex-col gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteBook(e, displayBook.id); }}
                          className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-error hover:text-white transition-all flex items-center justify-center"
                          title="Remove"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                        {!displayBook.series_id && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedBook(displayBook); setShowAssignModal(true); }}
                            className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-primary hover:text-black transition-all flex items-center justify-center"
                            title="Assign to Series"
                          >
                            <span className="material-symbols-outlined text-sm">folder_open</span>
                          </button>
                        )}
                        {displayBook.series_id && (
                          <button 
                            onClick={(e) => removeFromSeries(e, displayBook.id)}
                            className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-error hover:text-white transition-all flex items-center justify-center"
                            title="Remove from Series"
                          >
                            <span className="material-symbols-outlined text-sm">link_off</span>
                          </button>
                        )}
                      </div>
                    )}
                    <button 
                      className="bg-white text-black px-8 py-3 rounded-full font-bold text-[10px] uppercase tracking-widest mb-4 hover:scale-105 transition-transform"
                      onClick={(e) => {
                        if (isActuallyGroup) {
                          e.stopPropagation();
                          const unreadBook = item.books.find(b => b.progress < 100) || item.books[0];
                          if (unreadBook) {
                            navigate('/reader', { state: { book: unreadBook, expandedGroupId: item.id } });
                          } else {
                            setExpandedGroupId(item.id);
                          }
                        }
                      }}
                    >
                      {isActuallyGroup ? 'Continue Reading' : 'Read Now'}
                    </button>
                    {isActuallyGroup && (
                      <button 
                        className="text-white text-[10px] uppercase tracking-widest font-bold hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedGroupId(item.id);
                        }}
                      >
                        View Collection
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="font-headline text-lg leading-tight truncate group-hover:text-primary transition-colors">
                  {isActuallyGroup ? item.baseTitle : displayBook.title}
                </h3>
                <p className="font-body text-[10px] text-outline uppercase tracking-widest mt-1 truncate">{displayBook.author}</p>
                
                {!isActuallyGroup && displayBook.source === 'local' && (
                  <div className="mt-3 flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white transition-all duration-500" style={{ width: displayBook.type === 'manga' ? '100%' : `${displayBook.progress || 0}%` }}></div>
                    </div>
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      {displayBook.type === 'manga' ? (displayBook.last_page ? `CH.${displayBook.last_page}` : 'UNR') : `${Math.round(displayBook.progress || 0)}%`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Series Modal */}
      {showSeriesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/40 animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] w-full max-w-lg p-10 shadow-2xl">
            <h3 className="font-headline italic text-4xl mb-8">Establish Series</h3>
            <form onSubmit={createSeries} className="space-y-6">
              <input 
                type="text" value={newSeriesName} onChange={e => setNewSeriesName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary transition-colors"
                placeholder="Series Title"
              />
              <input 
                type="text" value={newSeriesAuthor} onChange={e => setNewSeriesAuthor(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary transition-colors"
                placeholder="Author"
              />
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowSeriesModal(false)} className="flex-1 py-4 border border-white/10 rounded-full font-bold uppercase tracking-widest text-[10px]">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-white text-black rounded-full font-bold uppercase tracking-widest text-[10px]">Initialize</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign to Series Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/40 animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] w-full max-w-md p-10 shadow-2xl">
            <h3 className="font-headline italic text-3xl mb-2">Classify Data</h3>
            <p className="text-outline uppercase tracking-widest text-[10px] font-bold mb-8">Assign "{selectedBook?.title}"</p>
            
            <input 
              type="number" value={volNum} onChange={e => setVolNum(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary transition-colors mb-6"
              placeholder="Volume Number (optional)"
            />

            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar mb-8">
              {series.map(s => (
                <button 
                  key={s.id} onClick={() => assignToSeries(s.id)}
                  className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/50 transition-all flex items-center justify-between group"
                >
                  <span className="font-headline group-hover:text-primary transition-colors">{s.title}</span>
                  <span className="material-symbols-outlined text-sm opacity-30">add_circle</span>
                </button>
              ))}
              {series.length === 0 && <p className="text-center text-outline italic py-4">No series established yet.</p>}
            </div>

            <button onClick={() => setShowAssignModal(false)} className="w-full py-4 border border-white/10 rounded-full font-bold uppercase tracking-widest text-[10px]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Books;
