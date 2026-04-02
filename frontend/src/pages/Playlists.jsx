import { useState, useEffect } from 'react';
import axios from 'axios';
import { useMusic } from '../context/useMusic';
import { useToast } from '../context/ToastContext';
import { Trash2, Play, ChevronRight, Activity, Clock, History, Plus, X } from 'lucide-react';

const Playlists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [smartPlaylists, setSmartPlaylists] = useState({ recentlyAdded: [], recentlyPlayed: [] });
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const { playTrack, currentTrack, isPlaying, toggleMainPlayer } = useMusic();
  const toast = useToast();

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
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const createPlaylist = async () => {
    if (!newPlaylistName) return;
    try {
      await axios.post('http://127.0.0.1:5000/api/playlists', { name: newPlaylistName });
      setNewPlaylistName('');
      setShowCreateModal(false);
      fetchPlaylists();
      toast.success('Sequence created successfully');
    } catch (err) { toast.error('Failed to create sequence'); }
  };

  const fetchPlaylistSongs = async (playlist) => {
    if (playlist.isSmart) {
      setPlaylistSongs(smartPlaylists[playlist.id] || []);
    } else {
      try {
        const res = await axios.get(`http://127.0.0.1:5000/api/playlists/${playlist.id}/songs`);
        setPlaylistSongs(res.data);
      } catch (err) { console.error(err); }
    }
  };

  useEffect(() => { fetchPlaylists(); }, []);
  useEffect(() => { if (selectedPlaylist) fetchPlaylistSongs(selectedPlaylist); }, [selectedPlaylist, smartPlaylists]);

  const deletePlaylist = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this sequence?')) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/playlists/${id}`);
      setPlaylists(playlists.filter(p => p.id !== id));
      if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
      toast.success('Sequence deleted');
    } catch (err) { toast.error('Failed to delete sequence'); }
  };

  const removeFromPlaylist = async (e, songId) => {
    e.stopPropagation();
    try {
      await axios.delete(`http://127.0.0.1:5000/api/playlists/${selectedPlaylist.id}/songs/${songId}`);
      setPlaylistSongs(playlistSongs.filter(s => s.id !== songId));
      toast.success('Artifact removed from sequence');
    } catch (err) { toast.error('Failed to remove artifact'); }
  };

  if (loading) return null;

  const smartCollections = [
    { id: 'recentlyAdded',  name: 'RECENT_ACQUISITIONS', isSmart: true, icon: <Clock size={20} />, songs: smartPlaylists.recentlyAdded },
    { id: 'recentlyPlayed', name: 'NEURAL_HISTORY', isSmart: true, icon: <History size={20} />, songs: smartPlaylists.recentlyPlayed },
  ];

  return (
    <div className="page-shell">
      <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between border-b border-border pb-8 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="status-online" />
            <span className="tech-label">Nodal Sequence Registry</span>
          </div>
          <h1 className="heading-lg">
            {selectedPlaylist ? selectedPlaylist.name : 'Collections'}
          </h1>
          <p className="tech-label-sm">{playlists.length + 2} sequences active</p>
        </div>
        
        <div className="flex gap-4">
          {!selectedPlaylist ? (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn-primary uppercase tracking-wider"
            >
              <Plus size={16} /> Create Sequence
            </button>
          ) : (
            <button 
              onClick={() => setSelectedPlaylist(null)}
              className="btn-secondary uppercase tracking-wider"
            >
              <ChevronRight size={16} className="rotate-180" /> Back to registry
            </button>
          )}
        </div>
      </header>

      {!selectedPlaylist ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...smartCollections, ...playlists].map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPlaylist(p)}
              className="group cursor-pointer card-interactive p-6 rounded-3xl flex flex-col gap-5 relative overflow-hidden"
            >
              <div className="aspect-square bg-zinc-900/50 rounded-2xl relative overflow-hidden">
                <CollageThumb songs={p.songs} thumbnails={p.thumbnails} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                   <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform duration-500 shadow-2xl">
                    <Play size={32} className="text-black ml-1" fill="currentColor" />
                  </div>
                </div>
                {!p.isSmart && (
                  <button onClick={(e) => deletePlaylist(e, p.id)} className="absolute top-4 right-4 p-2 bg-black/60 rounded-xl text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md"><Trash2 size={16} /></button>
                )}
              </div>
              <div className="space-y-2 px-1">
                <h3 className={`text-xl font-semibold truncate tracking-tight transition-colors ${p.id === 'recentlyAdded' ? 'text-primary' : 'text-white'}`}>{p.name}</h3>
                <p className="tech-label-sm">{p.isSmart ? 'System automated' : 'Custom node'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-surface/40 overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 md:px-8 py-4 border-b border-border bg-white/[0.02]">
            <div className="col-span-1 tech-label">Idx</div>
            <div className="col-span-6 tech-label">Artifact Identification</div>
            <div className="col-span-3 tech-label">Origin</div>
            <div className="col-span-2 tech-label text-right">Dur</div>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {playlistSongs.map((song, i) => {
              const isActive = currentTrack?.id === song.id;
              return (
                <div
                  key={song.id}
                  onClick={() => { playTrack(song, playlistSongs); toggleMainPlayer(true); }}
                  className={`grid grid-cols-12 gap-3 md:gap-4 px-4 md:px-8 py-4 items-center transition-all cursor-pointer group hover:bg-white/[0.02] ${isActive ? 'bg-primary/5' : ''}`}
                >
                  <div className="col-span-2 md:col-span-1 font-mono text-[11px] text-zinc-600">{(i + 1).toString().padStart(3, '0')}</div>
                  <div className="col-span-7 md:col-span-6 flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0">
                      <img src={song.thumbnail_url?.startsWith('http') ? song.thumbnail_url : `http://127.0.0.1:5000${song.thumbnail_url}`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[14px] font-bold truncate uppercase tracking-tight ${isActive ? 'text-primary' : 'text-white'}`}>{song.title}</p>
                      <p className="font-mono text-[8px] text-zinc-500 uppercase mt-0.5">{song.artist}</p>
                    </div>
                  </div>
                  <div className="hidden md:block md:col-span-3 font-mono text-[10px] text-zinc-500 truncate uppercase tracking-widest">{song.artist}</div>
                  <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-2 md:gap-6">
                    <span className="font-mono text-[10px] text-zinc-600">{song.duration || '00:00'}</span>
                    {!selectedPlaylist.isSmart && (
                      <button onClick={(e) => removeFromPlaylist(e, song.id)} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="overlay z-[500] flex items-center justify-center p-6 animate-in">
          <div className="modal w-full max-w-lg p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            <button onClick={() => setShowCreateModal(false)} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"><X size={22} /></button>
            
            <h3 className="heading-sm mb-1">Initialize Sequence</h3>
            <p className="tech-label-sm mb-8">Assign artifact identification</p>
            
            <input 
              autoFocus
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="SEQUENCE_NAME"
              className="input mb-6 font-mono uppercase"
            />
            
            <button 
              onClick={createPlaylist}
              className="w-full btn-primary btn-lg uppercase tracking-wider justify-center"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CollageThumb = ({ songs, thumbnails }) => {
  const getFullUrl = (url) => url.startsWith('http') ? url : `http://127.0.0.1:5000${url}`;
  
  // Combine thumbnails from either property
  const allThumbs = [
    ...(songs || []).map(s => s.thumbnail_url),
    ...(thumbnails || [])
  ].filter(Boolean).slice(0, 4);

  if (allThumbs.length === 0) return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-white/5">
      <Activity size={64} className="text-white/[0.02]" />
    </div>
  );

  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-px bg-white/5">
      {allThumbs.map((t, i) => (
        <img key={i} src={getFullUrl(t)} className="w-full h-full object-cover grayscale opacity-80" alt="" />
      ))}
      {allThumbs.length < 4 && Array(4 - allThumbs.length).fill(0).map((_, i) => (
        <div key={`empty-${i}`} className="bg-zinc-800/50" />
      ))}
    </div>
  );
};

export default Playlists;
