import { useState, useEffect } from 'react';
import axios from 'axios';
import { useMusic } from '../context/useMusic';
import { useToast } from '../context/ToastContext';
import { Search as SearchIcon, Play, Plus, BookOpen, ExternalLink, Activity } from 'lucide-react';

const Search = () => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('music');
  const [provider, setProvider] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { playTrack, toggleMainPlayer } = useMusic();
  const toast = useToast();

  const fetchResults = async (searchQuery, searchType, selectedProvider = 'all') => {
    setLoading(true);
    setError('');
    try {
      const endpoint = searchType === 'music' ? '/api/music/search' : '/api/books/search';
      const q = searchQuery || (searchType === 'music' ? 'Top Hits' : 'Trending');
      const response = await axios.get(`http://127.0.0.1:5000${endpoint}?q=${encodeURIComponent(q)}&type=${searchType}&provider=${selectedProvider}`);
      setResults(response.data);
    } catch (err) { setError(`Registry Connection Error: ${err.message}`); } finally { setLoading(false); }
  };

  useEffect(() => {
    const defaultProvider =
      type === 'books'
        ? (localStorage.getItem('pref-provider-books') || 'all')
        : type === 'manga'
          ? (localStorage.getItem('pref-provider-manga') || 'mangadex')
          : 'all';
    setProvider(defaultProvider);
    fetchResults(query, type, defaultProvider);
  }, [type]);

  const addToCollection = async (item) => {
    try {
      const endpoint = type === 'music' ? '/api/songs/add' : '/api/books/add';
      const data = type === 'music' ? {
        title: item.title, artist: item.artist, source_id: item.id,
        thumbnail_url: item.thumbnail_url, source: 'youtube', duration: item.duration
      } : {
        title: item.title, author: item.author, thumbnail_url: item.thumbnail_url,
        source: 'external', source_url: item.source_url, type: item.type || type
      };
      await axios.post(`http://127.0.0.1:5000${endpoint}`, data);
      toast.success(`"${item.title}" added to archive`);
    } catch (err) { toast.warning('Artifact already exists in archive'); }
  };

  return (
    <div className="page-shell">
      <header className="space-y-6 border-b border-border pb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="status-online" />
            <span className="tech-label text-primary">Discovery Module</span>
          </div>
          <h1 className="heading-lg">Query Terminal</h1>
        </div>
        
        <div className="w-full sm:w-fit flex bg-white/5 border border-white/10 p-1.5 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.25)]">
          {['music', 'books', 'manga'].map(t => (
            <button key={t} onClick={() => { setType(t); setQuery(''); }} className={`flex-1 sm:flex-none px-6 sm:px-10 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${type === t ? 'bg-primary text-black shadow-lg' : 'text-white/40 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
        {type !== 'music' && (
          <div className="w-full sm:w-fit flex bg-white/5 border border-white/10 p-1.5 rounded-2xl">
            {(type === 'books'
              ? [
                  { id: 'all', label: 'All' },
                  { id: 'gutenberg', label: 'Gutenberg' },
                  { id: 'openlibrary', label: 'OpenLibrary' },
                ]
              : [
                  { id: 'all', label: 'All' },
                  { id: 'mangadex', label: 'MangaDex' },
                  { id: 'myanimelist', label: 'MyAnimeList' },
                ]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setProvider(p.id); fetchResults(query, type, p.id); }}
                className={`px-4 py-2 rounded-xl font-semibold text-[10px] uppercase tracking-wider transition-all ${provider === p.id ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <form onSubmit={(e) => { e.preventDefault(); fetchResults(query, type, provider); }} className="relative group section-card">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Input_${type.toUpperCase()}_Descriptor...`}
          className="w-full bg-white/4 border border-white/12 rounded-2xl py-4 md:py-6 px-5 md:px-6 pr-16 md:pr-20 text-2xl md:text-4xl text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition-all font-display tracking-tight"
        />
        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 btn-primary btn-icon">
          <SearchIcon size={20} />
        </button>
      </form>

      {loading ? (
        <div className="py-40 flex flex-col items-center gap-6 opacity-20">
          <Activity size={64} className="animate-spin" />
          <p className="tech-label">Scanning_Global_Registry...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {results.map((item, i) => (
            <div key={item.id} className="card-interactive p-5 rounded-2xl flex items-center gap-5 group animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="w-24 h-24 rounded-2xl border border-white/10 shrink-0 relative overflow-hidden bg-zinc-900 shadow-xl">
                <img src={item.thumbnail_url} className="w-full h-full object-cover opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-700" alt="" />
                {type === 'music' && (
                  <button onClick={() => { playTrack({ ...item, source_id: item.id }); toggleMainPlayer(true); }} className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <Play size={32} fill="currentColor" className="text-primary" />
                  </button>
                )}
              </div>
              
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="tech-label text-primary/40">{item.source_name || 'Registry'}</span>
                  {item.duration && <span className="font-mono text-[9px] text-zinc-600">{item.duration}</span>}
                </div>
                <h3 className="text-xl text-white truncate font-display group-hover:text-primary transition-colors leading-none">{item.title}</h3>
                <p className="tech-label-sm truncate">{type === 'music' ? item.artist : item.author}</p>
              </div>

              <div className="flex gap-2">
                {item.source_url && type !== 'music' && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/5 rounded-xl text-white/20 hover:text-white hover:bg-white/10 transition-all"><ExternalLink size={20} /></a>
                )}
                <button onClick={() => addToCollection(item)} className="p-3 bg-white/5 rounded-xl text-white/20 hover:text-primary hover:bg-primary/10 transition-all"><Plus size={20} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Search;
