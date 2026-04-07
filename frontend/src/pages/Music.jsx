import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useMusic } from '../context/useMusic';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, ListPlus, RefreshCcw, Shuffle, CheckSquare, Square, X, Play } from 'lucide-react';
import { FavoriteButton, useFavorites } from '../components/FavoriteButton';
import DropdownSelect from '../components/DropdownSelect';

const Music = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [editSongForm, setEditSongForm] = useState({ title: '', artist: '', album: '', duration: '' });
  const [sortBy, setSortBy] = useState('created_desc');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState(new Set());
  const { playTrack, currentTrack, isPlaying, toggleMainPlayer } = useMusic();
  const toast = useToast();
  const navigate = useNavigate();
  const listRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const { fetchFavorites, isFavorite, setFavoriteState } = useFavorites('song');
  const rowHeight = 80;

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`http://127.0.0.1:5000/api/songs?t=${Date.now()}`);
      setSongs(response.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchPlaylists = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/playlists');
      setPlaylists(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchSongs();
    fetchPlaylists();
    fetchFavorites();
  }, []);

  const createPlaylist = async () => {
    if (!newPlaylistName) return;
    try {
      await axios.post('http://127.0.0.1:5000/api/playlists', { name: newPlaylistName });
      setNewPlaylistName('');
      setShowCreateModal(false);
      fetchPlaylists();
      toast.success('Sequence initialized successfully');
    } catch (err) { toast.error('Failed to create sequence'); }
  };

  const deleteSong = async (id) => {
    if (!window.confirm('Purge this artifact?')) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/songs/${id}`);
      setSongs(songs.filter(s => s.id !== id));
      toast.success('Artifact purged from registry');
    } catch (err) { toast.error('Failed to purge artifact'); }
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Purge ${selectedSongs.size} artifacts?`)) return;
    try {
      await Promise.all(Array.from(selectedSongs).map(id => axios.delete(`http://127.0.0.1:5000/api/songs/${id}`)));
      setSongs(songs.filter(s => !selectedSongs.has(s.id)));
      setIsBatchMode(false);
      setSelectedSongs(new Set());
      toast.success(`${selectedSongs.size} artifacts purged`);
    } catch (err) { toast.error('Partial failure during purge operation'); }
  };

  const addToPlaylist = async (playlistId) => {
    try {
      const ids = isBatchMode ? Array.from(selectedSongs) : [selectedSong.id];
      await Promise.all(ids.map(id => axios.post(`http://127.0.0.1:5000/api/playlists/${playlistId}/songs`, { song_id: id })));
      setShowPlaylistModal(false);
      setIsBatchMode(false);
      setSelectedSongs(new Set());
      setSelectedSong(null);
      toast.success(`${ids.length} artifact${ids.length > 1 ? 's' : ''} added to sequence`);
    } catch (err) { toast.warning('Some artifacts already exist in sequence'); }
  };

  const openEditSongModal = (song, e) => {
    e.stopPropagation();
    setEditSongForm({
      title: song.title || '',
      artist: song.artist || '',
      album: song.album || '',
      duration: song.duration || ''
    });
    setEditingSong(song);
  };

  const saveSongMetadata = async () => {
    if (!editingSong) return;
    try {
      await axios.put(`http://127.0.0.1:5000/api/songs/${editingSong.id}/metadata`, editSongForm);
      await fetchSongs();
      toast.success('Song metadata updated');
      setEditingSong(null);
    } catch (err) {
      toast.error('Failed to update song metadata');
    }
  };

  const parseDurationSeconds = (duration) => {
    if (!duration || typeof duration !== 'string' || !duration.includes(':')) return 0;
    const parts = duration.split(':').map((v) => Number(v));
    if (parts.some((v) => Number.isNaN(v))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const sortedSongs = useMemo(() => {
    const list = [...songs];
    if (sortBy === 'title_asc') return list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    if (sortBy === 'artist_asc') return list.sort((a, b) => String(a.artist || '').localeCompare(String(b.artist || '')));
    if (sortBy === 'duration_desc') return list.sort((a, b) => parseDurationSeconds(b.duration) - parseDurationSeconds(a.duration));
    if (sortBy === 'play_count_desc') return list.sort((a, b) => (Number(b.play_count) || 0) - (Number(a.play_count) || 0));
    return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [songs, sortBy]);

  const visibleSongs = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
    const end = Math.min(sortedSongs.length, start + 15);
    return sortedSongs.slice(start, end).map((s, i) => ({ ...s, originalIndex: start + i }));
  }, [sortedSongs, scrollTop]);

  return (
    <div className="page-shell">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-border pb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="status-online" />
            <span className="tech-label text-primary">Core Archive Registry</span>
          </div>
          <h1 className="heading-lg">Sonic Artifacts</h1>
          <p className="tech-label-sm">{songs.length} Nodes Indexed</p>
        </div>
        
        <div className="flex gap-4 flex-wrap">
          <DropdownSelect
            value={sortBy}
            onChange={setSortBy}
            className="min-w-[190px]"
            options={[
              { value: 'created_desc', label: 'Newest first' },
              { value: 'title_asc', label: 'Title A-Z' },
              { value: 'artist_asc', label: 'Artist A-Z' },
              { value: 'duration_desc', label: 'Longest duration' },
              { value: 'play_count_desc', label: 'Most played' },
            ]}
          />
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-primary uppercase tracking-wider"
          >
            <Plus size={16} /> New Sequence
          </button>
          
          {isBatchMode && (
            <div className="flex items-center gap-2 bg-surface/60 border border-border p-1 rounded-xl animate-in">
              <button onClick={() => setShowPlaylistModal(true)} disabled={selectedSongs.size === 0} className="btn-primary btn-sm uppercase tracking-wider disabled:opacity-50"><ListPlus size={14} /> Add to Sequence</button>
              <button onClick={deleteSelected} disabled={selectedSongs.size === 0} className="btn-danger btn-sm uppercase tracking-wider disabled:opacity-50"><Trash2 size={14} /> Purge</button>
            </div>
          )}
          
          <button
            onClick={() => { setIsBatchMode(!isBatchMode); setSelectedSongs(new Set()); }}
            className={isBatchMode ? 'btn-primary uppercase tracking-wider' : 'btn-secondary uppercase tracking-wider'}
          >
            {isBatchMode ? <CheckSquare size={16} /> : <Square size={16} />}
            {isBatchMode ? 'Cancel Selection' : 'Batch Select'}
          </button>
          <button onClick={fetchSongs} className="btn-secondary btn-icon"><RefreshCcw size={18} /></button>
          <button onClick={() => setSongs([...songs].sort(() => Math.random() - 0.5))} className="btn-secondary uppercase tracking-wider"><Shuffle size={16} /> Randomize</button>
        </div>
      </header>

      <div className="relative rounded-3xl border border-border bg-surface/40 overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 md:px-8 py-4 border-b border-border bg-white/[0.02]">
          <div className="col-span-1 tech-label">ID</div>
          <div className="col-span-6 tech-label">Identification</div>
          <div className="col-span-3 tech-label">Frequency Origin</div>
          <div className="col-span-2 tech-label text-right">Temporal</div>
        </div>

        <div ref={listRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="h-[60vh] overflow-y-auto custom-scrollbar">
          <div style={{ height: `${sortedSongs.length * rowHeight}px`, position: 'relative' }}>
            {visibleSongs.map((song) => {
              const isActive = currentTrack?.id === song.id;
              const isSelected = selectedSongs.has(song.id);
              return (
                <div
                  key={song.id}
                  style={{ position: 'absolute', top: `${song.originalIndex * rowHeight}px`, left: 0, right: 0, height: `${rowHeight}px` }}
                  onClick={() => {
                    if (isBatchMode) {
                      const next = new Set(selectedSongs);
                      next.has(song.id) ? next.delete(song.id) : next.add(song.id);
                      setSelectedSongs(next);
                    } else {
                      playTrack(song, sortedSongs);
                      toggleMainPlayer(true);
                    }
                  }}
                  className={`grid grid-cols-12 md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-8 items-center border-b border-white/[0.03] transition-all cursor-pointer group hover:bg-white/[0.02] ${isActive ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/10' : ''}`}
                >
                  <div className="col-span-2 md:col-span-1 font-mono text-[11px] text-zinc-600">{(song.originalIndex + 1).toString().padStart(3, '0')}</div>
                  <div className="col-span-7 md:col-span-6 flex items-center gap-3 md:gap-5 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-white/5 shrink-0 relative overflow-hidden">
                      <img src={song.thumbnail_url?.startsWith('http') ? song.thumbnail_url : `http://127.0.0.1:5000${song.thumbnail_url}`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                      {isActive && isPlaying && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><div className="w-1 h-4 bg-primary animate-pulse" /></div>}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[15px] font-semibold truncate tracking-tight ${isActive ? 'text-primary' : 'text-white'}`}>{song.title}</p>
                    </div>
                  </div>
                  <div className="hidden md:block md:col-span-3 font-mono text-[10px] text-zinc-500 truncate uppercase tracking-widest">{song.artist}</div>
                  <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-1 md:gap-4">
                    <span className="font-mono text-[10px] text-zinc-600">{song.duration || '00:00'}</span>
                    {!isBatchMode && (
                      <div className="flex items-center gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                        <div onClick={(e) => e.stopPropagation()}>
                          <FavoriteButton
                            contentType="song"
                            contentId={song.id}
                            isFavorite={isFavorite(song.id)}
                            onToggle={(next) => setFavoriteState(song.id, next)}
                            size="sm"
                          />
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedSong(song); setShowPlaylistModal(true); }} 
                          className="p-2 rounded-md text-zinc-600 hover:text-primary hover:bg-white/5 transition-all"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={(e) => openEditSongModal(song, e)}
                          className="p-2 rounded-md text-zinc-600 hover:text-primary hover:bg-white/5 transition-all text-xs"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteSong(song.id); }} 
                          className="p-2 rounded-md text-zinc-600 hover:text-red-400 hover:bg-white/5 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showPlaylistModal && (
        <div className="overlay z-[300] flex items-center justify-center p-6 animate-in">
          <div className="modal bg-surface border-border rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="heading-sm mb-1">Integrate Sequence</h3>
            <p className="tech-label-sm mb-6">Select target node</p>
            <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar mb-8">
              {playlists.map(p => (
                <button key={p.id} onClick={() => addToPlaylist(p.id)} className="w-full text-left p-4 rounded-2xl bg-white/5 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-between group">
                  <span className="font-semibold text-sm text-white group-hover:text-primary transition-colors">{p.name}</span>
                  <Plus size={16} className="text-white/20 group-hover:text-primary" />
                </button>
              ))}
            </div>
            <button onClick={() => { setShowPlaylistModal(false); setSelectedSong(null); }} className="w-full btn-secondary uppercase tracking-wider justify-center">Close</button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="overlay z-[500] flex items-center justify-center p-6 animate-in">
          <div className="modal bg-surface border-border rounded-3xl w-full max-w-lg p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            <button onClick={() => setShowCreateModal(false)} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"><X size={22} /></button>
            <h3 className="heading-sm mb-1">Initialize Sequence</h3>
            <p className="tech-label-sm mb-8">Assign artifact identification</p>
            <input 
              autoFocus
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="SEQUENCE_NAME"
              className="input mb-6 font-mono uppercase tracking-wide"
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

      {editingSong && (
        <div className="overlay z-[520] flex items-center justify-center p-6 animate-in">
          <div className="modal bg-surface border-border rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
            <button onClick={() => setEditingSong(null)} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"><X size={22} /></button>
            <h3 className="heading-sm mb-1">Edit Song Metadata</h3>
            <p className="tech-label-sm mb-6">Update primary track fields</p>
            <div className="space-y-3">
              <input className="input" value={editSongForm.title} onChange={(e) => setEditSongForm((v) => ({ ...v, title: e.target.value }))} placeholder="Title" />
              <input className="input" value={editSongForm.artist} onChange={(e) => setEditSongForm((v) => ({ ...v, artist: e.target.value }))} placeholder="Artist" />
              <input className="input" value={editSongForm.album} onChange={(e) => setEditSongForm((v) => ({ ...v, album: e.target.value }))} placeholder="Album" />
              <input className="input" value={editSongForm.duration} onChange={(e) => setEditSongForm((v) => ({ ...v, duration: e.target.value }))} placeholder="Duration (mm:ss)" />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={saveSongMetadata} className="btn-primary">Save</button>
              <button onClick={() => setEditingSong(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Music;
