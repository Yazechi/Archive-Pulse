import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MusicPlayer from './components/MusicPlayer';
import { useEffect, useRef, lazy, Suspense, useState } from 'react';
import { useMusic } from './context/useMusic';

const Home = lazy(() => import('./pages/Home'));
const Music = lazy(() => import('./pages/Music'));
const Playlists = lazy(() => import('./pages/Playlists'));
const Search = lazy(() => import('./pages/Search'));
const Books = lazy(() => import('./pages/Books'));
const MangaChapters = lazy(() => import('./pages/MangaChapters'));
const Reader = lazy(() => import('./pages/Reader'));
const Upload = lazy(() => import('./pages/Upload'));
const Profile = lazy(() => import('./pages/Profile'));
const Videos = lazy(() => import('./pages/Videos'));
const VideoPlayer = lazy(() => import('./pages/VideoPlayer'));
const Activity = lazy(() => import('./pages/Activity'));
const Stats = lazy(() => import('./pages/Stats'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Favorites = lazy(() => import('./pages/Favorites'));

function AppContent() {
  const { isMainPlayerExpanded, toggleMainPlayer } = useMusic();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const onChange = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const handleSidebarToggle = (e) => setIsSidebarCollapsed(e.detail.isCollapsed);
    window.addEventListener('sidebar:toggle', handleSidebarToggle);
    return () => window.removeEventListener('sidebar:toggle', handleSidebarToggle);
  }, []);

  useEffect(() => {
    if (isMainPlayerExpanded && location.pathname !== prevPathRef.current) {
      toggleMainPlayer(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, isMainPlayerExpanded, toggleMainPlayer]);

  const isReaderPage = location.pathname.startsWith('/reader');
  const isVideoPlayerPage = location.pathname.startsWith('/video-player');
  const isFullscreenPage = isReaderPage || isVideoPlayerPage;

  return (
    <div className="app-shell flex min-h-screen bg-bg-dark text-text-primary font-body selection:bg-primary/20 overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-mesh opacity-60" />
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '36px 36px' }}
      />

      {!isFullscreenPage && <Sidebar />}
      
      <main 
        className={`flex-1 transition-all duration-300 z-10 relative overflow-y-auto custom-scrollbar ${
          isFullscreenPage ? 'ml-0' : isMobile ? 'ml-0' : isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className={isVideoPlayerPage ? '' : 'min-h-screen pt-8 md:pt-12 px-4 md:px-8 lg:px-12 xl:px-16 pb-44 md:pb-32'}>
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/music" element={<Music />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/search" element={<Search />} />
              <Route path="/books" element={<Books />} />
              <Route path="/manga-chapters" element={<MangaChapters />} />
              <Route path="/reader" element={<Reader />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/video-player" element={<VideoPlayer />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/favorites" element={<Favorites />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {!isVideoPlayerPage && <MusicPlayer isReaderPage={isReaderPage} isSidebarCollapsed={isSidebarCollapsed} isMobile={isMobile} />}
    </div>
  );
}

const LoadingState = () => (
  <div className="min-h-[60vh] grid place-items-center">
    <div className="card p-8 flex flex-col items-center gap-4">
      <div className="w-12 h-[2px] bg-primary animate-pulse rounded-full" />
      <span className="tech-label text-primary">Synchronizing...</span>
    </div>
  </div>
);

function App() {
  useEffect(() => {
    const applyTheme = () => {
      const theme = localStorage.getItem('archive-theme') || '#00f2ff';
      document.documentElement.style.setProperty('--color-primary', theme);
    };
    applyTheme();
    window.addEventListener('storage', applyTheme);
    return () => window.removeEventListener('storage', applyTheme);
  }, []);

  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
