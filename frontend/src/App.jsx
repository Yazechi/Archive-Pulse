import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import MainPlayer from './components/MainPlayer';
import { useEffect, useRef, lazy, Suspense } from 'react';
import { useMusic } from './context/MusicContext';

const Home = lazy(() => import('./pages/Home'));
const Music = lazy(() => import('./pages/Music'));
const Playlists = lazy(() => import('./pages/Playlists'));
const Search = lazy(() => import('./pages/Search'));
const Books = lazy(() => import('./pages/Books'));
const Reader = lazy(() => import('./pages/Reader'));
const Upload = lazy(() => import('./pages/Upload'));
const Profile = lazy(() => import('./pages/Profile'));

function AppContent() {
  const { isMainPlayerExpanded, queue, toggleMainPlayer } = useMusic();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Close main player when navigating to a different page
  useEffect(() => {
    if (isMainPlayerExpanded && location.pathname !== prevPathRef.current) {
      toggleMainPlayer(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen text-white font-body selection:bg-white/30">
      <Sidebar />
      <main className="flex-1 ml-20 md:ml-64 pt-24 px-6 md:px-16 overflow-x-hidden transition-all duration-500">
        <Suspense
          fallback={
            <div className="min-h-[60vh] grid place-items-center text-white/35">
              <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-primary animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/music" element={<Music />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/search" element={<Search />} />
            <Route path="/books" element={<Books />} />
            <Route path="/reader" element={<Reader />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Suspense>
      </main>

      {/* ── Main Player Overlay ── */}
      <div
        className={`fixed inset-0 z-[60] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          isMainPlayerExpanded
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{
          background: 'radial-gradient(ellipse 120% 80% at 58% 22%, rgba(39,72,112,0.96) 0%, rgba(14,20,34,0.98) 45%, rgba(8,10,18,0.99) 78%)',
          backdropFilter: 'blur(44px)'
        }}
      >
        {/* Ambient top gradient */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.4), rgba(255,182,149,0.3), transparent)' }}
        />
        <div className="h-full overflow-y-auto custom-scrollbar px-6 md:px-16 pt-8 pb-32">
          <MainPlayer queue={queue} />
        </div>
      </div>

      <Player />
    </div>
  );
}

function App() {
  useEffect(() => {
    const applyTheme = () => {
      const customTheme = localStorage.getItem('archive-theme') || '#8b5cf6';
      document.documentElement.style.setProperty('--color-primary', customTheme);

      const hex = customTheme.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 139;
      const g = parseInt(hex.substring(2, 4), 16) || 92;
      const b = parseInt(hex.substring(4, 6), 16) || 246;
      document.documentElement.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);
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
