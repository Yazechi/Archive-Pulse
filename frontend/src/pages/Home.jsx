import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';

const Home = () => {
  const [recentSongs, setRecentSongs] = useState([]);
  const [recentBooks, setRecentBooks] = useState([]);
  const { playTrack, currentTrack, isPlaying, toggleMainPlayer } = useMusic();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [songsRes, booksRes] = await Promise.all([
          axios.get('http://127.0.0.1:5000/api/songs'),
          axios.get('http://127.0.0.1:5000/api/books')
        ]);
        setRecentSongs(songsRes.data.slice(0, 4));
        setRecentBooks(booksRes.data.slice(0, 4));
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
    };
    fetchData();
  }, []);

  const handlePlaySong = (song, list) => {
    playTrack(song, list);
    toggleMainPlayer(true);
  };

  return (
    <div className="space-y-40 pb-40 animate-fade-in text-white selection:bg-primary/30 max-w-7xl mx-auto">

      {/* ── Hero Section ── */}
      <section className="relative h-[80vh] min-h-[700px] rounded-[4rem] overflow-hidden border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.5)] group">
        {recentSongs[0] ? (
          <>
            <div className="absolute inset-0">
              <img
                alt="Featured Cover"
                className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-[5s] ease-out blur-sm group-hover:blur-0"
                src={recentSongs[0].thumbnail_url?.startsWith('http') ? recentSongs[0].thumbnail_url : `http://127.0.0.1:5000${recentSongs[0].thumbnail_url}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/90 via-transparent to-transparent" />
            </div>

            <div className="relative h-full flex flex-col justify-end p-12 md:p-24 space-y-10 max-w-5xl">
              <div className="flex items-center gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="px-6 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-xl">
                  <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-light">Featured Artifact</span>
                </div>
                {currentTrack?.id === recentSongs[0].id && isPlaying && (
                  <div className="flex gap-1.5 h-4 items-end">
                    <div className="w-1 bg-primary animate-wave h-full" />
                    <div className="w-1 bg-primary animate-wave h-2/3" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1 bg-primary animate-wave h-1/2" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>

              <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <h2 className="font-headline italic text-8xl md:text-[10rem] tracking-tighter leading-[0.8] text-gradient pb-4">
                  {recentSongs[0].title}
                </h2>
                <div className="flex items-center gap-4 ml-2">
                  <div className="w-8 h-px bg-white/20" />
                  <p className="font-body text-xl uppercase tracking-[0.6em] text-white/50 font-bold">
                    {recentSongs[0].artist}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8 pt-10 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                <button
                  onClick={() => handlePlaySong(recentSongs[0], recentSongs)}
                  className="px-12 py-6 bg-white text-black rounded-full font-black uppercase tracking-[0.3em] text-[12px] hover:scale-105 hover:bg-primary hover:text-white active:scale-95 transition-all shadow-[0_25px_50px_rgba(255,255,255,0.1)] flex items-center gap-4 group/btn"
                >
                  <span className="material-symbols-outlined text-2xl group-hover/btn:scale-110 transition-transform" style={{ fontVariationSettings: '"FILL" 1' }}>play_arrow</span>
                  Commence Playback
                </button>
                <button
                  onClick={() => navigate('/music')}
                  className="px-12 py-6 bg-white/5 border border-white/10 text-white rounded-full font-black uppercase tracking-[0.3em] text-[12px] hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-md"
                >
                  Browse Archive
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-white/10 bg-white/[0.02]">
            <span className="material-symbols-outlined text-[10rem] mb-8 animate-pulse">database</span>
            <p className="font-headline italic text-4xl tracking-tighter opacity-50">Awaiting Artifact Integration</p>
          </div>
        )}
      </section>

      {/* ── Grid Sections ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-24 px-4 md:px-0">

        {/* Recent Sonic Artifacts */}
        <section className="xl:col-span-2 space-y-16">
          <div className="flex items-center justify-between border-b border-white/5 pb-10">
            <div>
              <h3 className="font-headline italic text-5xl tracking-tighter mb-3">Sonic Artifacts</h3>
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/30 font-black">Latest frequency captures</p>
            </div>
            <button onClick={() => navigate('/music')} className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all group">
              <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {recentSongs.map((song, i) => (
              <div
                key={song.id}
                onClick={() => handlePlaySong(song, recentSongs)}
                className="group flex items-center gap-8 p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-primary/40 hover:-translate-y-2 transition-all duration-700 cursor-pointer animate-fade-in shadow-xl"
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}
              >
                <div className="w-24 h-24 rounded-[1.5rem] overflow-hidden shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-700 shadow-2xl relative">
                  {song.thumbnail_url ? (
                    <img src={song.thumbnail_url?.startsWith('http') ? song.thumbnail_url : `http://127.0.0.1:5000${song.thumbnail_url}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#111] flex items-center justify-center text-white/20">
                      <span className="material-symbols-outlined text-4xl">music_note</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: '"FILL" 1' }}>play_arrow</span>
                  </div>
                </div>
                <div className="overflow-hidden space-y-2">
                  <h4 className="font-headline text-2xl truncate group-hover:text-primary transition-colors leading-tight">{song.title}</h4>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-black truncate">{song.artist}</p>
                  {currentTrack?.id === song.id && isPlaying && (
                    <div className="flex gap-1 h-3 items-end mt-1">
                      <div className="w-0.5 bg-primary animate-wave h-full" />
                      <div className="w-0.5 bg-primary animate-wave h-2/3" style={{ animationDelay: '0.2s' }} />
                      <div className="w-0.5 bg-primary animate-wave h-1/2" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Literature Sidebar */}
        <section className="space-y-16">
          <div className="flex items-center justify-between border-b border-white/5 pb-10">
            <div>
              <h3 className="font-headline italic text-5xl tracking-tighter mb-3">Literature</h3>
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/30 font-black">Literary captures</p>
            </div>
          </div>

          <div className="space-y-8">
            {recentBooks.map((book, i) => (
              <div
                key={book.id}
                onClick={() => navigate('/reader', { state: { book } })}
                className="group flex items-center gap-8 p-6 rounded-[2.5rem] bg-white/[0.01] border border-transparent hover:bg-white/[0.03] hover:border-white/5 transition-all duration-700 cursor-pointer animate-fade-in"
                style={{ animationDelay: `${0.4 + i * 0.1}s` }}
              >
                <div className="w-20 h-28 rounded-2xl overflow-hidden shrink-0 border border-white/5 group-hover:scale-105 group-hover:border-primary/40 transition-all duration-700 shadow-2xl">
                  {book.thumbnail_url ? (
                    <img src={book.thumbnail_url} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
                  ) : (
                    <div className="w-full h-full bg-[#111] flex items-center justify-center text-white/10">
                      <span className="material-symbols-outlined text-3xl">menu_book</span>
                    </div>
                  )}
                </div>
                <div className="overflow-hidden space-y-3 flex-1">
                  <h4 className="font-headline text-xl leading-tight truncate group-hover:text-primary transition-colors">{book.title}</h4>
                  <p className="text-[9px] uppercase tracking-widest text-white/40 font-black truncate">{book.author}</p>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary/40 to-primary group-hover:from-primary group-hover:to-primary-light transition-all duration-1000 shadow-[0_0_10px_rgba(139,92,246,0.5)]" style={{ width: `${book.progress || 0}%` }} />
                    </div>
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">{book.progress || 0}%</span>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate('/books')}
              className="w-full py-6 rounded-[2.5rem] border border-dashed border-white/10 text-[10px] uppercase tracking-[0.5em] font-black text-white/20 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all mt-6"
            >
              Access Library
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Home;