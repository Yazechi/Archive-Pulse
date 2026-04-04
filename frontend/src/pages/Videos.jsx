import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { Play, Plus, Search as SearchIcon, RefreshCcw, Trash2, Heart, Film, Tv, X, ExternalLink } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5000';

const Videos = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('library'); // library, search
  const [searchType, setSearchType] = useState('anime'); // anime, movie
  const [provider, setProvider] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const navigate = useNavigate();
  const toast = useToast();

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const [videosRes, favsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/videos`),
        axios.get(`${API_BASE}/api/favorites?type=video`)
      ]);
      setVideos(videosRes.data);
      setFavorites(new Set(favsRes.data.map(f => f.content_id)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    const preferred = searchType === 'anime'
      ? (localStorage.getItem('pref-provider-anime') || 'all')
      : (localStorage.getItem('pref-provider-movie') || 'all');
    setProvider(preferred);
    setSearchResults([]);
  }, [searchType]);

  const handleSearch = async (e, overrideProvider) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    try {
      const selectedProvider = overrideProvider || provider;
      const res = await axios.get(`${API_BASE}/api/videos/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}&provider=${selectedProvider}`);
      const providerMap = {
        gogoanime: 'Gogoanime',
        aniwatch: 'Aniwatch',
        myanimelist: 'MyAnimeList',
        archive: 'Archive.org',
        embed2: 'Embed.su',
        vidsrc: 'VidSrc',
      };
      const filtered = selectedProvider === 'all'
        ? res.data
        : (res.data || []).filter((item) => item.source_provider === providerMap[selectedProvider]);
      setSearchResults(filtered);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const addToLibrary = async (video) => {
    try {
      await axios.post(`${API_BASE}/api/videos`, video);
      toast.success(`"${video.title}" added to archive`);
      fetchVideos();
      
      // Log activity
      await axios.post(`${API_BASE}/api/activity`, {
        action_type: 'add_to_library',
        content_type: 'video',
        content_id: video.source_id,
        content_title: video.title,
        content_thumbnail: video.thumbnail_url
      });
    } catch (err) {
      toast.warning('Video may already exist in archive');
    }
  };

  const deleteVideo = async (id) => {
    if (!window.confirm('Remove this video from archive?')) return;
    try {
      await axios.delete(`${API_BASE}/api/videos/${id}`);
      setVideos(videos.filter(v => v.id !== id));
      toast.success('Video removed from archive');
    } catch (err) {
      toast.error('Failed to remove video');
    }
  };

  const toggleFavorite = async (id) => {
    try {
      if (favorites.has(id)) {
        await axios.delete(`${API_BASE}/api/favorites/video/${id}`);
        setFavorites(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await axios.post(`${API_BASE}/api/favorites`, { content_type: 'video', content_id: id });
        setFavorites(prev => new Set([...prev, id]));
      }
    } catch (err) {
      toast.error('Failed to update favorite');
    }
  };

  const openVideoDetails = async (video) => {
    setSelectedVideo(video);
    
    // Fetch episodes if it's anime/series
    if (video.type === 'anime' && ['Gogoanime', 'Aniwatch'].includes(video.source_provider)) {
      try {
        const res = await axios.get(`${API_BASE}/api/videos/anime/${video.source_id}/episodes`);
        setEpisodes(res.data.episodes || []);
      } catch (err) {
        console.error('Failed to fetch episodes');
        setEpisodes([]);
      }
    } else if (video.episodes) {
      setEpisodes(video.episodes);
    } else {
      setEpisodes([]);
    }
  };

  const watchEpisode = (episode) => {
    // Navigate to embedded video player
    navigate('/video-player', {
      state: {
        video: selectedVideo,
        episode,
        episodes
      }
    });
  };

  const watchMovie = async (video) => {
    try {
      const res = await axios.get(`${API_BASE}/api/videos/movie/watch`, {
        params: {
          source: video.source_provider,
          id: video.source_id,
          q: video.title
        }
      });
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      } else {
        toast.error('No streaming source available');
      }
    } catch (err) {
      toast.error('Failed to get movie stream source');
    }
  };

  return (
    <div className="page-shell">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-border pb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="status-online" />
            <span className="tech-label text-primary">Video Archive Module</span>
          </div>
          <h1 className="heading-lg">Visual Media</h1>
          <p className="tech-label-sm">{videos.length} Entries Indexed</p>
        </div>
        
        <div className="flex gap-4 flex-wrap">
          <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
            {['library', 'search'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-wider transition-all ${
                  activeTab === tab ? 'bg-primary text-black' : 'text-white/50 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button onClick={fetchVideos} className="btn-secondary btn-icon">
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      {activeTab === 'search' && (
        <div className="space-y-6">
          <form onSubmit={handleSearch} className="section-card p-6 space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
                {['anime', 'movie'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSearchType(type)}
                    className={`px-6 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-wider transition-all ${
                      searchType === type ? 'bg-primary text-black' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {type === 'anime' ? <Tv size={14} className="inline mr-2" /> : <Film size={14} className="inline mr-2" />}
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
                {(searchType === 'anime'
                  ? [
                      { id: 'all', label: 'All' },
                      { id: 'gogoanime', label: 'Gogoanime' },
                      { id: 'aniwatch', label: 'Aniwatch' },
                      { id: 'myanimelist', label: 'MyAnimeList' },
                    ]
                  : [
                      { id: 'all', label: 'All' },
                      { id: 'archive', label: 'Archive' },
                      { id: 'embed2', label: 'Embed2' },
                      { id: 'vidsrc', label: 'VidSrc' },
                    ]
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      if (searchQuery.trim()) handleSearch(null, p.id);
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-wider transition-all ${provider === p.id ? 'bg-primary text-black' : 'text-white/50 hover:text-white'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${searchType}...`}
                className="input pr-14"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary btn-icon btn-sm">
                <SearchIcon size={16} />
              </button>
            </div>
          </form>

          {searchLoading ? (
            <div className="py-20 flex flex-col items-center gap-4 opacity-40">
              <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="tech-label">Scanning providers...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {searchResults.map((video) => (
                <div key={video.id} className="group cursor-pointer space-y-3">
                  <div className="aspect-[2/3] rounded-2xl border border-border bg-zinc-900 relative overflow-hidden group-hover:border-primary/40 transition-all">
                    <img
                      src={video.thumbnail_url || 'https://via.placeholder.com/300x450?text=No+Image'}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                        <button
                          onClick={() => addToLibrary(video)}
                          className="flex-1 btn-primary btn-sm justify-center"
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-[9px] font-bold uppercase tracking-wider text-primary">
                      {video.source_provider}
                    </div>
                  </div>
                  <div className="space-y-1 px-1">
                    <h3 className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                    <p className="tech-label-sm">{video.release_year || video.releaseDate || 'Unknown'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'library' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {videos.map((video) => (
            <div
              key={video.id}
              className="group cursor-pointer space-y-3"
              onClick={() => openVideoDetails(video)}
            >
              <div className="aspect-[2/3] rounded-2xl border border-border bg-zinc-900 relative overflow-hidden group-hover:border-primary/40 transition-all">
                <img
                  src={video.thumbnail_url || 'https://via.placeholder.com/300x450?text=No+Image'}
                  className="w-full h-full object-cover opacity-70 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500"
                  alt=""
                />
                {/* Progress bar for anime/series - shows episode progress */}
                {video.type === 'anime' && video.progress > 0 && video.total_episodes > 1 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                    <div className="h-full bg-primary" style={{ width: `${(video.progress / video.total_episodes) * 100}%` }} />
                  </div>
                )}
                {/* Last episode badge for anime */}
                {video.type === 'anime' && video.progress > 0 && (
                  <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/80 rounded text-[9px] font-bold text-primary border border-primary/30">
                    EP {Math.floor(video.progress)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                    <button className="flex-1 btn-primary btn-sm justify-center">
                      <Play size={14} fill="currentColor" /> {video.type === 'anime' && video.progress > 0 ? 'Continue' : 'Watch'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(video.id); }}
                  className={`absolute top-2 right-2 p-2 rounded-lg transition-all ${
                    favorites.has(video.id)
                      ? 'bg-red-500/20 text-red-500'
                      : 'bg-black/50 text-white/50 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Heart size={14} fill={favorites.has(video.id) ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteVideo(video.id); }}
                  className="absolute top-2 left-2 p-2 rounded-lg bg-black/50 text-white/50 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/70 rounded text-[9px] font-bold uppercase tracking-wider text-primary">
                  {video.type}
                </div>
              </div>
              <div className="space-y-1 px-1">
                <h3 className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-center justify-between">
                  <p className="tech-label-sm">{video.release_year || 'Unknown'}</p>
                  {video.rating && (
                    <span className="text-[10px] text-yellow-500">★ {video.rating.toFixed(1)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Details Modal */}
      {selectedVideo && (
        <div className="overlay z-[300] flex items-center justify-center p-6 animate-in">
          <div className="modal w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => { setSelectedVideo(null); setEpisodes([]); }}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-lg text-white/50 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <div className="relative h-64 md:h-80 overflow-hidden rounded-t-3xl">
              <img
                src={selectedVideo.backdrop_url || selectedVideo.thumbnail_url}
                className="w-full h-full object-cover"
                alt=""
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <h2 className="heading-md mb-2">{selectedVideo.title}</h2>
                <div className="flex flex-wrap gap-3 items-center">
                  {selectedVideo.release_year && (
                    <span className="tech-label">{selectedVideo.release_year}</span>
                  )}
                  {selectedVideo.rating && (
                    <span className="text-yellow-500 text-sm">★ {selectedVideo.rating.toFixed(1)}</span>
                  )}
                  {selectedVideo.total_episodes > 1 && (
                    <span className="tech-label">{selectedVideo.total_episodes} Episodes</span>
                  )}
                  <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold uppercase rounded">
                    {selectedVideo.type}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedVideo.description && (
                <p className="text-sm text-text-secondary leading-relaxed">
                  {selectedVideo.description}
                </p>
              )}
              
              {selectedVideo.genres && (
                <div className="flex flex-wrap gap-2">
                  {selectedVideo.genres.split(',').map((genre, i) => (
                    <span key={i} className="px-3 py-1 bg-white/5 border border-border rounded-full text-xs">
                      {genre.trim()}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Episodes */}
              {episodes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="heading-sm">Episodes</h3>
                    {selectedVideo.progress > 0 && (
                      <button
                        onClick={() => {
                          const continueEp = episodes.find(ep => ep.number === Math.floor(selectedVideo.progress));
                          if (continueEp) watchEpisode(continueEp);
                          else if (episodes.length > 0) watchEpisode(episodes[0]);
                        }}
                        className="btn-primary btn-sm"
                      >
                        <Play size={14} fill="currentColor" /> Continue EP {Math.floor(selectedVideo.progress)}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto custom-scrollbar">
                    {episodes.map((ep) => {
                      const isLastWatched = Math.floor(selectedVideo.progress) === ep.number;
                      const isWatched = selectedVideo.progress > ep.number;
                      return (
                        <button
                          key={ep.id}
                          onClick={() => watchEpisode(ep)}
                          className={`p-3 border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left group ${
                            isLastWatched 
                              ? 'bg-primary/10 border-primary/40' 
                              : isWatched 
                                ? 'bg-white/5 border-white/20 opacity-60' 
                                : 'bg-white/5 border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Play size={14} className={`transition-opacity ${isLastWatched ? 'text-primary opacity-100' : 'text-primary opacity-0 group-hover:opacity-100'}`} />
                            <span className={`text-sm font-semibold ${isLastWatched ? 'text-primary' : ''}`}>Episode {ep.number}</span>
                          </div>
                          {ep.title && ep.title !== `Episode ${ep.number}` && (
                            <p className="text-xs text-text-muted mt-1 truncate">{ep.title}</p>
                          )}
                          {isLastWatched && (
                            <span className="text-[9px] text-primary font-bold mt-1 block">CONTINUE</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedVideo.type === 'movie' && (
                <button
                  onClick={() => watchMovie(selectedVideo)}
                  className="btn-primary btn-lg w-full justify-center"
                >
                  <ExternalLink size={18} /> Watch Movie
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Videos;
