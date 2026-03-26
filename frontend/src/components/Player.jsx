import { useMusic } from '../context/MusicContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import MiniBarVisualizer from './visualizers/MiniBarVisualizer';
import useAccentColor from './visualizers/useAccentColor';

const Player = () => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    changeVolume,
    volume,
    audioRef,
    analyser,
    isMainPlayerExpanded,
    toggleMainPlayer,
    canPrev,
    canNext,
    visualizerSettings,
  } = useMusic();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);

    let saveInterval;
    if (currentTrack && isPlaying) {
      saveInterval = setInterval(() => {
        if (audio.currentTime > 0) {
          axios.put(`http://127.0.0.1:5000/api/songs/${currentTrack.id}/progress`, { position: audio.currentTime }).catch(() => {});
        }
      }, 10000);
    }

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      if (saveInterval) clearInterval(saveInterval);
    };
  }, [audioRef, currentTrack, isPlaying]);

  const handleSeek = (e) => {
    if (!duration || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
  };

  const handleVolumeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    changeVolume(ratio);
  };

  const formatTime = (t) => {
    if (Number.isNaN(t) || t === Infinity) return '0:00';
    return `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
  };

  const thumbUrl = currentTrack?.thumbnail_url;
  const fullThumb = thumbUrl ? (thumbUrl.startsWith('http') ? thumbUrl : `http://127.0.0.1:5000${thumbUrl}`) : null;
  const accentColor = useAccentColor(fullThumb, visualizerSettings.accentSource);

  if (!currentTrack || isMainPlayerExpanded) return null;

  const progress = Math.min(100, Math.max(0, (currentTime / (duration || 1)) * 100));

  return (
    <nav
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] animate-fade-in"
      style={{ width: 'min(94vw, 920px)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative rounded-[2.15rem] overflow-hidden border transition-all duration-500"
        style={{
          background: 'linear-gradient(135deg, rgba(8,17,29,0.93), rgba(16,16,37,0.88), rgba(30,14,22,0.84))',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderColor: hovered ? 'rgba(122,206,255,0.28)' : 'rgba(255,255,255,0.09)',
          boxShadow: hovered
            ? '0 28px 80px rgba(0,0,0,0.78), 0 0 0 1px rgba(122,206,255,0.14), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 16px 56px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-12 left-[13%] w-44 h-24 rounded-full blur-3xl bg-cyan-300/20" />
          <div className="absolute -bottom-12 right-[8%] w-40 h-24 rounded-full blur-3xl bg-orange-300/15" />
        </div>

        <div className="absolute inset-0 opacity-70 pointer-events-none">
          <MiniBarVisualizer analyser={analyser} isPlaying={isPlaying} settings={visualizerSettings} accentColor={accentColor} />
        </div>

        <div onClick={handleSeek} className="relative w-full cursor-pointer" style={{ height: hovered ? '6px' : '3px', transition: 'height 0.25s ease' }}>
          <div className="absolute inset-0 bg-white/[0.06]" />
          <div className="absolute top-0 left-0 h-full transition-none" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #72e3ff, #7ab6ff 45%, #b8a7ff 70%, #ffa27f)', boxShadow: '0 0 12px rgba(122,206,255,0.55)' }} />
        </div>

        <div className="relative z-10 flex items-center gap-4 px-5 py-3.5">
          <button onClick={() => toggleMainPlayer(true)} className="flex items-center gap-3 min-w-0 flex-1 group/info text-left">
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/15 relative">
              {thumbUrl ? (
                <img src={fullThumb} alt="" className="w-full h-full object-cover" style={{ animation: isPlaying ? 'spin 28s linear infinite' : 'none', filter: isPlaying ? 'brightness(1.02)' : 'brightness(0.65)' }} />
              ) : (
                <div className="w-full h-full bg-white/[0.05] flex items-center justify-center text-white/25">
                  <span className="material-symbols-outlined text-base">music_note</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/info:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm">open_in_full</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-headline text-[1.05rem] truncate leading-none group-hover/info:text-cyan-100 transition-colors">{currentTrack.title}</p>
              <p className="text-[9px] uppercase tracking-[0.22em] text-white/40 font-bold truncate mt-1.5">{currentTrack.artist}</p>
            </div>
          </button>

          <div className="flex items-center gap-2.5 shrink-0">
            <button onClick={prevTrack} disabled={!canPrev} className={`hidden sm:flex w-9 h-9 items-center justify-center rounded-full transition-all ${canPrev ? 'text-white/35 hover:text-white hover:bg-white/10 hover:scale-105' : 'text-white/10 cursor-not-allowed'}`} title={canPrev ? 'Previous' : 'No previous track'}>
              <span className="material-symbols-outlined text-xl">skip_previous</span>
            </button>

            <button onClick={togglePlay} className="relative w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 group">
              <div className="absolute inset-0 rounded-full opacity-80" style={{ background: 'linear-gradient(135deg, #72e3ff, #7ab6ff 45%, #b8a7ff 72%, #ffa27f)' }} />
              <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-80 blur-lg transition-opacity" style={{ background: 'linear-gradient(135deg, #72e3ff, #b8a7ff, #ffa27f)' }} />
              <span className="material-symbols-outlined text-xl text-black relative z-10" style={{ fontVariationSettings: '"FILL" 1' }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>

            <button onClick={nextTrack} disabled={!canNext} className={`hidden sm:flex w-9 h-9 items-center justify-center rounded-full transition-all ${canNext ? 'text-white/35 hover:text-white hover:bg-white/10 hover:scale-105' : 'text-white/10 cursor-not-allowed'}`} title={canNext ? 'Next' : 'No next track'}>
              <span className="material-symbols-outlined text-xl">skip_next</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-5 shrink-0">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-white/35 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span className="opacity-30">/</span>
              <span>{formatTime(duration)}</span>
            </div>

            <div className="flex items-center gap-2.5 w-24">
              <span className="material-symbols-outlined text-white/25 text-base">{volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}</span>
              <div onClick={handleVolumeClick} className="flex-1 h-1 bg-white/12 rounded-full cursor-pointer relative">
                <div className="h-full rounded-full transition-none" style={{ width: `${volume * 100}%`, background: 'linear-gradient(90deg, rgba(114,227,255,0.78), rgba(255,162,127,0.72))' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Player;
