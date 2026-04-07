import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BookOpen, Music, Film, Clock, Calendar, TrendingUp, 
  Award, Target, Flame, BarChart3, PieChart, Heart, DownloadCloud, StickyNote
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5000';

const buildLibraryBreakdownFromCollections = (songs = [], books = [], videos = []) => {
  const toCountMap = (rows, field) =>
    rows.reduce((acc, row) => {
      const key = row?.[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const readingProgress = books.reduce(
    (acc, row) => {
      const progress = Number(row?.progress || 0);
      if (progress >= 100) acc.completed += 1;
      else if (progress > 0) acc.inProgress += 1;
      else acc.notStarted += 1;
      return acc;
    },
    { completed: 0, inProgress: 0, notStarted: 0 }
  );

  return {
    totals: {
      songs: songs.length,
      books: books.length,
      videos: videos.length
    },
    songsBySource: toCountMap(songs, 'source'),
    booksByType: toCountMap(books, 'type'),
    booksBySource: toCountMap(books, 'source'),
    videosByType: toCountMap(videos, 'type'),
    readingProgress
  };
};

const Stats = () => {
  const [readingStats, setReadingStats] = useState(null);
  const [activityStats, setActivityStats] = useState(null);
  const [generalStats, setGeneralStats] = useState(null);
  const [listeningHistory, setListeningHistory] = useState({ timeline: [], totalPlays: 0 });
  const [readingStreak, setReadingStreak] = useState({ currentStreak: 0, bestStreak: 0, activeDays: 0 });
  const [libraryBreakdown, setLibraryBreakdown] = useState(null);
  const [genreBreakdown, setGenreBreakdown] = useState({ genres: [] });
  const [playCountStats, setPlayCountStats] = useState({ totalPlays: 0, totalSongsPlayed: 0, topSongs: [] });
  const [favoritesStats, setFavoritesStats] = useState({ total: 0, songs: 0, books: 0, videos: 0 });
  const [downloadsStats, setDownloadsStats] = useState({ active: 0, completed: 0, failed: 0 });
  const [annotationStats, setAnnotationStats] = useState({ total: 0, withNotes: 0 });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30); // days

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [
          readingRes,
          activityRes,
          generalRes,
          favoritesRes,
          downloadsRes,
          annotationsRes,
          playCountsRes,
          listeningHistoryRes,
          readingStreakRes,
          libraryBreakdownRes,
          genreBreakdownRes,
          downloadSummaryRes,
          songsRes,
          booksRes,
          videosRes,
          tagsRes
        ] = await Promise.all([
          axios.get(`${API_BASE}/api/stats/reading?days=${timeRange}`),
          axios.get(`${API_BASE}/api/activity/stats?days=${timeRange}`),
          axios.get(`${API_BASE}/api/stats`),
          axios.get(`${API_BASE}/api/favorites`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/downloads`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/annotations`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/stats/play-counts`).catch(() => ({ data: { totalPlays: 0, totalSongsPlayed: 0, topSongs: [] } })),
          axios.get(`${API_BASE}/api/stats/listening-history?days=${timeRange}`).catch(() => ({ data: { timeline: [], totalPlays: 0 } })),
          axios.get(`${API_BASE}/api/stats/reading-streak`).catch(() => ({ data: { currentStreak: 0, bestStreak: 0, activeDays: 0 } })),
          axios.get(`${API_BASE}/api/stats/library-breakdown`).catch(() => ({ data: null })),
          axios.get(`${API_BASE}/api/stats/genre-breakdown`).catch(() => ({ data: { genres: [] } })),
          axios.get(`${API_BASE}/api/stats/downloads-summary`).catch(() => ({ data: null })),
          axios.get(`${API_BASE}/api/songs`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/books`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/videos`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/tags`).catch(() => ({ data: [] })),
        ]);
        setReadingStats(readingRes.data);
        setActivityStats(activityRes.data);
        setGeneralStats(generalRes.data);
        setListeningHistory(listeningHistoryRes.data || { timeline: [], totalPlays: 0 });
        setReadingStreak(readingStreakRes.data || {
          currentStreak: readingRes.data?.currentStreak || 0,
          bestStreak: readingRes.data?.bestStreak || 0,
          activeDays: readingRes.data?.dailyReading?.length || 0
        });
        const songsList = Array.isArray(songsRes.data) ? songsRes.data : [];
        const booksList = Array.isArray(booksRes.data) ? booksRes.data : [];
        const videosList = Array.isArray(videosRes.data) ? videosRes.data : [];

        const fallbackLibraryBreakdown = buildLibraryBreakdownFromCollections(songsList, booksList, videosList);
        const backendLibraryBreakdown = libraryBreakdownRes.data;
        const hasBackendBreakdown =
          backendLibraryBreakdown &&
          typeof backendLibraryBreakdown === 'object' &&
          backendLibraryBreakdown.songsBySource;
        setLibraryBreakdown(hasBackendBreakdown ? backendLibraryBreakdown : fallbackLibraryBreakdown);

        const backendGenres = genreBreakdownRes.data?.genres || [];
        if (backendGenres.length > 0) {
          setGenreBreakdown({ genres: backendGenres });
        } else {
          const tags = Array.isArray(tagsRes.data) ? tagsRes.data : [];
          const tagContents = await Promise.all(
            tags.map((tag) =>
              axios
                .get(`${API_BASE}/api/tags/${tag.id}/content`)
                .then((res) => ({ tag, content: Array.isArray(res.data) ? res.data : [] }))
                .catch(() => ({ tag, content: [] }))
            )
          );

          const map = new Map();
          const ensureGenre = (name, color = '#00f2ff') => {
            const key = String(name || '').trim().toLowerCase();
            if (!key) return null;
            const existing = map.get(key) || { name: String(name).trim(), color, songs: 0, books: 0, videos: 0, total: 0 };
            if (!map.has(key)) map.set(key, existing);
            return existing;
          };

          tagContents.forEach(({ tag, content }) => {
            const row = ensureGenre(tag?.name, tag?.color || '#00f2ff');
            if (!row) return;
            content.forEach((item) => {
              if (item.content_type === 'song') row.songs += 1;
              else if (item.content_type === 'book') row.books += 1;
              else if (item.content_type === 'video') row.videos += 1;
              row.total += 1;
            });
          });

          videosList.forEach((video) => {
            String(video?.genres || '')
              .split(',')
              .map((g) => g.trim())
              .filter(Boolean)
              .forEach((genreName) => {
                const row = ensureGenre(genreName, '#00f2ff');
                if (!row) return;
                row.videos += 1;
                row.total += 1;
              });
          });

          const genres = Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 20);
          setGenreBreakdown({ genres });
        }
        setPlayCountStats(playCountsRes.data || { totalPlays: 0, totalSongsPlayed: 0, topSongs: [] });
        const favorites = Array.isArray(favoritesRes.data) ? favoritesRes.data : [];
        setFavoritesStats({
          total: favorites.length,
          songs: favorites.filter((f) => f.content_type === 'song').length,
          books: favorites.filter((f) => f.content_type === 'book').length,
          videos: favorites.filter((f) => f.content_type === 'video').length,
        });
        const downloads = Array.isArray(downloadsRes.data) ? downloadsRes.data : [];
        const fallbackDownloads = {
          active: downloads.filter((d) => d.status === 'downloading' || d.status === 'pending').length,
          completed: downloads.filter((d) => d.status === 'completed').length,
          failed: downloads.filter((d) => d.status === 'failed').length,
          lifetimeDownloads: downloads.filter((d) => d.status === 'completed').length
        };
        setDownloadsStats(downloadSummaryRes.data ? {
          ...fallbackDownloads,
          ...downloadSummaryRes.data
        } : fallbackDownloads);
        const annotations = Array.isArray(annotationsRes.data) ? annotationsRes.data : [];
        setAnnotationStats({
          total: annotations.length,
          withNotes: annotations.filter((a) => a.note && a.note.trim()).length,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [timeRange]);

  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const StatCard = ({ icon: Icon, label, value, subValue, color = 'primary' }) => (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-${color}/10 flex items-center justify-center`}>
          <Icon size={20} className={`text-${color}`} />
        </div>
        <span className="tech-label">{label}</span>
      </div>
      <div>
        <p className="text-3xl font-display font-bold text-white">{value}</p>
        {subValue && <p className="tech-label-sm mt-1">{subValue}</p>}
      </div>
    </div>
  );

  // Simple bar chart component
  const MiniBarChart = ({ data, label }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
      <div className="space-y-2">
        <p className="tech-label">{label}</p>
        <div className="flex items-end gap-1 h-20">
          {data.slice(-14).map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/60 rounded-t transition-all hover:bg-primary"
                style={{ height: `${(Number(d.value || 0) / maxValue) * 100}%`, minHeight: Number(d.value || 0) > 0 ? '4px' : '0' }}
              />
              <span className="text-[8px] text-white/30">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="tech-label">Loading statistics...</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const readingChartData = (readingStats?.dailyReading || []).map(d => ({
    value: d.pages || 0,
    label: new Date(d.date).getDate()
  })).reverse();

  const listeningChartData = (activityStats?.dailyActivity || [])
    .filter(d => d.content_type === 'song')
    .map(d => ({
      value: d.count || 0,
      label: new Date(d.date).getDate()
    })).reverse();

  const listeningTrendData = (listeningHistory?.timeline || []).map((d) => ({
    value: d.plays || 0,
    label: new Date(d.date).getDate()
  }));

  return (
    <div className="page-shell">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-border pb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="status-online" />
            <span className="tech-label text-primary">Analytics_Module</span>
          </div>
          <h1 className="heading-lg">Statistics</h1>
          <p className="tech-label-sm">Your archive activity insights</p>
        </div>
        
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-5 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-wider transition-all ${
                timeRange === days ? 'bg-primary text-black' : 'text-white/50 hover:text-white'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </header>

      {/* Library Overview */}
      <section className="space-y-6">
        <h2 className="heading-sm flex items-center gap-3">
          <BarChart3 size={20} className="text-primary" />
          Library Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Music}
            label="Total Songs"
            value={generalStats?.songs || 0}
            subValue={generalStats?.musicDuration || '0m total'}
          />
          <StatCard
            icon={BookOpen}
            label="Total Books"
            value={(generalStats?.books || 0) + (generalStats?.mangas || 0)}
            subValue={`${generalStats?.books || 0} books, ${generalStats?.mangas || 0} manga`}
          />
          <StatCard
            icon={Film}
            label="Playlists"
            value={generalStats?.playlists || 0}
          />
          <StatCard
            icon={Target}
            label="Series"
            value={generalStats?.series || 0}
          />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="heading-sm flex items-center gap-3">
          <TrendingUp size={20} className="text-cyan-400" />
          Engagement Insights
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Heart}
            label="Favorites"
            value={favoritesStats.total}
            subValue={`${favoritesStats.songs} songs • ${favoritesStats.books} books • ${favoritesStats.videos} videos`}
          />
          <StatCard
            icon={StickyNote}
            label="Annotations"
            value={annotationStats.total}
            subValue={`${annotationStats.withNotes} with notes`}
          />
          <StatCard
            icon={DownloadCloud}
            label="Downloads Done"
            value={downloadsStats.lifetimeDownloads || downloadsStats.completed}
            subValue={`${downloadsStats.completed} queue completed • ${downloadsStats.active} active • ${downloadsStats.failed} failed`}
          />
          <StatCard
            icon={Calendar}
            label="Tracked Days"
            value={timeRange}
            subValue="current window"
          />
        </div>
      </section>

      {/* Reading Statistics */}
      <section className="space-y-6">
        <h2 className="heading-sm flex items-center gap-3">
          <BookOpen size={20} className="text-blue-400" />
          Reading Statistics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Clock}
            label="Reading Time"
            value={formatDuration(readingStats?.totalSeconds)}
            subValue={`Last ${timeRange} days`}
          />
          <StatCard
            icon={Target}
            label="Pages Read"
            value={readingStats?.totalPages || 0}
            subValue={`~${readingStats?.avgPagesPerSession || 0} per session`}
          />
          <StatCard
            icon={Award}
            label="Books Completed"
            value={readingStats?.booksCompleted || 0}
          />
          <StatCard
            icon={Flame}
            label="Reading Streak"
            value={`${readingStreak?.currentStreak ?? readingStats?.currentStreak ?? 0} days`}
            subValue={`Best: ${readingStreak?.bestStreak ?? readingStats?.bestStreak ?? 0} days`}
          />
        </div>

        {/* Reading Chart */}
        <div className="card p-6">
          <MiniBarChart data={readingChartData} label="Pages read per day" />
        </div>

        {/* Top Books */}
        {readingStats?.topBooks?.length > 0 && (
          <div className="card p-6 space-y-4">
            <h3 className="tech-label">Most Read Books</h3>
            <div className="space-y-3">
              {readingStats.topBooks.slice(0, 5).map((book, i) => (
                <div key={book.id} className="flex items-center gap-4">
                  <span className="w-6 text-center font-mono text-sm text-white/40">{i + 1}</span>
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-900 border border-border shrink-0">
                    {book.thumbnail_url && (
                      <img
                        src={book.thumbnail_url.startsWith('http') ? book.thumbnail_url : `${API_BASE}${book.thumbnail_url}`}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{book.title}</p>
                    <p className="tech-label-sm">{book.author}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{formatDuration(book.total_time)}</p>
                    <p className="tech-label-sm">{book.total_pages} pages</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Listening Statistics */}
      <section className="space-y-6">
        <h2 className="heading-sm flex items-center gap-3">
          <Music size={20} className="text-green-400" />
          Listening Statistics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            label="Total Plays"
            value={playCountStats?.totalPlays || 0}
            subValue="all-time"
          />
          <StatCard
            icon={Music}
            label="Songs Played"
            value={playCountStats?.totalSongsPlayed || 0}
            subValue="all-time unique"
          />
          <StatCard
            icon={Calendar}
            label="Window Plays"
            value={listeningHistory?.totalPlays || 0}
            subValue={`last ${timeRange} days`}
          />
          <StatCard
            icon={Flame}
            label="Active Reading Days"
            value={readingStreak?.activeDays || 0}
            subValue="all-time"
          />
        </div>

        {/* Listening Chart */}
        <div className="card p-6">
          <MiniBarChart data={listeningTrendData.length ? listeningTrendData : listeningChartData} label="Songs played per day" />
        </div>

        {/* Top Songs */}
        {playCountStats?.topSongs?.length > 0 && (
          <div className="card p-6 space-y-4">
            <h3 className="tech-label">Most Played Songs</h3>
            <div className="space-y-3">
              {playCountStats.topSongs.slice(0, 5).map((song, i) => (
                <div key={song.id} className="flex items-center gap-4">
                  <span className="w-6 text-center font-mono text-sm text-white/40">{i + 1}</span>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-border shrink-0">
                    {song.thumbnail_url && (
                      <img
                        src={song.thumbnail_url.startsWith('http') ? song.thumbnail_url : `${API_BASE}${song.thumbnail_url}`}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                    <p className="tech-label-sm truncate">{song.artist || 'Unknown'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{song.play_count} plays</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Reading Habits */}
      <section className="space-y-6">
        <h2 className="heading-sm flex items-center gap-3">
          <PieChart size={20} className="text-purple-400" />
          Reading Habits
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="card p-6 text-center">
            <p className="text-4xl font-display font-bold text-green-400">
              {generalStats?.readingHabits?.completed || 0}
            </p>
            <p className="tech-label mt-2">Completed</p>
          </div>
          <div className="card p-6 text-center">
            <p className="text-4xl font-display font-bold text-yellow-400">
              {generalStats?.readingHabits?.inProgress || 0}
            </p>
            <p className="tech-label mt-2">In Progress</p>
          </div>
          <div className="card p-6 text-center">
            <p className="text-4xl font-display font-bold text-white/40">
              {Math.max(0, (generalStats?.books || 0) + (generalStats?.mangas || 0) - (generalStats?.readingHabits?.completed || 0) - (generalStats?.readingHabits?.inProgress || 0))}
            </p>
            <p className="tech-label mt-2">Not Started</p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="heading-sm flex items-center gap-3">
          <BarChart3 size={20} className="text-primary" />
          Library Statistics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Music}
            label="Local Songs"
            value={libraryBreakdown?.songsBySource?.local || 0}
            subValue={`YouTube: ${libraryBreakdown?.songsBySource?.youtube || 0}`}
          />
          <StatCard
            icon={BookOpen}
            label="Local Books"
            value={libraryBreakdown?.booksBySource?.local || 0}
            subValue={`External: ${libraryBreakdown?.booksBySource?.external || 0}`}
          />
          <StatCard
            icon={Film}
            label="Anime Entries"
            value={libraryBreakdown?.videosByType?.anime || 0}
            subValue={`Movies: ${libraryBreakdown?.videosByType?.movie || 0}`}
          />
          <StatCard
            icon={Target}
            label="Reading Completed"
            value={libraryBreakdown?.readingProgress?.completed || 0}
            subValue={`In progress: ${libraryBreakdown?.readingProgress?.inProgress || 0}`}
          />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="heading-sm flex items-center gap-3">
          <PieChart size={20} className="text-pink-400" />
          Genre Breakdown
        </h2>
        <div className="card p-6 space-y-3">
          {(genreBreakdown?.genres || []).length === 0 ? (
            <p className="tech-label-sm">No genre data yet. Add tags/genres to books/videos to populate this section.</p>
          ) : (
            genreBreakdown.genres.slice(0, 10).map((genre, index) => (
              <div key={`${genre.name}-${index}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white">{genre.name}</span>
                  <span className="text-white/60">{genre.total}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(5, Math.round((genre.total / Math.max(genreBreakdown.genres[0]?.total || 1, 1)) * 100))}%`,
                      background: genre.color || 'var(--color-primary)'
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default Stats;
