import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const onChange = (event) => {
      setIsMobile(event.matches);
      if (!event.matches) setIsMobileOpen(false);
    };
    setIsMobile(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed);
    window.dispatchEvent(new CustomEvent('sidebar:toggle', { detail: { isCollapsed } }));
  }, [isCollapsed]);

  const navItems = [
    { name: 'Dashboard', icon: 'dashboard', path: '/' },
    { name: 'Music Library', icon: 'library_music', path: '/music' },
    { name: 'Collections', icon: 'auto_awesome_motion', path: '/playlists' },
    { name: 'Literature', icon: 'menu_book', path: '/books' },
    { name: 'Videos', icon: 'movie', path: '/videos' },
    { name: 'Discovery', icon: 'explore', path: '/search' },
    { name: 'Data Entry', icon: 'upload_file', path: '/upload' },
    { name: 'Downloads', icon: 'download', path: '/downloads' },
    { name: 'Activity', icon: 'history', path: '/activity' },
    { name: 'Stats', icon: 'analytics', path: '/stats' },
  ];

  if (location.pathname === '/reader') return null;

  return (
    <>
      {isMobile && (
        <>
          <button
            onClick={() => setIsMobileOpen((value) => !value)}
            className="fixed top-4 left-4 z-[170] w-10 h-10 rounded-xl border border-white/15 bg-bg-dark/75 backdrop-blur-xl text-white grid place-items-center"
            aria-label="Toggle navigation"
          >
            <span className="material-symbols-outlined text-[20px]">{isMobileOpen ? 'close' : 'menu'}</span>
          </button>
          <div
            className={`fixed inset-0 z-[145] bg-black/55 backdrop-blur-sm transition-opacity duration-250 ${
              isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setIsMobileOpen(false)}
          />
        </>
      )}

      <aside 
        className={`fixed left-0 top-0 h-full z-[150] bg-bg-dark/75 backdrop-blur-2xl border-r border-border/80 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] shadow-[12px_0_40px_rgba(0,0,0,0.35)] ${
          isMobile
            ? `w-72 max-w-[82vw] ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`
            : isCollapsed
              ? 'w-20'
              : 'w-64'
        }`}
      >
      {/* Brand */}
      <div 
        className="h-20 flex items-center px-4 cursor-pointer group shrink-0"
        onClick={() => navigate('/')}
      >
        <div className="w-10 h-10 bg-primary/12 border border-primary/35 flex items-center justify-center rounded-xl group-hover:scale-110 transition-transform">
          <span className="material-symbols-outlined text-primary font-bold">all_inclusive</span>
        </div>
        {!isCollapsed && (
          <div className="ml-4">
            <h1 className="font-display text-lg tracking-tight text-white">ARCHIVE</h1>
            <p className="tech-label-sm text-primary/70">Pulse Engine</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1.5 overflow-y-auto scrollbar-none px-2.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => isMobile && setIsMobileOpen(false)}
              className={`flex items-center h-11 px-4 rounded-xl transition-all duration-300 group relative ${
                isActive ? "bg-primary/12 text-primary border border-primary/25 shadow-[0_8px_30px_var(--color-primary-dim)]" : "text-text-secondary hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] transition-transform ${isActive ? 'active-icon' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              {(!isCollapsed || isMobile) && (
                <span className="ml-4 font-medium text-[13px] tracking-tight transition-opacity truncate">
                  {item.name}
                </span>
              )}
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-full shadow-[0_0_12px_var(--color-primary)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/80 bg-bg-dark/40 pb-28">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          disabled={isMobile}
          className="w-full h-10 rounded-xl border border-border flex items-center justify-center text-text-muted hover:text-white hover:bg-white/5 transition-all mb-3"
        >
          <span className="material-symbols-outlined text-lg">
            {isCollapsed ? 'side_navigation' : 'keyboard_double_arrow_left'}
          </span>
        </button>

        <Link 
          to="/profile" 
          className="flex items-center p-2.5 rounded-2xl bg-white/[0.02] border border-border hover:bg-white/5 hover:border-border-hover transition-all group"
        >
          <div className="w-9 h-9 bg-zinc-800 rounded-xl overflow-hidden shrink-0 relative border border-white/10">
            <img 
              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=64&auto=format&fit=crop"
              className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all"
              alt=""
            />
          </div>
          {(!isCollapsed || isMobile) && (
            <div className="ml-3 overflow-hidden">
              <p className="text-[12px] font-semibold text-white truncate">Curator</p>
              <p className="tech-label-sm text-primary uppercase mt-0.5">Admin Access</p>
            </div>
          )}
        </Link>
      </div>
      </aside>
    </>
  );
};

export default Sidebar;
