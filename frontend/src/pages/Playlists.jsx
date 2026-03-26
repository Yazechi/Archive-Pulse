import { useState, useEffect } from 'react';
import axios from 'axios';
import { useMusic } from '../context/MusicContext';

const Playlists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [smartPlaylists, setSmartPlaylists] = useState({ recentlyAdded: [], recentlyPlayed: [] });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const { playTrack, currentTrack, isPlaying, toggleMainPlayer } = useMusic();

  const fetchPlaylists = async () => {
    try {
      const [resPlaylists, resRecentlyAdded, resRecentlyPlayed] = await Promise.all([
        axios.get('http://127.0.0.1:5000/api/playlists'),
        axios.get('http://127.0.0.1:5000/api/songs/smart/recently-added'),
        axios.get('http://127.0.0.1:5000/api/songs/smart/recently-played')
      ]);
      setPlaylists(resPlaylists.data);
      setSmartPlaylists({
        recentlyAdded: resRecentlyAdded.data,
        recentlyPlayed: resRecentlyPlayed.data
      });
    } catch (err) {
      console.error('Failed to fetch playlists', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylistSongs = async (playlist) => {
    if (playlist.isSmart) {
      setPlaylistSongs(smartPlaylists[playlist.id] || []);
    } else {
      try {
        const res = await axios.get(`http://127.0.0.1:5000/api/playlists/${playlist.id}/songs`);
        setPlaylistSongs(res.data);
      } catch (err) {
        console.error('Failed to fetch playlist songs', err);
      }
    }
  };

  useEffect(() => { fetchPlaylists(); }, []);

  useEffect(() => {
    if (selectedPlaylist) fetchPlaylistSongs(selectedPlaylist);
  }, [selectedPlaylist, smartPlaylists]);

  const createPlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName) return;
    try {
      await axios.post('http://127.0.0.1:5000/api/playlists', {
        name: newPlaylistName,
        description: newPlaylistDesc
      });
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
      fetchPlaylists();
    } catch (err) {
      alert('Failed to create playlist');
    }
  };

  const deletePlaylist = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this playlist?')) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/playlists/${id}`);
      if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
      fetchPlaylists();
    } catch (err) {
      alert('Failed to delete playlist');
    }
  };

  const removeFromPlaylist = async (e, songId) => {
    e.stopPropagation();
    if (selectedPlaylist.isSmart) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/playlists/${selectedPlaylist.id}/songs/${songId}`);
      fetchPlaylistSongs(selectedPlaylist);
    } catch (err) {
      alert('Failed to remove song');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center py-40 text-white/20">
      <div className="w-16 h-16 border-2 border-white/5 border-t-primary rounded-full animate-spin mb-8" />
      <p className="font-headline italic text-2xl tracking-tighter">Accessing Neural Archives...</p>
    </div>
  );

  const smartCollections = [
    { id: 'recentlyAdded',  name: 'Recently Added',  description: 'Latest acquisitions', isSmart: true, icon: 'schedule' },
    { id: 'recentlyPlayed', name: 'Recently Played', description: 'Neural history', isSmart: true, icon: 'history'  },
  ];

  const pageTitle = selectedPlaylist ? selectedPlaylist.name : 'Collections';
  const pageSubtitle = selectedPlaylist ? (selectedPlaylist.description || 'Custom sonic archive') : 'Curated sonic sequences';

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-0 pb-40 animate-fade-in text-white selection:bg-primary/30">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between mb-20 border-b border-white/5 pb-16 gap-12">
        <div className="space-y-6">
          <div className="px-5 py-2 rounded-full bg-primary/10 border border-primary/20 w-fit backdrop-blur-md">
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-light">Sequence Registry</span>
          </div>
          <h2 className="font-headline italic text-8xl md:text-9xl tracking-tighter text-gradient leading-[0.8] pb-2">{pageTitle}</h2>
          <p className="text-white/30 uppercase tracking-[0.6em] text-[10px] font-black ml-1">{pageSubtitle}</p>
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
          {selectedPlaylist && (
            <button
              onClick={() => { setSelectedPlaylist(null); }}
              className="bg-white/5 border border-white/10 text-white/40 px-10 py-5 rounded-full font-black uppercase tracking-[0.3em] text-[11px] hover:bg-white/10 hover:text-white transition-all flex items-center gap-4 group backdrop-blur-md"
            >
              <span className="material-symbols-outlined text-2xl group-hover:-translate-x-1 transition-transform">arrow_back</span> Return to Grid
            </button>
          )}
          {!selectedPlaylist && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white text-black px-10 py-5 rounded-full font-black uppercase tracking-[0.3em] text-[11px] hover:scale-105 hover:bg-primary hover:text-white transition-all flex items-center gap-4 shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
            >
              <span className="material-symbols-outlined text-2xl">add</span> Initialize Sequence
            </button>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {!selectedPlaylist ? (
        /* ── Playlist grid ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">

          {/* Smart Collections */}
          {smartCollections.map((p, i) => {
            const thumbnails = (smartPlaylists[p.id] || []).map(s => s.thumbnail_url).filter(Boolean).slice(0, 3);
            return (
              <div
                key={p.id}
                onClick={() => { setSelectedPlaylist(p); }}
                className="group cursor-pointer bg-primary/[0.03] border border-primary/10 rounded-[4rem] p-10 hover:bg-primary/[0.06] hover:border-primary/40 hover:-translate-y-2 transition-all duration-700 shadow-2xl relative overflow-hidden animate-fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <PlaylistCover thumbnails={thumbnails} icon={p.icon} isPrimary />
                <h3 className="font-headline text-3xl mb-3 group-hover:text-primary transition-colors truncate leading-tight">{p.name}</h3>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black truncate">{p.description}</p>
              </div>
            );
          })}

          {/* Regular Playlists */}
          {playlists.map((p, i) => (
            <div
              key={p.id}
              onClick={() => { setSelectedPlaylist(p); }}
              className="group cursor-pointer bg-white/[0.01] border border-white/5 rounded-[4rem] p-10 hover:bg-white/[0.04] hover:border-white/20 hover:-translate-y-2 transition-all duration-700 shadow-2xl relative overflow-hidden animate-fade-in"
              style={{ animationDelay: `${(smartCollections.length + i) * 0.1}s` }}
            >
              <PlaylistCover thumbnails={(p.thumbnails || []).filter(Boolean).slice(0, 3)} icon="library_music" />
              <h3 className="font-headline text-3xl mb-3 group-hover:text-primary transition-colors truncate leading-tight">{p.name}</h3>
              <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-black truncate">
                {p.description || 'Archived Collection'}
              </p>
              <button
                onClick={(e) => deletePlaylist(e, p.id)}
                className="absolute top-8 right-8 w-12 h-12 rounded-[1.5rem] bg-black/60 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-2xl border border-white/10 hover:bg-red-500/10 hover:border-red-500/20"
              >
                <span className="material-symbols-outlined text-2xl">delete</span>
              </button>
            </div>
          ))}

          {playlists.length === 0 && (
            <div className="col-span-full py-60 text-center border-2 border-dashed border-white/5 rounded-[5rem] bg-white/[0.01]">
              <span className="material-symbols-outlined text-[10rem] text-white/5 mb-10 block opacity-20">reorder</span>
              <p className="font-headline italic text-4xl text-white/20 tracking-tighter">No neural sequences established.</p>
            </div>
          )}
        </div>

      ) : (
        /* ── Playlist song table ── */
        <div className="bg-[#0a0a0a]/20 backdrop-blur-3xl rounded-[3rem] p-4 md:p-8 border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.4)] overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-white/5">
                <th className="pb-6 px-4 font-body uppercase tracking-[0.4em] text-[9px] text-white/20 font-black w-16 text-center">Id</th>
                <th className="pb-6 px-4 font-body uppercase tracking-[0.4em] text-[9px] text-white/20 font-black">Identification</th>
                <th className="pb-6 px-4 font-body uppercase tracking-[0.4em] text-[9px] text-white/20 font-black hidden lg:table-cell">Frequency Origin</th>
                <th className="pb-6 px-4 font-body uppercase tracking-[0.4em] text-[9px] text-white/20 font-black text-right w-32">Temporal</th>
                {!selectedPlaylist.isSmart && <th className="pb-6 px-4 w-28" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {playlistSongs.map((song, index) => {
                const isActive = currentTrack?.id === song.id;
                const isThisPlaying = isActive && isPlaying;
                return (
                  <tr
                    key={song.id}
                    className={`group transition-all duration-500 cursor-pointer hover:bg-white/[0.04] ${isActive ? 'bg-primary/5' : ''}`}
                    onClick={() => { playTrack(song, playlistSongs); toggleMainPlayer(true); }}
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
                    {!selectedPlaylist.isSmart && (
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={(e) => removeFromPlaylist(e, song.id)}
                          className="opacity-0 group-hover:opacity-100 w-10 h-10 rounded-xl bg-white/5 text-white/20 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all duration-300"
                        >
                          <span className="material-symbols-outlined text-xl">close</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {playlistSongs.length === 0 && (
                <tr>
                  <td colSpan={selectedPlaylist.isSmart ? 4 : 5} className="py-60 text-center text-white/10 font-headline italic text-4xl tracking-tighter opacity-50">
                    Sequence contains no data captures.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Playlist Modal ───────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/60 animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-[3.5rem] w-full max-w-lg p-12 shadow-[0_50px_100px_rgba(0,0,0,0.9)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-light to-secondary opacity-50" />
            
            <h3 className="font-headline italic text-5xl tracking-tighter mb-8 text-gradient">Initialize Sequence</h3>
            <form onSubmit={createPlaylist} className="space-y-8">
              <div className="space-y-3">
                <label className="block text-white/30 uppercase tracking-[0.4em] text-[9px] font-black ml-6">Frequency Identifier</label>
                <input
                  autoFocus
                  type="text"
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-3xl px-8 py-5 text-white focus:outline-none focus:border-primary transition-all duration-500 text-lg font-headline tracking-tight"
                  placeholder="Ex: Nocturnal Transmissions"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-white/30 uppercase tracking-[0.4em] text-[9px] font-black ml-6">Aesthetic Metadata</label>
                <textarea
                  value={newPlaylistDesc}
                  onChange={e => setNewPlaylistDesc(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-3xl px-8 py-5 text-white focus:outline-none focus:border-primary transition-all duration-500 h-32 resize-none text-sm leading-relaxed"
                  placeholder="Describe the sonic atmosphere..."
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-5 bg-white/5 border border-white/10 rounded-full font-black uppercase tracking-[0.2em] text-[11px] hover:bg-white/10 transition-all text-white/60"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  className="flex-1 py-5 bg-white text-black rounded-full font-black uppercase tracking-[0.2em] text-[11px] hover:scale-105 transition-all shadow-xl"
                >
                  Confirm Init
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const PlaylistCover = ({ thumbnails, icon, isPrimary }) => (
  <div className={`aspect-square ${isPrimary ? 'bg-primary/10' : 'bg-[#111]'} rounded-[2rem] mb-8 flex items-center justify-center relative overflow-hidden border border-white/5`}>
    {thumbnails.length > 0 ? (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 p-1">
        {thumbnails[0] && (
          <div className={`relative ${thumbnails.length === 1 ? 'col-span-2 row-span-2' : 'col-span-1 row-span-2'}`}>
            <img
              src={thumbnails[0].startsWith('http') ? thumbnails[0] : `http://127.0.0.1:5000${thumbnails[0]}`}
              className="absolute inset-0 w-full h-full object-cover rounded-xl"
              alt=""
            />
          </div>
        )}
        {thumbnails[1] && (
          <div className={`relative ${thumbnails.length === 2 ? 'col-span-1 row-span-2' : 'col-span-1 row-span-1'}`}>
            <img
              src={thumbnails[1].startsWith('http') ? thumbnails[1] : `http://127.0.0.1:5000${thumbnails[1]}`}
              className="absolute inset-0 w-full h-full object-cover rounded-xl"
              alt=""
            />
          </div>
        )}
        {thumbnails[2] && (
          <div className="relative col-span-1 row-span-1">
            <img
              src={thumbnails[2].startsWith('http') ? thumbnails[2] : `http://127.0.0.1:5000${thumbnails[2]}`}
              className="absolute inset-0 w-full h-full object-cover rounded-xl"
              alt=""
            />
          </div>
        )}
      </div>
    ) : (
      <span className={`material-symbols-outlined text-7xl ${isPrimary ? 'text-primary/40' : 'text-white/5'} group-hover:scale-110 transition-transform duration-700`}>
        {icon}
      </span>
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-8">
      <div className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-2xl translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
        <span className="material-symbols-outlined text-3xl font-variation-settings-fill-1">play_arrow</span>
      </div>
    </div>
  </div>
);

export default Playlists;