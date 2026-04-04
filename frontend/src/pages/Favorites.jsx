import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Heart, Play, BookOpen, Film, RefreshCcw } from 'lucide-react';
import { useMusic } from '../context/useMusic';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://127.0.0.1:5000';

const Favorites = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const { playTrack, toggleMainPlayer } = useMusic();
  const toast = useToast();
  const navigate = useNavigate();

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/favorites`);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((item) => item.content_type === tab);
  }, [items, tab]);

  const openItem = (item) => {
    const data = item.content_data;
    if (!data) return;
    if (item.content_type === 'song') {
      playTrack(data, filtered.filter((f) => f.content_type === 'song').map((f) => f.content_data));
      toggleMainPlayer(true);
      return;
    }
    if (item.content_type === 'book') {
      navigate(data.type === 'manga' ? '/manga-chapters' : '/reader', { state: { book: data } });
      return;
    }
    if (item.content_type === 'video') {
      navigate('/videos');
    }
  };

  return (
    <div className="page-shell space-y-8">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-border pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="status-online" />
            <span className="tech-label text-primary">Starred Registry</span>
          </div>
          <h1 className="heading-lg flex items-center gap-3">
            <Heart size={26} className="text-red-400" />
            Favorites
          </h1>
          <p className="tech-label-sm">{filtered.length} starred item{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
            {[
              { id: 'all', label: 'All' },
              { id: 'song', label: 'Songs' },
              { id: 'book', label: 'Books' },
              { id: 'video', label: 'Videos' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-wider transition-all ${
                  tab === t.id ? 'bg-primary text-black' : 'text-white/50 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={fetchFavorites} className="btn-icon"><RefreshCcw size={18} /></button>
        </div>
      </header>

      {loading ? (
        <div className="py-24 text-center tech-label">Loading favorites...</div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center tech-label">No favorites in this category.</div>
      ) : (
        <div className="section-card grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const data = item.content_data;
            if (!data) return null;
            const thumb = data.thumbnail_url?.startsWith('http') ? data.thumbnail_url : `${API_BASE}${data.thumbnail_url || ''}`;
            return (
              <button
                key={`${item.content_type}-${item.content_id}`}
                onClick={() => openItem(item)}
                className="text-left p-4 rounded-2xl border border-white/10 bg-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shrink-0">
                  {data.thumbnail_url ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-white/20">
                      {item.content_type === 'song' ? <Play size={16} /> : item.content_type === 'book' ? <BookOpen size={16} /> : <Film size={16} />}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{data.title}</p>
                  <p className="tech-label-sm truncate">
                    {item.content_type === 'song' ? data.artist : item.content_type === 'book' ? data.author : data.type}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Favorites;
