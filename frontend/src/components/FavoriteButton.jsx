import { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5000';

// Heart button for favoriting content
export const FavoriteButton = ({ contentType, contentId, isFavorite = false, onToggle, size = 'md' }) => {
  const [favorite, setFavorite] = useState(Boolean(isFavorite));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFavorite(Boolean(isFavorite));
  }, [isFavorite, contentId, contentType]);

  const sizeClasses = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      if (favorite) {
        await axios.delete(`${API_BASE}/api/favorites/${contentType}/${contentId}`);
      } else {
        await axios.post(`${API_BASE}/api/favorites`, {
          content_type: contentType,
          content_id: contentId,
        });
      }
      setFavorite(!favorite);
      if (onToggle) onToggle(!favorite);
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className={`transition-all ${loading ? 'opacity-50' : ''} ${
        favorite 
          ? 'text-red-500 hover:text-red-400' 
          : 'text-white/40 hover:text-red-400'
      }`}
      title={favorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart 
        size={sizeClasses[size]} 
        fill={favorite ? 'currentColor' : 'none'}
      />
    </button>
  );
};

// Hook for managing favorites state
export const useFavorites = (contentType) => {
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/favorites`, {
        params: { type: contentType },
      });
      const ids = new Set(res.data.map((f) => f.content_id));
      setFavorites(ids);
    } catch (err) {
      console.error('Failed to fetch favorites', err);
    } finally {
      setLoading(false);
    }
  };

  const isFavorite = (contentId) => favorites.has(contentId);

  const toggleFavorite = async (contentId) => {
    const wasFavorite = favorites.has(contentId);
    try {
      if (wasFavorite) {
        await axios.delete(`${API_BASE}/api/favorites/${contentType}/${contentId}`);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(contentId);
          return next;
        });
      } else {
        await axios.post(`${API_BASE}/api/favorites`, {
          content_type: contentType,
          content_id: contentId,
        });
        setFavorites((prev) => new Set([...prev, contentId]));
      }
      return !wasFavorite;
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      return wasFavorite;
    }
  };

  const setFavoriteState = (contentId, nextState) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (nextState) next.add(contentId);
      else next.delete(contentId);
      return next;
    });
  };

  return { favorites, fetchFavorites, isFavorite, toggleFavorite, setFavoriteState, loading };
};

export default FavoriteButton;
