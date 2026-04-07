import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Settings, BookOpen, Search, Film, DownloadCloud, History, BarChart3, Bell, Check } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import DropdownSelect from '../components/DropdownSelect';

const COLOR_PRESETS = ['#00f2ff', '#ff4500', '#7b2ff7', '#00ff7f', '#ff00ff', '#ffffff'];

const PreferenceSelect = ({ icon: Icon, label, value, options, onChange }) => (
  <label className="space-y-2 block">
    <span className="tech-label flex items-center gap-2"><Icon size={14} /> {label}</span>
    <DropdownSelect value={value} options={options} onChange={onChange} />
  </label>
);

const Profile = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [theme, setTheme] = useState(localStorage.getItem('archive-theme') || '#00f2ff');
  const [prefs, setPrefs] = useState({
    booksProvider: localStorage.getItem('pref-provider-books') || 'all',
    mangaProvider: localStorage.getItem('pref-provider-manga') || 'mangadex',
    animeProvider: localStorage.getItem('pref-provider-anime') || 'all',
    movieProvider: localStorage.getItem('pref-provider-movie') || 'all',
    notifications: localStorage.getItem('pref-notifications') !== 'off',
  });

  const updateTheme = (color) => {
    setTheme(color);
    localStorage.setItem('archive-theme', color);
    document.documentElement.style.setProperty('--color-primary', color);
    window.dispatchEvent(new Event('storage'));
    toast.success('Theme updated');
  };

  const updatePref = (key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    const storageMap = {
      booksProvider: 'pref-provider-books',
      mangaProvider: 'pref-provider-manga',
      animeProvider: 'pref-provider-anime',
      movieProvider: 'pref-provider-movie',
      notifications: 'pref-notifications',
    };
    localStorage.setItem(storageMap[key], typeof value === 'boolean' ? (value ? 'on' : 'off') : value);
  };

  return (
    <div className="page-shell max-w-6xl mx-auto space-y-8">
      <header className="border-b border-border pb-8 space-y-3">
        <div className="flex items-center gap-3">
          <span className="status-online" />
          <span className="tech-label text-primary">User Preferences Hub</span>
        </div>
        <h1 className="heading-lg">Profile & Settings</h1>
        <p className="tech-label-sm">Manage personalization, defaults, and quick shortcuts.</p>
      </header>

      <section className="card p-8 rounded-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Palette size={20} className="text-primary" />
          <h2 className="heading-sm">Theme Personalization</h2>
        </div>
        <div className="flex flex-wrap gap-4">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => updateTheme(color)}
              className={`w-12 h-12 rounded-xl border-2 transition-all ${theme === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </section>

      <section className="card p-8 rounded-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-primary" />
          <h2 className="heading-sm">Default Search Providers</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PreferenceSelect
            icon={Search}
            label="Books Search"
            value={prefs.booksProvider}
            onChange={(value) => updatePref('booksProvider', value)}
            options={[
              { value: 'all', label: 'All (Recommended)' },
              { value: 'gutenberg', label: 'Gutenberg' },
              { value: 'openlibrary', label: 'OpenLibrary' },
            ]}
          />
          <PreferenceSelect
            icon={BookOpen}
            label="Manga Search"
            value={prefs.mangaProvider}
            onChange={(value) => updatePref('mangaProvider', value)}
            options={[
              { value: 'mangadex', label: 'MangaDex (Recommended)' },
              { value: 'all', label: 'All' },
              { value: 'myanimelist', label: 'MyAnimeList' },
            ]}
          />
          <PreferenceSelect
            icon={Film}
            label="Anime Search"
            value={prefs.animeProvider}
            onChange={(value) => updatePref('animeProvider', value)}
            options={[
              { value: 'all', label: 'All (Recommended)' },
              { value: 'gogoanime', label: 'Gogoanime' },
              { value: 'aniwatch', label: 'Aniwatch' },
              { value: 'myanimelist', label: 'MyAnimeList' },
            ]}
          />
          <PreferenceSelect
            icon={Film}
            label="Movie Search"
            value={prefs.movieProvider}
            onChange={(value) => updatePref('movieProvider', value)}
            options={[
              { value: 'all', label: 'All (Recommended)' },
              { value: 'embed2', label: 'Embed2' },
              { value: 'vidsrc', label: 'VidSrc' },
              { value: 'archive', label: 'Archive' },
            ]}
          />
        </div>
      </section>

      <section className="card p-8 rounded-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-primary" />
          <h2 className="heading-sm">Notifications</h2>
        </div>
        <button
          onClick={() => updatePref('notifications', !prefs.notifications)}
          className={`h-12 px-5 rounded-xl border flex items-center gap-2 transition-all ${
            prefs.notifications ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-white/60'
          }`}
        >
          {prefs.notifications ? <Check size={16} /> : null}
          Download notifications {prefs.notifications ? 'enabled' : 'disabled'}
        </button>
      </section>

      <section className="card p-8 rounded-3xl space-y-4">
        <h2 className="heading-sm">Quick Navigation</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => navigate('/books')} className="btn-secondary justify-center"><BookOpen size={14} /> Books</button>
          <button onClick={() => navigate('/downloads')} className="btn-secondary justify-center"><DownloadCloud size={14} /> Downloads</button>
          <button onClick={() => navigate('/activity')} className="btn-secondary justify-center"><History size={14} /> Activity</button>
          <button onClick={() => navigate('/stats')} className="btn-secondary justify-center"><BarChart3 size={14} /> Stats</button>
        </div>
      </section>
    </div>
  );
};

export default Profile;
