import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useMusic } from '../context/useMusic';
import { Activity, BookOpen, ChevronRight, Play } from 'lucide-react';

const Home = () => {
  const [recentSongs, setRecentSongs] = useState([]);
  const [recentBooks, setRecentBooks] = useState([]);
  const { playTrack, toggleMainPlayer } = useMusic();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [songsRes, booksRes] = await Promise.all([
          axios.get('http://127.0.0.1:5000/api/songs'),
          axios.get('http://127.0.0.1:5000/api/books'),
        ]);
        setRecentSongs(songsRes.data.slice(0, 5));
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
    <div className="page-shell">
      <section className="relative min-h-[62vh] border border-border rounded-[2rem] overflow-hidden group card shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        {recentSongs[0] ? (
          <>
            <img
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-25 grayscale group-hover:scale-105 transition-transform duration-[12s] ease-out"
              src={recentSongs[0].thumbnail_url?.startsWith('http') ? recentSongs[0].thumbnail_url : `http://127.0.0.1:5000${recentSongs[0].thumbnail_url}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg-dark/80 via-transparent to-transparent" />

            <div className="relative h-full flex flex-col justify-end p-8 md:p-12 lg:p-16 space-y-7">
              <div className="flex items-center gap-3">
                <span className="status-online" />
                <span className="tech-label text-primary">Archive Headline Signal</span>
              </div>

              <div className="max-w-5xl space-y-3">
                <h1 className="heading-xl leading-[0.86] uppercase">{recentSongs[0].title}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-text-secondary font-medium">{recentSongs[0].artist}</p>
                  <div className="h-px w-12 bg-white/20" />
                  <p className="tech-label-sm">Source: System Archive</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={() => handlePlaySong(recentSongs[0], recentSongs)} className="btn-primary btn-lg uppercase tracking-wider">
                  <Activity size={18} /> Play Now
                </button>
                <button onClick={() => navigate('/music')} className="btn-secondary btn-lg uppercase tracking-wider">
                  Browse Library
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center border-dashed border-border border-2 m-8 rounded-[1.5rem]">
            <span className="tech-label text-text-muted animate-pulse">Awaiting data input...</span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-12 gap-6 lg:gap-8">
        <div className="col-span-12 lg:col-span-7 space-y-8">
          <div className="section-header">
            <div className="space-y-1.5">
              <h3 className="heading-md uppercase">Sonic Artifacts</h3>
              <p className="tech-label-sm">Temporal sequence delta</p>
            </div>
            <button onClick={() => navigate('/music')} className="btn-ghost btn-icon tap-press">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="section-card grid gap-3">
            {recentSongs.slice(1).map((song) => (
              <div
                key={song.id}
                onClick={() => handlePlaySong(song, recentSongs)}
                className="group flex items-center p-4 md:p-5 gap-5 rounded-2xl card-interactive overflow-hidden relative tap-press"
              >
                <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-border shrink-0 relative overflow-hidden">
                  <img
                    src={song.thumbnail_url?.startsWith('http') ? song.thumbnail_url : `http://127.0.0.1:5000${song.thumbnail_url}`}
                    className="w-full h-full object-cover opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500"
                    alt=""
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary/20">
                    <Play size={20} className="text-black" fill="currentColor" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg text-white font-semibold truncate group-hover:text-primary transition-colors">{song.title}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-text-secondary truncate">{song.artist}</p>
                    <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                    <p className="tech-label-sm">{song.duration || '00:00'}</p>
                  </div>
                </div>
                <Activity size={18} className="text-white/10 group-hover:text-primary/50 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-8">
          <div className="section-header">
            <div className="space-y-1.5">
              <h3 className="heading-md uppercase">Literary Registry</h3>
              <p className="tech-label-sm">Recent manuscripts</p>
            </div>
            <button onClick={() => navigate('/books')} className="btn-ghost btn-icon tap-press">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="section-card grid grid-cols-2 gap-4 md:gap-5">
            {recentBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => navigate(book.type === 'manga' ? '/manga-chapters' : '/reader', { state: { book } })}
                className="group cursor-pointer space-y-3 tap-press"
              >
                <div className="aspect-[3/4] rounded-2xl border border-border bg-zinc-900 relative overflow-hidden group-hover:border-primary/20 transition-all duration-500">
                  <img src={book.thumbnail_url} className="w-full h-full object-cover grayscale opacity-45 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-700" alt="" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-1 px-1">
                  <h4 className="text-sm text-white font-semibold truncate group-hover:text-primary transition-colors">{book.title}</h4>
                  <p className="tech-label-sm">{book.author}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => navigate('/books')} className="w-full btn-secondary btn-lg rounded-2xl uppercase tracking-wider justify-center tap-press">
            <BookOpen size={18} /> Open Library
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
