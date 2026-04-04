import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Trash2, FolderPlus, RefreshCcw, CheckSquare, Square, Library, Layers, Plus, X, ArrowLeft, MessageSquareText } from 'lucide-react';
import { TagSelector, TagBadge } from '../components/TagManager';
import { FavoriteButton, useFavorites } from '../components/FavoriteButton';

const API_BASE = 'http://127.0.0.1:5000';
const normalizeProgress = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const Books = () => {
  const [books, setBooks] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, books, manga, series
  const [selectedSeries, setSelectedSeries] = useState(null); // When a series is opened
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateSeriesModal, setShowCreateSeriesModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', author: '', volume_number: '', genres: '' });
  const [newSeries, setNewSeries] = useState({ title: '', author: '', description: '' });
  const [bookTags, setBookTags] = useState({});
  const [annotations, setAnnotations] = useState([]);
  const [annotationCounts, setAnnotationCounts] = useState({});
  const [showAnnotationsModal, setShowAnnotationsModal] = useState(false);
  const { fetchFavorites, isFavorite, setFavoriteState } = useFavorites('book');
  const navigate = useNavigate();
  const toast = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        axios.get(`${API_BASE}/api/books?t=${Date.now()}`),
        axios.get(`${API_BASE}/api/series?t=${Date.now()}`)
      ]);
      setBooks(bRes.data);
      setSeries(sRes.data);
      const annoRes = await axios.get(`${API_BASE}/api/annotations`);
      const ann = Array.isArray(annoRes.data) ? annoRes.data : [];
      setAnnotations(ann);
      const counts = ann.reduce((acc, row) => {
        acc[row.book_id] = (acc[row.book_id] || 0) + 1;
        return acc;
      }, {});
      setAnnotationCounts(counts);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchTagsForBooks = async (booksList) => {
    try {
      const tagEntries = await Promise.all(
        booksList.map(async (item) => {
          const res = await axios.get(`${API_BASE}/api/tags/content/book/${item.id}`);
          return [item.id, res.data];
        })
      );
      setBookTags(Object.fromEntries(tagEntries));
    } catch (err) {
      console.error('Failed to fetch book tags', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchFavorites();
  }, []);

  useEffect(() => {
    if (books.length > 0) fetchTagsForBooks(books);
  }, [books]);

  const deleteBook = async (id) => {
    if (!window.confirm('Erase this manuscript?')) return;
    try {
      await axios.delete(`${API_BASE}/api/books/${id}`);
      setBooks(books.filter(b => b.id !== id));
      toast.success('Manuscript erased from archive');
    } catch (err) { toast.error('Failed to erase manuscript'); }
  };

  const deleteSeries = async (id) => {
    if (!window.confirm('Erase this series node? Content will remain unassigned.')) return;
    try {
      await axios.delete(`${API_BASE}/api/series/${id}`);
      setSeries(series.filter(s => s.id !== id));
      if (selectedSeries?.id === id) setSelectedSeries(null);
      toast.success('Series node dissolved');
    } catch (err) { toast.error('Failed to erase series'); }
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Erase ${selectedBooks.size} manuscripts?`)) return;
    try {
      await Promise.all(Array.from(selectedBooks).map(id => axios.delete(`${API_BASE}/api/books/${id}`)));
      setBooks(books.filter(b => !selectedBooks.has(b.id)));
      setIsBatchMode(false);
      setSelectedBooks(new Set());
      toast.success(`${selectedBooks.size} manuscripts erased`);
    } catch (err) { toast.error('Partial failure during erase operation'); }
  };

  const assignToSeries = async (seriesId) => {
    try {
      await Promise.all(Array.from(selectedBooks).map(id => 
        axios.put(`${API_BASE}/api/books/${id}/series`, { series_id: seriesId })
      ));
      setShowAssignModal(false);
      setIsBatchMode(false);
      setSelectedBooks(new Set());
      fetchData();
      toast.success(`${selectedBooks.size} manuscript${selectedBooks.size > 1 ? 's' : ''} assigned to series`);
    } catch (err) { toast.error('Failed to assign manuscripts'); }
  };

  const handleCreateSeries = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/series`, newSeries);
      setShowCreateSeriesModal(false);
      setNewSeries({ title: '', author: '', description: '' });
      fetchData();
      toast.success('Series node created successfully');
    } catch (err) { toast.error('Failed to create series'); }
  };

  const openEditModal = (book, e) => {
    e.stopPropagation();
    const tags = (bookTags[book.id] || []).map((t) => t.name).join(', ');
    setEditForm({
      title: book.title || '',
      author: book.author || '',
      volume_number: book.volume_number ?? '',
      genres: tags,
    });
    setEditingBook(book);
  };

  const saveBookMetadata = async () => {
    if (!editingBook) return;
    try {
      await axios.put(`${API_BASE}/api/books/${editingBook.id}/metadata`, {
        title: editForm.title,
        author: editForm.author,
        volume_number: editForm.volume_number === '' ? null : Number(editForm.volume_number),
        genres: editForm.genres
      });
      await fetchData();
      toast.success('Book metadata updated');
      setEditingBook(null);
    } catch (err) {
      toast.error('Failed to update metadata');
    }
  };

  // Filter logic for the main view
  const displayItems = useMemo(() => {
    if (selectedSeries) {
      // If a series is opened, show only its books
      return books.filter(b => b.series_id === selectedSeries.id);
    }

    // Main view: show books NOT in a series AND series cards themselves
    let filtered = books.filter(b => b.series_id === null);
    
    if (activeTab === 'books') filtered = filtered.filter(b => b.type !== 'manga');
    if (activeTab === 'manga') filtered = filtered.filter(b => b.type === 'manga');
    
    return filtered;
  }, [books, selectedSeries, activeTab]);

  const showSeriesGrid = !selectedSeries && (activeTab === 'all' || activeTab === 'series');

  return (
    <div className="page-shell">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-border pb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="status-online" />
            <span className="tech-label text-primary">
              {selectedSeries ? `Series: ${selectedSeries.title}` : 'Lit_Vault_Core'}
            </span>
          </div>
          <div className="flex items-center gap-6">
            {selectedSeries && (
              <button onClick={() => setSelectedSeries(null)} className="btn-icon">
                <ArrowLeft size={24} />
              </button>
            )}
            <h1 className="heading-lg">
              {selectedSeries ? selectedSeries.title : activeTab === 'series' ? 'Series Nodes' : 'Literary Archive'}
            </h1>
          </div>
          <p className="tech-label-sm">
            {selectedSeries 
              ? `${displayItems.length} Artifacts in Sequence` 
              : activeTab === 'series' 
                ? `${series.length} Series Indexed` 
                : `${books.length} Total Manuscripts Indexed`} // System_Ready
          </p>
        </div>
        
        <div className="flex gap-4 flex-wrap">
          {!selectedSeries && (
              <button onClick={() => setShowCreateSeriesModal(true)} className="btn-secondary uppercase tracking-wider">
                <Plus size={16} /> Create Series
              </button>
            )}

          {isBatchMode && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1 rounded-xl animate-in">
              <button onClick={() => setShowAssignModal(true)} disabled={selectedBooks.size === 0} className="h-10 px-6 rounded-lg bg-primary text-black font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"><Layers size={14} /> Assign Series</button>
              <button onClick={deleteSelected} disabled={selectedBooks.size === 0} className="h-10 px-6 rounded-lg bg-red-500/20 text-red-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /> Erase</button>
            </div>
          )}

            <button onClick={() => { setIsBatchMode(!isBatchMode); setSelectedBooks(new Set()); }} className={isBatchMode ? 'btn-primary uppercase tracking-wider' : 'btn-secondary uppercase tracking-wider'}>
              {isBatchMode ? <CheckSquare size={16} /> : <Square size={16} />}
              {isBatchMode ? 'Cancel Selection' : 'Batch Select'}
            </button>
            
              <button onClick={fetchData} className="btn-icon"><RefreshCcw size={18} /></button>
              <button onClick={() => setShowAnnotationsModal(true)} className="btn-secondary uppercase tracking-wider">
                <MessageSquareText size={16} /> Annotations
              </button>
            
            {!selectedSeries && (
              <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
                {['all', 'books', 'manga', 'series'].map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => { setActiveTab(tab); setSelectedSeries(null); }} 
                    className={`px-4 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>          )}
        </div>
      </header>

      <div className="space-y-10">
        {/* Render Series Grid if applicable */}
        {showSeriesGrid && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {series.map((s) => (
              <div 
                key={s.id} 
                onClick={() => setSelectedSeries(s)}
                className="group cursor-pointer card-interactive p-6 rounded-3xl flex flex-col gap-5 relative"
              >
                <div className="aspect-square bg-zinc-900/50 rounded-2xl relative overflow-hidden flex items-center justify-center">
                  {s.thumbnail_url ? (
                    <img src={s.thumbnail_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                  ) : (
                    <Library size={48} className="text-white/5" />
                  )}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteSeries(s.id); }} className="p-2 bg-black/60 rounded-lg text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl text-white truncate uppercase font-display group-hover:text-primary transition-colors tracking-tight">{s.title}</h3>
                  <p className="tech-label">{s.author || 'Collective'}</p>
                  <p className="text-[10px] text-zinc-500 line-clamp-2 mt-2">{s.description || 'No description assigned to this nodal cluster.'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Books Grid */}
          <div className="section-card grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-10">
          {displayItems.map((book) => {
            const isSelected = selectedBooks.has(book.id);
            return (
              <div 
                key={book.id} 
                className={`group cursor-pointer flex flex-col gap-6 relative transition-all tap-press ${isSelected ? 'scale-95' : ''}`}
                onClick={() => {
                  if (isBatchMode) {
                    const next = new Set(selectedBooks);
                    next.has(book.id) ? next.delete(book.id) : next.add(book.id);
                    setSelectedBooks(next);
                  } else {
                    if (book.type === 'manga') {
                      navigate('/manga-chapters', { state: { book } });
                    } else {
                      navigate('/reader', { state: { book } });
                    }
                  }
                }}
              >
                <div className={`aspect-[2/3] rounded-[2rem] border border-white/5 bg-zinc-900 relative overflow-hidden transition-all duration-500 ${isSelected ? 'border-primary shadow-[0_0_20px_var(--color-primary-dim)]' : 'group-hover:border-primary/40'}`}>
                  <img src={book.thumbnail_url?.startsWith('http') ? book.thumbnail_url : `${API_BASE}${book.thumbnail_url}`} className="w-full h-full object-cover opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-700" alt="" />
                  {book.volume_number !== null && book.volume_number !== undefined && (
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/70 border border-white/20 text-[9px] font-bold tracking-wider text-primary">
                      Vol {book.volume_number}
                    </span>
                  )}
                   
                  {book.type !== 'manga' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5">
                      <div className="h-full bg-primary shadow-[0_0_10px_var(--color-primary)]" style={{ width: `${normalizeProgress(book.progress)}%` }} />
                    </div>
                  )}

                  {isSelected && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><CheckSquare size={48} className="text-primary" /></div>}
                  
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="font-bold text-[10px] text-primary tracking-widest bg-black/80 px-4 py-2 border border-primary/20 rounded-lg uppercase">Open Record</span>
                  </div>

                  {!isBatchMode && (
                    <div className="absolute top-4 right-4 flex gap-1 opacity-100 transition-all">
                      <div onClick={(e) => e.stopPropagation()}>
                        <TagSelector
                          contentType="book"
                          contentId={book.id}
                          selectedTags={bookTags[book.id] || []}
                          onTagsChange={(tags) => setBookTags((prev) => ({ ...prev, [book.id]: tags }))}
                          position="bottom"
                          iconSize={16}
                          buttonClassName="p-2 rounded-lg bg-black/70 border border-white/20 text-white/80 hover:text-primary hover:border-primary/50"
                        />
                      </div>
                      <FavoriteButton
                        contentType="book"
                        contentId={book.id}
                        isFavorite={isFavorite(book.id)}
                        onToggle={(next) => setFavoriteState(book.id, next)}
                        size="md"
                        className="p-2 rounded-lg bg-black/70 border border-white/20 text-white/80 hover:border-red-400/60"
                      />
                      <button onClick={(e) => openEditModal(book, e)} className="p-2 bg-black/60 rounded-lg text-white/40 hover:text-primary opacity-0 group-hover:opacity-100">Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }} className="p-2 bg-black/60 rounded-lg text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 px-2">
                  <h3 className="text-[15px] font-bold text-white uppercase truncate group-hover:text-primary transition-colors tracking-tight">{book.title}</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest">{book.author}</span>
                    <span className="font-mono text-[9px] text-primary">
                      {book.type === 'manga'
                        ? (book.last_chapter_title ? `Last: ${book.last_chapter_title}` : 'Last: none')
                        : `${Math.round(normalizeProgress(book.progress))}%`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(bookTags[book.id] || []).slice(0, 3).map((tag) => (
                      <TagBadge key={tag.id} tag={tag} size="xs" />
                    ))}
                  </div>
                  {(annotationCounts[book.id] || 0) > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/reader', { state: { book } });
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:text-white transition-colors"
                    >
                      <MessageSquareText size={12} />
                      {(annotationCounts[book.id] || 0)} annotation{annotationCounts[book.id] > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MODALS --- */}

      {showAssignModal && (
        <div className="overlay z-[300] flex items-center justify-center p-6 animate-in">
          <div className="modal w-full max-w-md p-8 relative">
            <button onClick={() => setShowAssignModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h3 className="heading-sm mb-1">Classify Manuscripts</h3>
            <p className="tech-label-sm mb-6">Assign to series node</p>
            <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar mb-8">
              {series.map(s => (
                <button key={s.id} onClick={() => assignToSeries(s.id)} className="w-full text-left p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-between group">
                  <span className="font-bold text-sm text-white group-hover:text-primary transition-colors uppercase">{s.title}</span>
                  <FolderPlus size={16} className="text-white/20 group-hover:text-primary" />
                </button>
              ))}
            </div>
            <button onClick={() => setShowAssignModal(false)} className="w-full btn-secondary uppercase tracking-wider justify-center">Close</button>
          </div>
        </div>
      )}

      {showCreateSeriesModal && (
        <div className="overlay z-[300] flex items-center justify-center p-6 animate-in">
          <div className="modal w-full max-w-md p-8 relative">
            <button onClick={() => setShowCreateSeriesModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h3 className="heading-sm mb-1">New Series Node</h3>
            <p className="tech-label-sm mb-6">Initialize cluster</p>
            <form onSubmit={handleCreateSeries} className="space-y-6">
              <div className="space-y-2">
                <label className="tech-label">Node_Title</label>
                <input required type="text" value={newSeries.title} onChange={e => setNewSeries({...newSeries, title: e.target.value})} className="input" placeholder="Enter series title..." />
              </div>
              <div className="space-y-2">
                <label className="tech-label">Primary_Author</label>
                <input type="text" value={newSeries.author} onChange={e => setNewSeries({...newSeries, author: e.target.value})} className="input" placeholder="Enter author name..." />
              </div>
              <div className="space-y-2">
                <label className="tech-label">Metadata_Description</label>
                <textarea value={newSeries.description} onChange={e => setNewSeries({...newSeries, description: e.target.value})} className="input h-32" placeholder="Describe the cluster..." />
              </div>
              <button type="submit" className="w-full btn-primary btn-lg uppercase tracking-wider justify-center">Integrate Series</button>
            </form>
          </div>
        </div>
      )}

      {editingBook && (
        <div className="overlay z-[350] flex items-center justify-center p-6 animate-in">
          <div className="modal w-full max-w-lg p-8 relative">
            <button onClick={() => setEditingBook(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={22} /></button>
            <h3 className="heading-sm mb-2">Edit Book Metadata</h3>
            <p className="tech-label-sm mb-6">Update volume and tags (genres)</p>
            <div className="space-y-4">
              <input className="input" value={editForm.title} onChange={(e) => setEditForm((v) => ({ ...v, title: e.target.value }))} placeholder="Title" />
              <input className="input" value={editForm.author} onChange={(e) => setEditForm((v) => ({ ...v, author: e.target.value }))} placeholder="Author" />
              <input className="input" value={editForm.volume_number} onChange={(e) => setEditForm((v) => ({ ...v, volume_number: e.target.value }))} placeholder="Volume Number" />
              <input className="input" value={editForm.genres} onChange={(e) => setEditForm((v) => ({ ...v, genres: e.target.value }))} placeholder="Genres as tags (comma separated)" />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={saveBookMetadata} className="btn-primary">Save</button>
              <button onClick={() => setEditingBook(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAnnotationsModal && (
        <div className="overlay z-[360] flex items-center justify-center p-6 animate-in">
          <div className="modal w-full max-w-3xl p-8 relative">
            <button onClick={() => setShowAnnotationsModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={22} /></button>
            <h3 className="heading-sm mb-2">Reading Annotations</h3>
            <p className="tech-label-sm mb-6">Highlights and notes across your books</p>
            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
              {annotations.length === 0 ? (
                <div className="py-10 text-center tech-label">No annotations yet. Open a book and highlight text in Reader.</div>
              ) : (
                annotations.slice(0, 120).map((item) => {
                  const targetBook = books.find((b) => b.id === item.book_id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (!targetBook) return;
                        setShowAnnotationsModal(false);
                        navigate('/reader', { state: { book: targetBook } });
                      }}
                      className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/40 transition-all"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-white truncate">{item.book_title || targetBook?.title || 'Book'}</p>
                        <span className="tech-label-sm">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-2 text-xs text-white/70 line-clamp-2">{item.text_excerpt}</p>
                      {item.note && <p className="mt-2 text-xs text-primary/90 line-clamp-2">Note: {item.note}</p>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Books;
