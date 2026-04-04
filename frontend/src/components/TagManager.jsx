import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Tag, Plus, X, Check } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5000';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

// Tag Badge Component
export const TagBadge = ({ tag, onRemove, size = 'sm' }) => {
  const sizeClasses = {
    xs: 'text-[8px] px-1.5 py-0.5',
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${tag.color}20`,
        borderColor: `${tag.color}50`,
        color: tag.color,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag.id);
          }}
          className="hover:opacity-70"
        >
          <X size={size === 'xs' ? 8 : 10} />
        </button>
      )}
    </span>
  );
};

// Tag Selector Dropdown
export const TagSelector = ({
  contentType,
  contentId,
  selectedTags = [],
  onTagsChange,
  position = 'bottom',
  buttonClassName = '',
  iconSize = 14,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [currentTags, setCurrentTags] = useState(selectedTags);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setCurrentTags(selectedTags);
  }, [selectedTags]);

  useEffect(() => {
    if (isOpen) {
      fetchTags();
      fetchCurrentTags();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTags = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tags`);
      setAllTags(res.data);
    } catch (err) {
      console.error('Failed to fetch tags', err);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/tags`, {
        name: newTagName.trim(),
        color: newTagColor,
      });
      setAllTags((prev) => [...prev, res.data]);
      setNewTagName('');
      setShowCreateForm(false);
    } catch (err) {
      console.error('Failed to create tag', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentTags = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tags/content/${contentType}/${contentId}`);
      setCurrentTags(res.data);
      if (onTagsChange) onTagsChange(res.data);
    } catch (err) {
      console.error('Failed to fetch current tags', err);
    }
  };

  const toggleTag = async (tag) => {
    const isSelected = currentTags.some((t) => t.id === tag.id);
    setLoading(true);
    try {
      if (isSelected) {
        await axios.delete(`${API_BASE}/api/tags/content/${contentType}/${contentId}/${tag.id}`);
        const updated = currentTags.filter((t) => t.id !== tag.id);
        setCurrentTags(updated);
        if (onTagsChange) onTagsChange(updated);
      } else {
        await axios.post(`${API_BASE}/api/tags/content`, {
          tag_id: tag.id,
          content_type: contentType,
          content_id: contentId,
        });
        const updated = [...currentTags, tag];
        setCurrentTags(updated);
        if (onTagsChange) onTagsChange(updated);
      }
    } catch (err) {
      console.error('Failed to toggle tag', err);
    } finally {
      setLoading(false);
    }
  };

  const positionClasses = {
    bottom: 'top-full left-0 mt-1',
    top: 'bottom-full left-0 mb-1',
    right: 'top-0 left-full ml-1',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-center gap-1 transition-colors ${buttonClassName || 'text-white/40 hover:text-primary'}`}
        title="Manage tags"
      >
        <Tag size={iconSize} />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-56 bg-surface/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-2 ${positionClasses[position]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-white/70 uppercase tracking-wider">Tags</span>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="text-white/50 hover:text-primary"
            >
              <Plus size={14} />
            </button>
          </div>

          {showCreateForm && (
            <div className="mb-2 p-2 bg-black/30 rounded-lg space-y-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name..."
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && createTag()}
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`w-4 h-4 rounded-full border-2 ${newTagColor === color ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                onClick={createTag}
                disabled={loading || !newTagName.trim()}
                className="w-full text-[10px] py-1.5 bg-primary/20 text-primary rounded hover:bg-primary/30 disabled:opacity-50"
              >
                Create Tag
              </button>
            </div>
          )}

          <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
            {allTags.length === 0 ? (
              <p className="text-[10px] text-white/40 text-center py-2">No tags yet</p>
            ) : (
              allTags.map((tag) => {
                const isSelected = currentTags.some((t) => t.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag)}
                    disabled={loading}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-[11px] text-white/80 flex-1 truncate">{tag.name}</span>
                    {isSelected && <Check size={12} className="text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Tag Filter Bar
export const TagFilterBar = ({ selectedTagIds = [], onFilterChange }) => {
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tags`);
      setAllTags(res.data);
    } catch (err) {
      console.error('Failed to fetch tags', err);
    }
  };

  const toggleFilter = (tagId) => {
    if (selectedTagIds.includes(tagId)) {
      onFilterChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onFilterChange([...selectedTagIds, tagId]);
    }
  };

  if (allTags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] text-white/40 uppercase tracking-wider">Filter by tag:</span>
      {allTags.map((tag) => {
        const isActive = selectedTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => toggleFilter(tag.id)}
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all ${
              isActive
                ? 'border-white/30 bg-white/10'
                : 'border-white/10 bg-transparent hover:bg-white/5'
            }`}
            style={{
              color: isActive ? tag.color : 'rgba(255,255,255,0.5)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
          </button>
        );
      })}
      {selectedTagIds.length > 0 && (
        <button
          onClick={() => onFilterChange([])}
          className="text-[10px] text-white/40 hover:text-white/70"
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default TagSelector;
