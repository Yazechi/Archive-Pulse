import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Palette, Settings, BookOpen, Search, Film, DownloadCloud, History, BarChart3, Bell, Check, Smartphone, Webhook, Music2, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import DropdownSelect from '../components/DropdownSelect';

const COLOR_PRESETS = ['#00f2ff', '#ff4500', '#7b2ff7', '#00ff7f', '#ff00ff', '#ffffff'];
const API_BASE = 'http://127.0.0.1:5000';
const WEBHOOK_EVENT_OPTIONS = [
  { value: '*', label: 'All events' },
  { value: 'library.song_added', label: 'Song added' },
  { value: 'library.book_added', label: 'Book added' },
  { value: 'library.video_added', label: 'Video added' },
  { value: 'download.completed', label: 'Download completed' },
  { value: 'download.failed', label: 'Download failed' },
  { value: 'import.spotify_completed', label: 'Spotify import completed' }
];

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
  const [installEvent, setInstallEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [webhookConfig, setWebhookConfig] = useState({
    id: null,
    name: 'Primary Webhook',
    url: '',
    secret: '',
    enabled: true,
    events: ['*']
  });
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [spotifyImporting, setSpotifyImporting] = useState(false);
  const [spotifyAutoAdd, setSpotifyAutoAdd] = useState(true);
  const [spotifyLimit, setSpotifyLimit] = useState(30);
  const [spotifyResult, setSpotifyResult] = useState(null);
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

  useEffect(() => {
    const onInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const media = window.matchMedia('(display-mode: standalone)');
    const onModeChange = () => setIsStandalone(media.matches);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    media.addEventListener('change', onModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      media.removeEventListener('change', onModeChange);
    };
  }, []);

  useEffect(() => {
    const loadWebhookConfig = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/webhooks/subscriptions`);
        const first = Array.isArray(res.data) ? res.data[0] : null;
        if (first) {
          setWebhookConfig((prev) => ({
            ...prev,
            id: first.id,
            name: first.name || 'Primary Webhook',
            url: first.url || '',
            enabled: first.enabled !== false,
            events: Array.isArray(first.events) && first.events.length > 0 ? first.events : ['*']
          }));
        }
      } catch {
        // Keep default local state if webhooks are not configured yet.
      }
    };
    loadWebhookConfig();
  }, []);

  const triggerInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const toggleWebhookEvent = (eventName) => {
    setWebhookConfig((prev) => {
      const current = Array.isArray(prev.events) ? [...prev.events] : [];
      if (eventName === '*') {
        return { ...prev, events: current.includes('*') ? [] : ['*'] };
      }
      const withoutAll = current.filter((evt) => evt !== '*');
      const next = withoutAll.includes(eventName)
        ? withoutAll.filter((evt) => evt !== eventName)
        : [...withoutAll, eventName];
      return { ...prev, events: next.length > 0 ? next : ['*'] };
    });
  };

  const saveWebhook = async () => {
    if (!webhookConfig.url?.trim()) {
      toast.warning('Webhook URL is required');
      return;
    }
    setSavingWebhook(true);
    try {
      const payload = {
        name: webhookConfig.name || 'Primary Webhook',
        url: webhookConfig.url.trim(),
        secret: webhookConfig.secret || null,
        enabled: webhookConfig.enabled,
        events: webhookConfig.events
      };
      if (webhookConfig.id) {
        await axios.put(`${API_BASE}/api/webhooks/subscriptions/${webhookConfig.id}`, payload);
      } else {
        const res = await axios.post(`${API_BASE}/api/webhooks/subscriptions`, payload);
        setWebhookConfig((prev) => ({ ...prev, id: res.data?.id || prev.id }));
      }
      toast.success('Webhook settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save webhook settings');
    } finally {
      setSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookConfig.id) {
      toast.warning('Save the webhook first before testing');
      return;
    }
    setTestingWebhook(true);
    try {
      await axios.post(`${API_BASE}/api/webhooks/test`, { subscription_id: webhookConfig.id });
      toast.success('Test webhook event sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send test webhook');
    } finally {
      setTestingWebhook(false);
    }
  };

  const runSpotifyImport = async () => {
    if (!spotifyUrl.trim()) {
      toast.warning('Please paste a Spotify URL');
      return;
    }
    setSpotifyImporting(true);
    setSpotifyResult(null);
    try {
      const res = await axios.post(`${API_BASE}/api/spotify/import`, {
        url: spotifyUrl.trim(),
        auto_add: spotifyAutoAdd,
        limit: spotifyLimit
      });
      setSpotifyResult(res.data);
      toast.success('Spotify import completed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Spotify import failed');
    } finally {
      setSpotifyImporting(false);
    }
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
          <Smartphone size={20} className="text-primary" />
          <h2 className="heading-sm">Mobile App (PWA)</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-white">Install Archive Pulse on your phone for an app-like experience.</p>
            <p className="tech-label-sm mt-2">
              {isStandalone ? 'App is already installed' : installEvent ? 'Install prompt ready' : 'Use browser "Add to Home Screen" if prompt is unavailable'}
            </p>
          </div>
          <button
            onClick={triggerInstall}
            disabled={!installEvent || isStandalone}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <DownloadCloud size={16} />
            {isStandalone ? 'Installed' : 'Install App'}
          </button>
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
        <div className="flex items-center gap-3">
          <Webhook size={20} className="text-primary" />
          <h2 className="heading-sm">Webhook Notifications</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="input"
            value={webhookConfig.url}
            onChange={(e) => setWebhookConfig((prev) => ({ ...prev, url: e.target.value }))}
            placeholder="https://your-endpoint.example/webhook"
          />
          <input
            className="input"
            value={webhookConfig.secret}
            onChange={(e) => setWebhookConfig((prev) => ({ ...prev, secret: e.target.value }))}
            placeholder="Secret (optional)"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {WEBHOOK_EVENT_OPTIONS.map((evt) => {
            const active = (webhookConfig.events || []).includes('*')
              ? evt.value === '*'
              : (webhookConfig.events || []).includes(evt.value);
            return (
              <button
                key={evt.value}
                onClick={() => toggleWebhookEvent(evt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-white/15 bg-white/5 text-white/60'
                }`}
              >
                {evt.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWebhookConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`h-10 px-4 rounded-xl border text-sm ${webhookConfig.enabled ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-white/60'}`}
          >
            {webhookConfig.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button onClick={saveWebhook} className="btn-primary" disabled={savingWebhook}>
            {savingWebhook ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Webhook
          </button>
          <button onClick={testWebhook} className="btn-secondary" disabled={testingWebhook || !webhookConfig.id}>
            {testingWebhook ? <Loader2 size={14} className="animate-spin" /> : null}
            Send Test
          </button>
        </div>
      </section>

      <section className="card p-8 rounded-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Music2 size={20} className="text-primary" />
          <h2 className="heading-sm">Spotify Import</h2>
        </div>
        <input
          className="input"
          value={spotifyUrl}
          onChange={(e) => setSpotifyUrl(e.target.value)}
          placeholder="Paste Spotify track/album/playlist URL"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={spotifyAutoAdd} onChange={(e) => setSpotifyAutoAdd(e.target.checked)} />
            Auto add to library
          </label>
          <div className="w-40">
            <DropdownSelect
              value={spotifyLimit}
              onChange={(value) => setSpotifyLimit(Number(value))}
              options={[
                { value: 10, label: '10 tracks' },
                { value: 30, label: '30 tracks' },
                { value: 50, label: '50 tracks' },
                { value: 100, label: '100 tracks' }
              ]}
            />
          </div>
          <button onClick={runSpotifyImport} className="btn-primary" disabled={spotifyImporting}>
            {spotifyImporting ? <Loader2 size={14} className="animate-spin" /> : null}
            Import from Spotify
          </button>
        </div>
        {spotifyResult && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <p>
              Source: <span className="text-primary">{spotifyResult.sourceTitle || 'Spotify'}</span> • Imported:{' '}
              <span className="text-primary">{spotifyResult.importedCount ?? spotifyResult.totalTracks ?? 0}</span>
              {spotifyResult.failedCount ? ` • Failed: ${spotifyResult.failedCount}` : ''}
            </p>
          </div>
        )}
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
