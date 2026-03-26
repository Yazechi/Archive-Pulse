import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useMusic } from '../context/MusicContext';
import { useNavigate } from 'react-router-dom';

const Music = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const { playTrack, currentTrack, isPlaying, toggleMainPlayer } = useMusic();
  const navigate = useNavigate();
  const listRef = useRef(null);
  const scrollRafRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(700);
  const rowHeight = 89;
  const overscan = 8;

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`http://127.0.0.1:5000/api/songs?t=${Date.now()}`);
      setSongs(response.data);
    } catch (err) {
      console.error('Failed to fetch songs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/playlists');
      const playlistsWithSongs = await Promise.all(
        res.data.map(async (p) => {
          const songsRes = await axios.get(`http://127.0.0.1:5000/api/playlists/${p.id}/songs`);
          return { ...p, songs: songsRes.data };
        })
      );
      setPlaylists(playlistsWithSongs);
    } catch (err) {
      console.error('Failed to fetch playlists', err);
    }
  };

  const deleteSong = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this track?')) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/songs/${id}`);
      setSongs(songs.filter(s => s.id !== id));
    } catch (_err) {
      alert('Failed to remove entry');
    }
  };

  const addToPlaylist = async (playlistId) => {
    try {
      await axios.post(`http://127.0.0.1:5000/api/playlists/${playlistId}/songs`, {
        song_id: selectedSong.id
      });
      setShowPlaylistModal(false);
      alert('Added to sequence.');
    } catch (_err) {
      alert('Already in sequence.');
    }
  };

  useEffect(() => {
    fetchSongs();
    fetchPlaylists();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const updateHeight = () => setViewportHeight(el.clientHeight || 700);
    updateHeight();
    const obs = new ResizeObserver(updateHeight);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => () => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
  }, []);

  const startIndex = useMemo(
    () => Math.max(0, Math.floor(scrollTop / rowHeight) - overscan),
    [scrollTop]
  );
  const visibleCount = useMemo(
    () => Math.ceil(viewportHeight / rowHeight) + overscan * 2,
    [viewportHeight]
  );
  const endIndex = Math.min(songs.length, startIndex + visibleCount);
  const visibleSongs = songs.slice(startIndex, endIndex);
  const topSpacer = startIndex * rowHeight;
  const bottomSpacer = Math.max(0, (songs.length - endIndex) * rowHeight);

  const handleListScroll = (e) => {
    const nextTop = e.currentTarget.scrollTop;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => setScrollTop(nextTop));
  };

  return (
    <div className="space-y-24 pb-32 animate-fade-in text-white selection:bg-primary/30 max-w-7xl mx-auto px-4 md:px-0">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-12 border-b border-white/5 pb-16">
        <div className="space-y-6">
          <div className="px-5 py-2 rounded-full bg-primary/10 border border-primary/20 w-fit backdrop-blur-md">
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-light">Collection Index</span>
          </div>
          <h2 className="font-headline italic text-8xl md:text-9xl tracking-tighter text-gradient leading-[0.8] pb-2">
            Sonic Archive
          </h2>
          <p className="text-white/30 uppercase tracking-[0.6em] text-[10px] font-black ml-1">
            Curated Signal Captures & Local Frequency Streams
          </p>
        </div>
        <div className="flex gap-6 flex-wrap">
          {currentTrack && (
            <button
              onClick={() => toggleMainPlayer(true)}
              className="bg-primary/10 border border-primary/20 text-primary-light px-10 py-5 rounded-full font-black uppercase tracking-[0.3em] text-[11px] hover:bg-primary/20 transition-all flex items-center gap-4 group backdrop-blur-xl"
            >
              <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform font-variation-settings-fill-1">
                play_circle
              </span>
              Neural Stream
            </button>
          )}
          <button
            onClick={fetchSongs}
            disabled={loading}
            className={`border border-white/10 px-10 py-5 rounded-full font-black uppercase tracking-[0.3em] text-[11px] transition-all flex items-center gap-4 group backdrop-blur-md ${
              loading
                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className={`material-symbols-outlined text-2xl transition-transform duration-700 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`}>refresh</span> Sync
          </button>
          <button
            disabled={loading || songs.length < 2}
            onClick={() => setSongs([...songs].sort(() => Math.random() - 0.5))}
            className={`px-10 py-5 rounded-full font-black uppercase tracking-[0.3em] text-[11px] transition-all flex items-center gap-4 shadow-[0_20px_40px_rgba(255,255,255,0.05)] ${
              loading || songs.length < 2
                ? 'bg-white/15 text-black/40 cursor-not-allowed'
                : 'bg-white text-black hover:scale-105 hover:bg-primary hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">shuffle</span> Randomize
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-60 text-white/20">
          <div className="w-24 h-24 border-2 border-white/5 border-t-primary rounded-full animate-spin mb-10 shadow-[0_0_50px_rgba(139,92,246,0.2)]" />
          <p className="font-headline italic text-3xl tracking-tighter opacity-50">Synchronizing Neural Stream...</p>
        </div>
      ) : (
        /* ── Library table ── */
        <div
          ref={listRef}
          onScroll={handleListScroll}
          className="bg-[#0a0a0a]/20 backdrop-blur-3xl rounded-[3rem] p-4 md:p-8 border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.4)] overflow-auto custom-scrollbar max-h-[72vh]"
        >
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-white/5">
                <th className="pb-6 px-4 font-body uppercase tracking-[0.4em] text-[9px] text-white/20 font-black w-16 text-center">Id</th>
                <th className="pb-6 px-4 font-body uppercase tracking-[0.4em] text-[9px] text-white/20 font-black">Identification</th>
                <th className="pb-6 px-4 font-body uppercase tracking-[0.4em] text-[9px] text-white/20 font-black hidden lg:table-cell">Frequency Origin</th>
                <th className="pb-6 px-4 font-body uppercase tracking-[0.4em] text-[9px] text-white/20 font-black text-right w-32">Temporal</th>
                <th className="pb-6 px-4 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {topSpacer > 0 && (
                <tr>
                  <td colSpan="5" style={{ height: `${topSpacer}px`, border: 0, padding: 0 }} />
                </tr>
              )}

              {visibleSongs.map((song, localIndex) => {
                const index = startIndex + localIndex;
                const isThisPlaying = currentTrack?.id === song.id && isPlaying;
                const isActive = currentTrack?.id === song.id;
                return (
                  <tr
                    key={song.id}
                    onClick={() => { playTrack(song, songs); toggleMainPlayer(true); }}
                    className={`group transition-all duration-500 cursor-pointer hover:bg-white/[0.04] ${isActive ? 'bg-primary/5' : ''}`}
                  >
                    <td className="py-4 px-4 font-headline italic text-xl text-center">
                      {isThisPlaying ? (
                        <div className="flex items-center justify-center gap-1 h-4">
                          <div className="w-0.5 bg-primary rounded-full animate-wave h-full" />
                          <div className="w-0.5 bg-primary rounded-full animate-wave h-2/3" style={{ animationDelay: '0.2s' }} />
                          <div className="w-0.5 bg-primary rounded-full animate-wave h-1/2" style={{ animationDelay: '0.4s' }} />
                        </div>
                      ) : (
                        <span className={`transition-all duration-500 ${isActive ? 'text-primary' : 'text-white/5 group-hover:text-white/40'}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[#111] shrink-0 overflow-hidden relative border border-white/5 shadow-xl group-hover:scale-105 transition-transform duration-500">
                          {song.thumbnail_url ? (
                            <img
                              src={song.thumbnail_url.startsWith('http') ? song.thumbnail_url : `http://127.0.0.1:5000${song.thumbnail_url}`}
                              alt=""
                              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10">
                              <span className="material-symbols-outlined text-2xl">music_note</span>
                            </div>
                          )}
                          <div className={`absolute inset-0 bg-primary/30 flex items-center justify-center transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <span className="material-symbols-outlined text-white text-3xl font-variation-settings-fill-1">
                              {isThisPlaying ? 'pause' : 'play_arrow'}
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden space-y-1">
                          <span className={`font-headline text-xl tracking-tight truncate block transition-colors duration-500 leading-none ${isActive ? 'text-primary' : 'text-white group-hover:text-primary-light'}`}>
                            {song.title}
                          </span>
                          <span className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-black block truncate lg:hidden">
                            {song.artist}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-white/30 hidden lg:table-cell font-body text-sm group-hover:text-white/60 transition-colors uppercase tracking-widest font-bold">
                      {song.artist}
                    </td>
                    <td className="py-4 px-4 text-white/20 text-right font-headline tracking-[0.1em] text-xl group-hover:text-white/50 transition-colors tabular-nums italic">
                      {song.duration || '--:--'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedSong(song); setShowPlaylistModal(true); }}
                          className="opacity-0 group-hover:opacity-100 w-10 h-10 rounded-xl bg-white/5 text-white/20 hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all duration-300"
                          title="Integrate into sequence"
                        >
                          <span className="material-symbols-outlined text-xl">playlist_add</span>
                        </button>
                        <button
                          onClick={(e) => deleteSong(e, song.id)}
                          className="opacity-0 group-hover:opacity-100 w-10 h-10 rounded-xl bg-white/5 text-white/20 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all duration-300"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {bottomSpacer > 0 && (
                <tr>
                  <td colSpan="5" style={{ height: `${bottomSpacer}px`, border: 0, padding: 0 }} />
                </tr>
              )}

              {songs.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-60 text-center text-white/10">
                    <span className="material-symbols-outlined text-[10rem] mb-10 block opacity-20">music_off</span>
                    <p className="font-headline italic text-4xl tracking-tighter opacity-50">No sonic artifacts detected.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Playlist Modal ──────────────────────────────────────────────────── */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/60 animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-[3.5rem] w-full max-w-lg p-12 shadow-[0_50px_100px_rgba(0,0,0,0.9)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-light to-secondary opacity-50" />
            
            <h3 className="font-headline italic text-5xl tracking-tighter mb-3 text-gradient">Select Sequence</h3>
            <p className="text-white/30 uppercase tracking-[0.4em] text-[10px] font-black mb-12">
              Integrate artifact into established collection
            </p>
            
            <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-4 mb-12 custom-scrollbar">
              {playlists.map(p => {
                const isAlreadyInPlaylist = p.songs?.some(s => s.id === selectedSong?.id);
                if (isAlreadyInPlaylist) return null;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToPlaylist(p.id)}
                    className="w-full text-left p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1">
                      <p className="font-headline text-2xl tracking-tight group-hover:text-primary-light transition-colors">{p.name}</p>
                      <p className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-bold">{p.description || 'Custom archive'}</p>
                    </div>
                    <span className="material-symbols-outlined text-white/20 group-hover:text-primary transition-all text-3xl">add_circle</span>
                  </button>
                );
              })}
              {playlists.every(p => p.songs?.some(s => s.id === selectedSong?.id)) && (
                <div className="text-center py-16 px-8 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                  <p className="text-white/20 font-headline italic text-xl">Artifact already present in all active sequences.</p>
                </div>
              )}
              {playlists.length === 0 && (
                <div className="text-center py-16 px-8 border-2 border-dashed border-white/5 rounded-[2.5rem] space-y-6">
                  <p className="text-white/20 font-headline italic text-xl">No sequences detected in neural network</p>
                  <button
                    onClick={() => { setShowPlaylistModal(false); navigate('/playlists'); }}
                    className="text-primary-light text-[10px] uppercase font-black tracking-[0.3em] hover:text-white transition-colors"
                  >
                    Initialize First Sequence
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowPlaylistModal(false)}
              className="w-full py-5 bg-white/5 border border-white/10 rounded-full font-black uppercase tracking-[0.2em] text-[11px] hover:bg-white/10 hover:text-white transition-all text-white/60"
            >
              Terminate Operation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Music;
