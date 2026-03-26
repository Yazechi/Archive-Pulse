import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:5000';

const Upload = () => {
  const [file, setFile] = useState(null);
  const [type, setType] = useState('music');
  const [metadata, setMetadata] = useState({ title: '', artist: '', author: '', series_id: '', volume_number: '' });
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [series, setSeries] = useState([]);

  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/series?t=${Date.now()}`);
        setSeries(res.data);
      } catch (err) {
        console.error('Failed to fetch series', err);
      }
    };
    fetchSeries();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setStatus('Transmitting to archive...');
    
    const formData = new FormData();
    formData.append(type, file);
    Object.keys(metadata).forEach(key => {
      if (metadata[key]) formData.append(key, metadata[key]);
    });

    try {
      const endpoint = type === 'music' ? '/api/upload/music' : '/api/upload/book';
      await axios.post(`${API_BASE}${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStatus('Catalogued successfully.');
      setFile(null);
      setMetadata({ title: '', artist: '', author: '', series_id: '', volume_number: '' });
    } catch (error) {
      setStatus('Transmission failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-0 animate-fade-in text-white selection:bg-primary/30 pb-40">
      
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-20 space-y-6 border-b border-white/5 pb-16">
        <div className="px-5 py-2 rounded-full bg-primary/10 border border-primary/20 w-fit backdrop-blur-md">
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-light">Expansion Module</span>
        </div>
        <h2 className="font-headline italic text-8xl md:text-9xl tracking-tighter text-gradient leading-[0.8] pb-2">Artifact Integration</h2>
        <p className="text-white/30 uppercase tracking-[0.6em] text-[10px] font-black ml-1">Catalog local data streams into the neural archive</p>
      </div>
      
      <form onSubmit={handleUpload} className="bg-[#0a0a0a]/20 backdrop-blur-3xl rounded-[4rem] p-10 md:p-16 border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-light to-secondary opacity-30" />
        
        {/* Type Selector */}
        <div className="mb-16 flex flex-wrap gap-6">
          {['music', 'book'].map(t => (
            <button 
              key={t}
              type="button" 
              onClick={() => { setType(t); setFile(null); }}
              className={`flex-1 py-5 rounded-full font-black uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-4 border backdrop-blur-md ${
                type === t 
                  ? 'bg-white text-black border-white shadow-[0_15px_30px_rgba(255,255,255,0.1)]' 
                  : 'bg-white/[0.03] text-white/40 border-white/5 hover:border-white/20 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${type === t ? 'font-variation-settings-fill-1' : ''}`}>
                {t === 'music' ? 'music_note' : 'menu_book'}
              </span>
              {t === 'music' ? 'Audio Signal' : 'Literary Record'}
            </button>
          ))}
        </div>

        <div className="space-y-12">
          {/* Dropzone */}
          <div className="relative group/drop">
            <input 
              type="file" 
              onChange={(e) => setFile(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              accept={type === 'music' ? 'audio/*' : '.epub,.pdf,.cbz'}
            />
            <div className={`border-2 border-dashed rounded-[3rem] py-24 flex flex-col items-center justify-center transition-all duration-700 relative overflow-hidden ${
              file 
                ? 'border-primary bg-primary/5' 
                : 'border-white/5 bg-white/[0.01] group-hover/drop:bg-white/[0.03] group-hover/drop:border-white/20'
            }`}>
              <div className="absolute inset-0 bg-primary/20 blur-[100px] opacity-0 group-hover/drop:opacity-30 transition-opacity duration-1000" />
              
              <div className={`w-24 h-24 rounded-[2rem] border flex items-center justify-center mb-10 transition-all duration-700 relative z-10 ${
                file ? 'border-primary bg-primary/20 rotate-0' : 'border-white/10 bg-white/5 rotate-12 group-hover/drop:rotate-0'
              }`}>
                <span className={`material-symbols-outlined text-4xl transition-all duration-700 ${file ? 'text-white' : 'text-white/20 group-hover/drop:text-white group-hover/drop:scale-110'}`}>
                  {file ? 'check_circle' : 'cloud_upload'}
                </span>
              </div>
              
              <p className="font-headline italic text-4xl mb-3 relative z-10 tracking-tighter">
                {file ? file.name : "Secure Payload Input"}
              </p>
              <p className="text-[10px] text-white/20 uppercase tracking-[0.5em] font-black relative z-10">
                {type === 'music' ? "Supports MP3, WAV, FLAC streams" : "Supports EPUB, PDF, CBZ archives"}
              </p>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.5em] text-white/30 font-black ml-6">Frequency Identifier (Title)</label>
              <input 
                type="text" 
                value={metadata.title}
                onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                className="w-full bg-white/[0.03] border border-white/5 rounded-3xl px-8 py-5 text-lg font-headline italic focus:outline-none focus:border-primary/50 text-white placeholder:text-white/5 transition-all duration-500 shadow-xl"
                placeholder="Ex: Event Horizon"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.5em] text-white/30 font-black ml-6">
                {type === 'music' ? 'Signal Source (Artist)' : 'Archivist (Author)'}
              </label>
              <input 
                type="text" 
                value={type === 'music' ? metadata.artist : metadata.author}
                onChange={(e) => setMetadata({...metadata, [type === 'music' ? 'artist' : 'author']: e.target.value})}
                className="w-full bg-white/[0.03] border border-white/5 rounded-3xl px-8 py-5 text-lg font-headline italic focus:outline-none focus:border-primary/50 text-white placeholder:text-white/5 transition-all duration-500 shadow-xl"
                placeholder="Ex: Unknown Entity"
              />
            </div>
            
            {type === 'book' && (
              <>
                <div className="space-y-4">
                  <label className="block text-[10px] uppercase tracking-[0.5em] text-white/30 font-black ml-6">Sequence Series</label>
                  <div className="relative group/sel">
                    <select
                      value={metadata.series_id}
                      onChange={(e) => setMetadata({...metadata, series_id: e.target.value})}
                      className="w-full appearance-none bg-white/[0.03] border border-white/5 rounded-3xl px-8 py-5 text-lg font-headline italic focus:outline-none focus:border-primary/50 text-white transition-all duration-500 shadow-xl"
                    >
                      <option value="" className="bg-[#0a0a0a]">No Established Series</option>
                      {series.map(s => (
                        <option key={s.id} value={s.id} className="bg-[#0a0a0a]">{s.title}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover/sel:text-primary transition-colors">expand_more</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] uppercase tracking-[0.5em] text-white/30 font-black ml-6">Volume Index</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={metadata.volume_number}
                    onChange={(e) => setMetadata({...metadata, volume_number: e.target.value})}
                    className="w-full bg-white/[0.03] border border-white/5 rounded-3xl px-8 py-5 text-lg font-headline italic focus:outline-none focus:border-primary/50 text-white placeholder:text-white/5 transition-all duration-500 shadow-xl"
                    placeholder="Ex: 01.00"
                  />
                </div>
              </>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button 
              type="submit" 
              disabled={!file || uploading}
              className="w-full py-8 bg-white text-black rounded-full font-black uppercase tracking-[0.4em] text-[12px] hover:scale-105 hover:bg-primary hover:text-white active:scale-95 transition-all shadow-[0_30px_60px_rgba(255,255,255,0.05)] disabled:opacity-20 disabled:grayscale disabled:hover:scale-100 flex items-center justify-center gap-4 group/btn overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <span className={`material-symbols-outlined text-3xl relative z-10 transition-transform duration-700 ${uploading ? 'animate-spin' : 'group-hover/btn:translate-y-[-100%] group-hover/btn:opacity-0'}`}>
                {uploading ? 'sync' : 'publish'}
              </span>
              {!uploading && (
                <span className="material-symbols-outlined text-3xl absolute opacity-0 group-hover:opacity-100 translate-y-[100%] group-hover:translate-y-0 transition-all duration-700 z-10 left-1/2 -translate-x-[200%]">
                  send
                </span>
              )}
              <span className="relative z-10">{uploading ? 'Transmitting Data...' : 'Integrate into Archive'}</span>
            </button>
            
            {status && (
              <p className="text-center text-[10px] font-black uppercase tracking-[0.5em] text-primary-light/50 mt-10 animate-fade-in">{status}</p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default Upload;