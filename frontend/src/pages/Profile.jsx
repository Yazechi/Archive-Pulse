import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Shield, Zap, Settings, LogOut, HardDrive, Cpu, Database, Clock, BookOpen, Music } from 'lucide-react';

const normalizeProgress = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const Profile = () => {
  const [theme, setTheme] = useState(localStorage.getItem('archive-theme') || '#00f2ff');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:5000/api/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch system stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const updateTheme = (color) => {
    setTheme(color);
    localStorage.setItem('archive-theme', color);
    document.documentElement.style.setProperty('--color-primary', color);
    window.dispatchEvent(new Event('storage'));
  };

  const statCards = [
    { label: 'Audio Artifacts', value: stats?.songs || '0', icon: Music, sub: stats?.musicDuration || '0m' },
    { label: 'Literary Nodes', value: (stats?.books || 0) + (stats?.mangas || 0), icon: Database, sub: `${stats?.books || 0} Books / ${stats?.mangas || 0} Manga` },
    { label: 'Active Sequences', value: stats?.playlists || '0', icon: Zap, sub: `${stats?.series || 0} Series Clusters` },
  ];

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-[1px] bg-primary animate-pulse" />
      <p className="tech-label text-primary">Accessing_System_Stats...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto page-shell">
      <header className="flex flex-col lg:flex-row items-center gap-10 border-b border-border pb-10">
        <div className="w-48 h-48 rounded-[3rem] border-2 border-primary/30 p-2 relative group">
          <div className="w-full h-full rounded-[2.5rem] overflow-hidden bg-zinc-900 border border-white/10">
            <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=256&auto=format&fit=crop" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Shield size={24} className="text-black" /></div>
        </div>
        
        <div className="flex-1 text-center lg:text-left space-y-4">
          <div className="flex justify-center lg:justify-start items-center gap-3">
            <span className="status-online" />
            <span className="tech-label text-primary">Auth Level Alpha // Chief Curator</span>
          </div>
          <h1 className="heading-lg leading-none">The Archive</h1>
          <p className="tech-label-sm">Status: Node Operational // Encryption: AES-256</p>
        </div>
      </header>

      {/* --- REAL DATA STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {statCards.map((s, i) => (
          <div key={i} className="card-interactive p-6 rounded-3xl flex flex-col gap-5 group">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><s.icon size={28} /></div>
            <div>
              <p className="tech-label mb-1">{s.label}</p>
              <p className="text-4xl font-display text-white">{s.value}</p>
              <p className="tech-label-sm mt-2">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">
        <section className="card p-8 rounded-3xl space-y-8">
          <div className="flex items-center gap-4">
            <Settings size={24} className="text-primary" />
            <h3 className="heading-sm">System Configuration</h3>
          </div>
          
          <div className="space-y-6">
            <p className="tech-label">Interface Accent Frequency</p>
            <div className="flex flex-wrap gap-4">
              {['#00f2ff', '#ff4500', '#7b2ff7', '#00ff7f', '#ff00ff', '#ffffff'].map(color => (
                <button
                  key={color}
                  onClick={() => updateTheme(color)}
                  className={`w-12 h-12 rounded-xl border-2 transition-all tap-press ${theme === color ? 'border-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'border-transparent opacity-50 hover:opacity-100 hover:scale-105'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <button className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between px-6 transition-all group tap-press">
              <span className="tech-label">Neural Link Refresh</span>
              <Cpu size={18} className="text-white/20 group-hover:text-primary transition-colors" />
            </button>
            <button className="w-full h-14 bg-red-500/5 hover:bg-red-500/20 border border-red-500/10 text-red-500 rounded-xl flex items-center justify-between px-6 transition-all group tap-press">
              <span className="tech-label">Deauthorize Node</span>
              <LogOut size={18} />
            </button>
          </div>
        </section>

        <section className="card p-8 rounded-3xl flex flex-col justify-between overflow-hidden relative group">
           <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-4">
                <Clock size={24} className="text-primary" />
                <h3 className="heading-sm">Recent Activity</h3>
              </div>
              <div className="space-y-4">
                {stats?.recentlyRead?.length > 0 ? stats.recentlyRead.map(book => (
                  <div key={book.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-10 h-14 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                      <img src={book.thumbnail_url} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate uppercase">{book.title}</p>
                      <p className="tech-label mt-1">Read_to_{Math.round(normalizeProgress(book.progress))}%</p>
                    </div>
                  </div>
                )) : (
                  <div className="py-10 text-center opacity-20">
                    <p className="tech-label tracking-[0.5em]">Log_Buffer_Empty</p>
                  </div>
                )}
              </div>
           </div>
           
           <div className="absolute -bottom-10 -right-10 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-1000">
              <Zap size={300} strokeWidth={1} />
           </div>
        </section>
      </div>
    </div>
  );
};

export default Profile;
