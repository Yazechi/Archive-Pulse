import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Profile = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    songs: 0,
    musicDuration: '0m',
    books: 0,
    mangas: 0,
    localChapters: 0,
    series: 0,
    playlists: 0,
    recentlyRead: [],
    readingHabits: { completed: 0, inProgress: 0 }
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:5000/api/stats');
        setStats(response.data);
      } catch (err) {
        console.error('Failed to fetch stats', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-0 animate-fade-in text-white selection:bg-primary/30 pb-40">
      {/* ── HEADER ── */}
      <div className="flex flex-col lg:flex-row items-center lg:items-end gap-12 mb-20 border-b border-white/5 pb-16">
        <div className="w-56 h-56 md:w-72 md:h-72 rounded-[4rem] overflow-hidden border border-white/5 shadow-[0_40px_80px_rgba(0,0,0,0.6)] relative group shrink-0 bg-[#0a0a0a] transition-all duration-700 hover:shadow-primary/20">
          <img
            alt="User profile"
            className="w-full h-full object-cover grayscale transition-all duration-[2s] group-hover:grayscale-0 group-hover:scale-110"
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80 group-hover:opacity-40 transition-opacity duration-1000"></div>
          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 backdrop-blur-[2px]"></div>
          <div className="absolute bottom-6 left-0 right-0 text-center translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-700 z-10">
            <span className="text-[10px] uppercase tracking-[0.4em] font-black text-white bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">Configure Neural Core</span>
          </div>
        </div>
        <div className="text-center lg:text-left flex-1 space-y-8">
          <div className="space-y-2">
            <p className="text-primary font-black uppercase tracking-[0.5em] text-[10px] mb-4 block animate-fade-in" style={{ animationDelay: '0.2s' }}>Subject Identity Terminal</p>
            <h1 className="font-headline italic text-7xl md:text-9xl tracking-tighter leading-none text-gradient animate-fade-in" style={{ animationDelay: '0.4s' }}>System Curator</h1>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] bg-white text-black px-8 py-3 rounded-full shadow-2xl transition-transform hover:scale-105">
              Root Admin
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 border border-white/10 px-8 py-3 rounded-full hover:bg-white/5 transition-all cursor-default backdrop-blur-md">
              Archive Tier 05
            </span>
            <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 px-8 py-3 rounded-full backdrop-blur-md">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#8b5cf6]"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-light">Network Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-16">
        
        {/* ── LEFT COLUMN (Data Metrics) ── */}
        <div className="xl:col-span-8 space-y-16">
          
          <section className="space-y-12">
            <div className="flex items-center justify-between border-b border-white/5 pb-8 px-4">
              <div>
                <h2 className="font-headline italic text-5xl tracking-tighter mb-2">Neural Vaults</h2>
                <p className="text-[10px] uppercase font-black tracking-[0.5em] text-white/20">Synchronized system telemetry</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="bg-[#0a0a0a]/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/5 hover:border-primary/40 hover:-translate-y-2 transition-all duration-700 shadow-2xl group flex flex-col justify-between relative overflow-hidden h-72">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-all duration-700">
                    <span className="material-symbols-outlined text-3xl text-white/20 group-hover:text-primary transition-colors">library_music</span>
                  </div>
                  <span className="text-[9px] font-black bg-white/5 px-4 py-1.5 rounded-full text-white/30 group-hover:text-primary-light group-hover:bg-primary/10 transition-all uppercase tracking-widest">{stats.musicDuration}</span>
                </div>
                <div className="relative z-10 space-y-2">
                  <p className="font-headline italic text-7xl text-white group-hover:text-primary transition-colors duration-700 leading-none">{stats.songs}</p>
                  <p className="text-[10px] uppercase font-black tracking-[0.4em] text-white/20 group-hover:text-white/40 transition-colors">Sonic Nodes</p>
                </div>
              </div>

              <div className="bg-[#0a0a0a]/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/5 hover:border-primary/40 hover:-translate-y-2 transition-all duration-700 shadow-2xl group flex flex-col justify-between relative overflow-hidden h-72">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-all duration-700">
                    <span className="material-symbols-outlined text-3xl text-white/20 group-hover:text-primary transition-colors">menu_book</span>
                  </div>
                </div>
                <div className="relative z-10 space-y-2">
                  <p className="font-headline italic text-7xl text-white group-hover:text-primary transition-colors duration-700 leading-none">{stats.books}</p>
                  <p className="text-[10px] uppercase font-black tracking-[0.4em] text-white/20 group-hover:text-white/40 transition-colors">Literary Nodes</p>
                </div>
              </div>

              <div className="bg-[#0a0a0a]/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/5 hover:border-primary/40 hover:-translate-y-2 transition-all duration-700 shadow-2xl group flex flex-col justify-between relative overflow-hidden h-72">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-all duration-700">
                    <span className="material-symbols-outlined text-3xl text-white/20 group-hover:text-primary transition-colors">auto_stories</span>
                  </div>
                  <span className="text-[9px] font-black bg-white/5 px-4 py-1.5 rounded-full text-white/30 group-hover:text-primary-light group-hover:bg-primary/10 transition-all uppercase tracking-widest">{stats.localChapters} SEC.</span>
                </div>
                <div className="relative z-10 space-y-2">
                  <p className="font-headline italic text-7xl text-white group-hover:text-primary transition-colors duration-700 leading-none">{stats.mangas}</p>
                  <p className="text-[10px] uppercase font-black tracking-[0.4em] text-white/20 group-hover:text-white/40 transition-colors">Manga Segments</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-12">
            <div className="flex items-center justify-between border-b border-white/5 pb-8 px-4">
              <div>
                <h2 className="font-headline italic text-5xl tracking-tighter mb-2">Sequence Analysis</h2>
                <p className="text-[10px] uppercase font-black tracking-[0.5em] text-white/20">Collection registry statistics</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              <div 
                onClick={() => navigate('/books')}
                className="bg-white/[0.01] hover:bg-white/[0.03] p-12 rounded-[4rem] border border-white/5 hover:border-white/20 transition-all duration-700 shadow-2xl group cursor-pointer relative overflow-hidden h-80"
              >
                <div className="absolute -right-12 -top-12 text-[15rem] text-white/[0.02] group-hover:text-primary/5 group-hover:rotate-12 transition-all duration-[2s] font-headline italic select-none">S</div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-white/[0.03] flex items-center justify-center border border-white/5 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-700">
                    <span className="material-symbols-outlined text-4xl text-white/20 group-hover:text-primary transition-colors">folder_special</span>
                  </div>
                  <div className="space-y-2">
                    <p className="font-headline italic text-8xl text-white group-hover:text-primary transition-all duration-700 leading-none">{stats.series}</p>
                    <p className="text-[10px] uppercase font-black tracking-[0.5em] text-white/20 group-hover:text-white/40 transition-colors">Established Series</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/playlists')}
                className="bg-white/[0.01] hover:bg-white/[0.03] p-12 rounded-[4rem] border border-white/5 hover:border-white/20 transition-all duration-700 shadow-2xl group cursor-pointer relative overflow-hidden h-80"
              >
                <div className="absolute -right-12 -top-12 text-[15rem] text-white/[0.02] group-hover:text-primary/5 group-hover:-rotate-12 transition-all duration-[2s] font-headline italic select-none">P</div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-white/[0.03] flex items-center justify-center border border-white/5 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-700">
                    <span className="material-symbols-outlined text-4xl text-white/20 group-hover:text-primary transition-colors">queue_music</span>
                  </div>
                  <div className="space-y-2">
                    <p className="font-headline italic text-8xl text-white group-hover:text-primary transition-all duration-700 leading-none">{stats.playlists}</p>
                    <p className="text-[10px] uppercase font-black tracking-[0.5em] text-white/20 group-hover:text-white/40 transition-colors">Active Sequences</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* ── RIGHT COLUMN (Activity) ── */}
        <div className="xl:col-span-4 space-y-16">
          
          <section className="space-y-10">
            <h2 className="font-headline italic text-4xl tracking-tighter">Engagement Feed</h2>
            <div className="bg-[#0a0a0a]/40 backdrop-blur-3xl rounded-[3.5rem] border border-white/5 shadow-[0_40px_80px_rgba(0,0,0,0.4)] overflow-hidden">
              
              <div className="flex bg-white/[0.02] p-10 border-b border-white/5">
                <div className="flex-1 text-center border-r border-white/5 space-y-2">
                  <p className="text-[9px] uppercase font-black tracking-[0.4em] text-white/20">Finalized</p>
                  <p className="font-headline italic text-5xl leading-none">{stats.readingHabits.completed}</p>
                </div>
                <div className="flex-1 text-center space-y-2">
                  <p className="text-[9px] uppercase font-black tracking-[0.4em] text-primary/40">Engaged</p>
                  <p className="font-headline italic text-5xl leading-none text-primary">{stats.readingHabits.inProgress}</p>
                </div>
              </div>

              <div className="p-10 space-y-10">
                <h3 className="text-[9px] font-black uppercase tracking-[0.5em] text-white/20 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#8b5cf6]" />
                  Recent Terminals
                </h3>
                {stats.recentlyRead && stats.recentlyRead.length > 0 ? (
                  <div className="space-y-8">
                    {stats.recentlyRead.slice(0, 5).map((book, i) => (
                      <div 
                        key={book.id}
                        onClick={() => navigate('/reader', { state: { book } })}
                        className="flex items-center gap-6 group cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${0.8 + i * 0.1}s` }}
                      >
                        <div className="w-16 h-24 rounded-2xl overflow-hidden bg-[#111] shrink-0 border border-white/5 relative shadow-2xl group-hover:scale-105 transition-transform duration-700">
                          {book.thumbnail_url ? (
                            <img src={book.thumbnail_url.startsWith('http') ? book.thumbnail_url : `http://127.0.0.1:5000${book.thumbnail_url}`} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/5 group-hover:text-primary transition-colors"><span className="material-symbols-outlined text-2xl">auto_stories</span></div>
                          )}
                          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <span className="material-symbols-outlined text-white text-3xl font-variation-settings-fill-1">play_arrow</span>
                          </div>
                        </div>
                        <div className="flex-1 overflow-hidden space-y-3">
                          <p className="font-headline text-lg leading-tight truncate group-hover:text-primary transition-colors duration-500">{book.title}</p>
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary/40 to-primary group-hover:from-primary group-hover:to-primary-light transition-all duration-1000" style={{ width: book.type === 'manga' ? '100%' : `${book.progress || 0}%` }}></div>
                            </div>
                            <span className="text-[9px] font-black tracking-widest uppercase text-white/20 group-hover:text-white transition-colors">
                              {book.type === 'manga' ? (book.last_page ? `CH.${book.last_page}` : 'INIT') : `${Math.round(book.progress || 0)}%`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-24 border border-dashed border-white/10 rounded-[2.5rem] bg-white/[0.01] space-y-6">
                    <span className="material-symbols-outlined text-white/5 text-6xl mb-4 block animate-pulse">motion_photos_paused</span>
                    <p className="text-[10px] uppercase font-black text-white/20 tracking-[0.4em]">No active engagements</p>
                  </div>
                )}
              </div>

            </div>
          </section>

          <section className="space-y-10">
            <h2 className="font-headline italic text-4xl tracking-tighter">Theme Override</h2>
            <div className="bg-[#0a0a0a]/40 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-white/5 shadow-2xl flex flex-col gap-10">
              <div className="space-y-6">
                <p className="text-[9px] uppercase font-black tracking-[0.5em] text-white/20">Primary Interface Hue</p>
                <div className="flex items-center gap-8">
                  <div className="relative group/color">
                    <input 
                      type="color" 
                      defaultValue={localStorage.getItem('archive-theme') || '#8b5cf6'}
                      onChange={(e) => {
                        localStorage.setItem('archive-theme', e.target.value);
                        window.dispatchEvent(new Event('storage'));
                      }}
                      className="w-20 h-20 rounded-[1.5rem] cursor-pointer bg-transparent border-none outline-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/10 [&::-webkit-color-swatch]:rounded-[1.5rem] hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover/color:opacity-50 transition-opacity duration-500 pointer-events-none" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-headline text-2xl tracking-tight">Spectral Shift</p>
                    <p className="text-xs text-white/30 font-medium leading-relaxed">Modify the neural core accent color globally across all terminals.</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  localStorage.removeItem('archive-theme');
                  window.dispatchEvent(new Event('storage'));
                  window.location.reload();
                }}
                className="w-full py-5 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/20 transition-all text-[10px] font-black uppercase tracking-[0.4em] text-white/40 hover:text-white"
              >
                Reset System Default
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Profile;