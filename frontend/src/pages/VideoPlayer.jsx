import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Play, Pause, Volume2, VolumeX, Maximize, Settings, SkipForward, SkipBack, X, List } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://127.0.0.1:5000';

const VideoPlayer = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  
  const { video, episode: initialEpisode, episodes: initialEpisodes } = state || {};
  
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode || null);
  const [episodes, setEpisodes] = useState(initialEpisodes || []);
  const [sources, setSources] = useState([]);
  const [selectedSourceIdx, setSelectedSourceIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [watchProgress, setWatchProgress] = useState({});
  
  const iframeRef = useRef(null);
  
  useEffect(() => {
    if (!video) {
      navigate('/videos');
      return;
    }
    
    // Fetch saved progress for episodes (only if video is in library)
    const fetchProgress = async () => {
      if (video.id && typeof video.id === 'number') {
        try {
          const res = await axios.get(`${API_BASE}/api/videos/${video.id}/progress`);
          setWatchProgress(res.data || {});
        } catch (err) {
          // Silently fail - video might not be in library
        }
      }
    };
    fetchProgress();
  }, [video, navigate]);
  
  useEffect(() => {
    if (!currentEpisode) return;
    
    const loadSources = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/videos/anime/watch/${currentEpisode.id}`);
        const fetchedSources = res.data.sources || [];
        setSources(fetchedSources);
        setSelectedSourceIdx(0);
        
        // Log activity
        await axios.post(`${API_BASE}/api/activity`, {
          action_type: 'play',
          content_type: 'video',
          content_id: video.id,
          content_title: `${video.title} - Episode ${currentEpisode.number}`,
          content_thumbnail: video.thumbnail_url,
          metadata: { episode: currentEpisode.number, episode_id: currentEpisode.id }
        });
        
        // Update last watched episode
        if (video.id) {
          await axios.put(`${API_BASE}/api/videos/${video.id}/watch-progress`, {
            last_episode_number: currentEpisode.number,
            last_episode_id: currentEpisode.id,
            last_episode_title: currentEpisode.title || `Episode ${currentEpisode.number}`
          });
        }
      } catch (err) {
        toast.error('Failed to load video sources');
        setSources([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadSources();
  }, [currentEpisode, video, toast]);
  
  const handleEpisodeChange = (ep) => {
    setCurrentEpisode(ep);
    setShowEpisodeList(false);
  };
  
  const goToNextEpisode = useCallback(() => {
    if (!currentEpisode || !episodes.length) return;
    const currentIdx = episodes.findIndex(ep => ep.id === currentEpisode.id);
    if (currentIdx < episodes.length - 1) {
      setCurrentEpisode(episodes[currentIdx + 1]);
    }
  }, [currentEpisode, episodes]);
  
  const goToPrevEpisode = useCallback(() => {
    if (!currentEpisode || !episodes.length) return;
    const currentIdx = episodes.findIndex(ep => ep.id === currentEpisode.id);
    if (currentIdx > 0) {
      setCurrentEpisode(episodes[currentIdx - 1]);
    }
  }, [currentEpisode, episodes]);
  
  const currentIdx = episodes.findIndex(ep => ep.id === currentEpisode?.id);
  const hasNext = currentIdx < episodes.length - 1;
  const hasPrev = currentIdx > 0;
  
  if (!video) return null;
  
  const currentSource = sources[selectedSourceIdx]?.url || '';
  
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/videos')} 
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{video.title}</h1>
            {currentEpisode && (
              <p className="text-sm text-white/60">Episode {currentEpisode.number}{currentEpisode.title && currentEpisode.title !== `Episode ${currentEpisode.number}` ? ` - ${currentEpisode.title}` : ''}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Episode Navigation in Header */}
          {episodes.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevEpisode}
                disabled={!hasPrev}
                className={`p-2 rounded-lg transition-colors ${hasPrev ? 'bg-white/10 hover:bg-white/20' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
                title="Previous Episode"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={goToNextEpisode}
                disabled={!hasNext}
                className={`p-2 rounded-lg transition-colors ${hasNext ? 'bg-primary/80 hover:bg-primary text-black' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
                title="Next Episode"
              >
                <SkipForward size={18} />
              </button>
            </div>
          )}
          
          {sources.length > 1 && (
            <select 
              value={selectedSourceIdx}
              onChange={(e) => setSelectedSourceIdx(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white border border-white/20 outline-none"
            >
              {sources.map((src, idx) => (
                <option key={idx} value={idx} className="bg-black text-white">
                  Server {idx + 1}
                </option>
              ))}
            </select>
          )}
          
          {episodes.length > 1 && (
            <button
              onClick={() => setShowEpisodeList(!showEpisodeList)}
              className={`p-2 rounded-lg transition-colors ${showEpisodeList ? 'bg-primary text-black' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <List size={20} />
            </button>
          )}
        </div>
      </header>
      
      {/* Main Player Area */}
      <div className="relative w-full h-screen flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white/60 text-sm">Loading video sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center space-y-4">
            <p className="text-white/60">No video sources available</p>
            <button onClick={() => navigate('/videos')} className="btn-primary">
              Return to Library
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {/* Embed iframe */}
            <iframe
              ref={iframeRef}
              src={currentSource}
              className="w-full h-full border-0"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            />
          </div>
        )}
      </div>
      
      {/* Episode List Sidebar */}
      {showEpisodeList && (
        <div className="fixed top-0 right-0 bottom-0 w-80 bg-surface/95 backdrop-blur-xl border-l border-white/10 z-50 animate-in slide-in-from-right">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-lg font-bold">Episodes</h3>
            <button onClick={() => setShowEpisodeList(false)} className="p-1 hover:text-primary">
              <X size={20} />
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100vh-60px)] p-2">
            {episodes.map((ep) => {
              const isCurrentEp = ep.id === currentEpisode?.id;
              const progress = watchProgress[ep.number] || 0;
              return (
                <button
                  key={ep.id}
                  onClick={() => handleEpisodeChange(ep)}
                  className={`w-full p-3 rounded-lg text-left transition-all mb-1 ${
                    isCurrentEp 
                      ? 'bg-primary/20 border border-primary/40' 
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCurrentEp ? 'bg-primary text-black' : 'bg-white/10'}`}>
                      {isCurrentEp ? <Play size={14} fill="currentColor" /> : ep.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isCurrentEp ? 'text-primary' : ''}`}>
                        Episode {ep.number}
                      </p>
                      {ep.title && ep.title !== `Episode ${ep.number}` && (
                        <p className="text-xs text-white/50 truncate">{ep.title}</p>
                      )}
                    </div>
                  </div>
                  {progress > 0 && (
                    <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
