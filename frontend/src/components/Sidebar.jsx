import { Link, useLocation, useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Home', icon: 'dashboard', path: '/' },
    { name: 'Music', icon: 'music_note', path: '/music' },
    { name: 'Collections', icon: 'library_music', path: '/playlists' },
    { name: 'Library', icon: 'menu_book', path: '/books' },
    { name: 'Search', icon: 'search', path: '/search' },
    { name: 'Upload', icon: 'cloud_upload', path: '/upload' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-20 md:w-64 z-[70] bg-[#071221]/55 backdrop-blur-3xl border-r border-white/10 flex flex-col py-10 px-4 transition-all duration-700 ease-in-out">
      
      {/* Brand */}
      <div className="mb-16 px-4 flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-12 h-12 bg-gradient-to-br from-primary via-primary-light to-secondary flex items-center justify-center rounded-[1.25rem] shrink-0 shadow-[0_0_40px_rgba(101,216,255,0.2)] group-hover:scale-110 group-hover:shadow-[0_0_60px_rgba(101,216,255,0.35)] transition-all duration-700">
          <span className="material-symbols-outlined text-black text-2xl font-bold">all_inclusive</span>
        </div>
        <div className="hidden md:block">
          <h1 className="font-headline italic text-2xl tracking-tighter leading-none text-white group-hover:text-primary transition-colors duration-500">Archive Pulse</h1>
          <p className="font-body uppercase tracking-[0.4em] text-[8px] text-primary mt-1.5 font-black opacity-60 group-hover:opacity-100 transition-opacity">Digital Curator</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 flex-grow">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-5 px-5 py-4 rounded-[1.5rem] transition-all duration-500 group relative overflow-hidden ${
                isActive 
                  ? "text-black scale-[1.02]" 
                  : "text-white/40 hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              <span className={`material-symbols-outlined text-2xl relative z-10 ${isActive ? 'font-variation-settings-fill-1' : 'group-hover:scale-110 transition-transform duration-500'}`}>
                {item.icon}
              </span>
              <span className="font-body uppercase tracking-[0.2em] text-[10px] font-black hidden md:block relative z-10">
                {item.name}
              </span>
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-50 to-cyan-100/90 shadow-[0_10px_30px_rgba(114,227,255,0.18)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Profile */}
      <Link to="/profile" className="mt-auto group flex items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-[2rem] transition-all duration-500 hover:bg-white/[0.05] hover:border-white/10 hover:-translate-y-1">
        <div className="w-12 h-12 rounded-[1.25rem] bg-[#0a0a0a] overflow-hidden shrink-0 border border-white/10 group-hover:border-primary/50 transition-all duration-500 relative">
          <img
            alt="Profile"
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
          />
          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        <div className="hidden md:block overflow-hidden">
          <p className="text-[10px] uppercase tracking-[0.15em] font-black text-white group-hover:text-primary transition-colors">Curator</p>
          <p className="text-[8px] uppercase tracking-[0.2em] text-white/30 group-hover:text-white/50 transition-colors mt-1">System Admin</p>
        </div>
      </Link>
    </aside>
  );
};

export default Sidebar;
