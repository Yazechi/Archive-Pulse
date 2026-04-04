import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useMusic } from '../context/useMusic';
import { 
  Play, BookOpen, Film, Clock, Trash2, RefreshCcw, 
  Music, ChevronRight, Calendar, Activity 
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5000';

const ActivityPage = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, song, book, video
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 30;
  const navigate = useNavigate();
  const { playTrack, toggleMainPlayer } = useMusic();

  const fetchActivities = async (reset = false) => {
    if (reset) setPage(0);
    setLoading(true);
    try {
      const offset = reset ? 0 : page * limit;
      let url = `${API_BASE}/api/activity?limit=${limit}&offset=${offset}`;
      if (filter !== 'all') {
        url += `&content_type=${filter}`;
      }
      
      const res = await axios.get(url);
      setActivities(reset ? res.data.activities : [...activities, ...res.data.activities]);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(true);
  }, [filter]);

  const clearHistory = async () => {
    if (!window.confirm('Clear all activity history? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE}/api/activity`);
      setActivities([]);
      setTotal(0);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteActivity = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/activity/${id}`);
      setActivities(activities.filter(a => a.id !== id));
      setTotal(t => t - 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = async (activity) => {
    if (activity.content_type === 'song') {
      // Fetch song and play it
      try {
        const res = await axios.get(`${API_BASE}/api/songs`);
        const song = res.data.find(s => s.id === activity.content_id);
        if (song) {
          playTrack(song, res.data);
          toggleMainPlayer(true);
        }
      } catch (err) {
        console.error(err);
      }
    } else if (activity.content_type === 'book') {
      // Navigate to reader
      try {
        const res = await axios.get(`${API_BASE}/api/books/by-id/${activity.content_id}`);
        if (res.data) {
          navigate(res.data.type === 'manga' ? '/manga-chapters' : '/reader', { state: { book: res.data } });
        }
      } catch (err) {
        console.error(err);
      }
    } else if (activity.content_type === 'video') {
      navigate('/videos');
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'play': return <Play size={14} className="text-green-400" />;
      case 'pause': return <Activity size={14} className="text-yellow-400" />;
      case 'complete': return <Activity size={14} className="text-primary" />;
      case 'read': return <BookOpen size={14} className="text-blue-400" />;
      case 'download': return <Activity size={14} className="text-purple-400" />;
      case 'upload': return <Activity size={14} className="text-orange-400" />;
      case 'add_to_library': return <Activity size={14} className="text-primary" />;
      default: return <Activity size={14} className="text-white/40" />;
    }
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'song': return <Music size={16} className="text-green-400" />;
      case 'book': return <BookOpen size={16} className="text-blue-400" />;
      case 'video': return <Film size={16} className="text-purple-400" />;
      default: return <Activity size={16} />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
    return groups;
  }, {});

  return (
    <div className="page-shell">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-border pb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="status-online" />
            <span className="tech-label text-primary">Activity_Log_Module</span>
          </div>
          <h1 className="heading-lg">Activity Feed</h1>
          <p className="tech-label-sm">{total} Events Recorded</p>
        </div>
        
        <div className="flex gap-4 flex-wrap">
          <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
            {[
              { key: 'all', label: 'All', icon: Activity },
              { key: 'song', label: 'Music', icon: Music },
              { key: 'book', label: 'Books', icon: BookOpen },
              { key: 'video', label: 'Videos', icon: Film },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-wider transition-all flex items-center gap-2 ${
                  filter === key ? 'bg-primary text-black' : 'text-white/50 hover:text-white'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => fetchActivities(true)} className="btn-secondary btn-icon">
            <RefreshCcw size={18} />
          </button>
          {activities.length > 0 && (
            <button onClick={clearHistory} className="btn-danger uppercase tracking-wider">
              <Trash2 size={16} /> Clear
            </button>
          )}
        </div>
      </header>

      <div className="space-y-8">
        {Object.entries(groupedActivities).map(([date, dateActivities]) => (
          <div key={date} className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-primary" />
              <h3 className="tech-label">{date}</h3>
              <div className="flex-1 h-px bg-border" />
            </div>
            
            <div className="section-card divide-y divide-white/5">
              {dateActivities.map((activity) => (
                <div
                  key={activity.id}
                  onClick={() => handleItemClick(activity)}
                  className="flex items-center gap-4 p-4 hover:bg-white/[0.02] cursor-pointer transition-all group"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-border overflow-hidden shrink-0 relative">
                    {activity.content_thumbnail ? (
                      <img
                        src={activity.content_thumbnail.startsWith('http') ? activity.content_thumbnail : `${API_BASE}${activity.content_thumbnail}`}
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getContentIcon(activity.content_type)}
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 p-1 bg-black/70 rounded">
                      {getActionIcon(activity.action_type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getContentIcon(activity.content_type)}
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">
                        {activity.action_type.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
                      {activity.content_title || `Unknown ${activity.content_type}`}
                    </h4>
                    {activity.metadata?.chapter && (
                      <p className="text-[10px] text-primary mt-0.5">{activity.metadata.chapter}</p>
                    )}
                    {activity.metadata?.episode && (
                      <p className="text-[10px] text-primary mt-0.5">Episode {activity.metadata.episode}</p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-text-muted">
                        <Clock size={12} />
                        <span className="tech-label-sm">{formatTime(activity.created_at)}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteActivity(activity.id); }}
                      className="p-2 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                    
                    <ChevronRight size={16} className="text-white/20 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {activities.length === 0 && !loading && (
          <div className="py-20 flex flex-col items-center gap-4 opacity-40">
            <Activity size={48} />
            <p className="tech-label">No activity recorded yet</p>
          </div>
        )}

        {activities.length < total && (
          <button
            onClick={() => { setPage(p => p + 1); fetchActivities(); }}
            className="w-full btn-secondary justify-center py-4"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
