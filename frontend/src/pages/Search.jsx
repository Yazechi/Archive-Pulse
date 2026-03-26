import { useState, useEffect } from 'react';
import axios from 'axios';
import { useMusic } from '../context/MusicContext';

const Search = () => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('music');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { playTrack, currentTrack, isPlaying } = useMusic();

  const fetchResults = async (searchQuery, searchType) => {
    setLoading(true);
    setError('');
    setResults([]);
    
    try {
      const endpoint = searchType === 'music' ? '/api/music/search' : '/api/books/search';
      const response = await axios.get(`http://127.0.0.1:5000${endpoint}?q=${encodeURIComponent(searchQuery)}&type=${searchType}`);
      setResults(response.data);
      if (response.data.length === 0) setError('No records found in global archives.');
    } catch (err) {
      setError(`Transmission error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults(query, type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchResults(query, type);
  };

  const addToCollection = async (item) => {
    try {
      const endpoint = type === 'music' ? '/api/songs/add' : '/api/books/add';
      const data = type === 'music' ? {
        title: item.title,
        artist: item.artist,
        source_id: item.id,
        thumbnail_url: item.thumbnail_url,
        source: 'youtube',
        duration: item.duration
      } : {
        title: item.title,
        author: item.author,
        thumbnail_url: item.thumbnail_url,
        source: 'external',
        source_url: item.source_url,
        type: item.type || type
      };

      await axios.post(`http://127.0.0.1:5000${endpoint}`, data);
      alert('Archived successfully!');
    } catch (err) {
      console.error('Archive error:', err);
      alert('Failed to archive or artifact already exists.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0 pb-40 animate-fade-in text-white selection:bg-primary/30">
      
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-20 space-y-6 border-b border-white/5 pb-16">
        <div className="px-5 py-2 rounded-full bg-primary/10 border border-primary/20 w-fit backdrop-blur-md">
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-light">Discovery Module</span>
        </div>
        <h2 className="font-headline italic text-8xl md:text-9xl tracking-tighter text-gradient leading-[0.8] pb-2">Archives Discovery</h2>
        <p className="text-white/30 uppercase tracking-[0.6em] text-[10px] font-black ml-1">Query global registries for new signal captures</p>
      </div>
      
      {/* ── Filter ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-6 mb-16 pb-8 border-b border-white/5">
        {['music', 'books', 'manga'].map(t => (
          <button 
            key={t}
            onClick={() => { setType(t); setResults([]); setError(''); }}
            className={`px-10 py-4 rounded-full font-black uppercase tracking-[0.3em] text-[11px] transition-all border backdrop-blur-md ${
              type === t 
                ? 'bg-white text-black border-white shadow-[0_15px_30px_rgba(255,255,255,0.1)]' 
                : 'bg-white/[0.03] text-white/40 border-white/5 hover:border-white/20 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Search Bar ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="relative mb-24 group">
        <div className="absolute inset-0 bg-primary/20 blur-[100px] opacity-0 group-focus-within:opacity-30 transition-opacity duration-1000" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${type === 'music' ? 'audio frequencies' : 'literary records'}...`}
          className="w-full bg-[#0a0a0a]/40 backdrop-blur-3xl border border-white/5 hover:border-white/20 rounded-[2.5rem] px-10 py-8 text-2xl md:text-4xl focus:outline-none focus:border-primary/50 text-white placeholder:text-white/10 transition-all duration-700 shadow-[0_40px_80px_rgba(0,0,0,0.5)] font-headline italic tracking-tighter relative z-10"
        />
        <button 
          type="submit" 
          disabled={loading}
          className="absolute right-6 top-1/2 -translate-y-1/2 bg-white text-black w-16 h-16 rounded-full flex items-center justify-center hover:scale-105 hover:bg-primary hover:text-white active:scale-95 transition-all shadow-2xl disabled:opacity-50 z-20 group/btn"
        >
          <span className={`material-symbols-outlined text-3xl group-hover/btn:scale-110 transition-transform ${loading ? 'animate-spin' : ''}`}>
            {loading ? 'sync' : 'search'}
          </span>
        </button>
      </form>

      {error && (
        <div className="flex flex-col items-center py-32 text-center rounded-[3rem] bg-red-500/[0.02] border border-red-500/10 animate-fade-in">
          <span className="material-symbols-outlined text-7xl mb-8 text-red-400/30">error_outline</span>
          <p className="font-headline italic text-3xl text-red-400/50 tracking-tighter leading-tight max-w-md px-12">{error}</p>
        </div>
      )}

      {loading && !results.length && (
        <div className="flex flex-col items-center py-40 text-white/20 animate-fade-in">
          <div className="w-20 h-20 border-2 border-white/5 border-t-primary rounded-full animate-spin mb-10 shadow-[0_0_50px_rgba(139,92,246,0.2)]"></div>
          <p className="font-headline italic text-3xl tracking-tighter opacity-50">Connecting to global registry...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {results.map((item, i) => {
          const canAdd = true;
          return (
            <div 
              key={item.id} 
              className="bg-white/[0.01] p-6 rounded-[3rem] flex items-center gap-8 group hover:bg-white/[0.03] hover:border-primary/40 hover:-translate-y-1 transition-all duration-700 border border-white/5 shadow-2xl animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="w-24 h-24 bg-[#111] rounded-[1.5rem] overflow-hidden shrink-0 relative border border-white/5 shadow-xl group-hover:scale-105 transition-transform duration-700">
                {item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover transition-all duration-1000 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/5"><span className="material-symbols-outlined text-4xl">{type === 'music' ? 'music_note' : 'menu_book'}</span></div>
                )}
                {type === 'music' && (
                  <div className="absolute inset-0 bg-primary/30 opacity-0 group-hover:opacity-100 transition-all duration-700 flex items-center justify-center">
                    <button onClick={() => playTrack({ ...item, source_id: item.id })} className="text-white hover:scale-125 transition-transform">
                      <span className="material-symbols-outlined text-5xl font-variation-settings-fill-1">{currentTrack?.source_id === item.id && isPlaying ? 'pause' : 'play_arrow'}</span>
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-hidden space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[8px] px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] text-white/30 font-black uppercase tracking-[0.3em]">
                    {item.source_name || 'Registry'}
                  </span>
                  {item.duration && (
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{item.duration}</span>
                  )}
                </div>
                <h3 className="font-headline text-2xl leading-none truncate text-white group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black truncate">{type === 'music' ? item.artist : item.author}</p>
              </div>

              <div className="flex gap-3 shrink-0">
                {item.source_url && type !== 'music' && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-[1.25rem] border border-white/5 flex items-center justify-center text-white/20 hover:bg-white hover:text-black transition-all duration-500 shadow-xl" title="Open Source Link">
                    <span className="material-symbols-outlined text-2xl">open_in_new</span>
                  </a>
                )}
                {canAdd && (
                  <button 
                    onClick={() => addToCollection(item)} 
                    className="w-12 h-12 rounded-[1.25rem] border border-white/5 flex items-center justify-center text-white/20 hover:bg-primary hover:text-white hover:border-primary/50 transition-all duration-500 shadow-xl group/add" 
                    title="Add to Library"
                  >
                    <span className="material-symbols-outlined text-2xl group-hover/add:rotate-90 transition-transform duration-500">add</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Search;