import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  FileText,
} from 'lucide-react';
import { useMusic } from '../context/useMusic';
import Visualizer from './visualizers/Visualizer';
import VisualizerSettings from './visualizers/VisualizerSettings';
import { getVisualizerStyleLabel, normalizeVisualizerStyle } from './visualizers/styleCatalog';

const ORDER_META = {
  normal: { label: 'Normal', icon: Repeat },
  shuffle: { label: 'Shuffle', icon: Shuffle },
  'repeat-one': { label: 'Repeat One', icon: Repeat },
  'repeat-all': { label: 'Repeat All', icon: Repeat },
};

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const toThumb = (thumbnailUrl) => {
  if (!thumbnailUrl) return null;
  return thumbnailUrl.startsWith('http') ? thumbnailUrl : `http://127.0.0.1:5000${thumbnailUrl}`;
};

const layoutForStyle = (style) => {
  switch (style) {
    case 'bar':
      return 'bar-left';
    case 'semicircular':
      return 'semi-vertical';
    case 'semi-arc':
      return 'semi-arc';
    case 'cover-art':
      return 'cover-vinyl-left';
    case 'dual-mirrored':
      return 'dual-center';
    default:
      return 'bottom-left';
  }
};

function MiniPlayer({ thumb, title, artist, isPlaying, onTogglePlay, onPrev, onNext, onExpand, analyser, settings }) {
  const primary = settings?.primaryColor || '#22d3ee';
  const secondary = settings?.secondaryColor || '#06b6d4';

  return (
    <div className="h-20 px-2 md:px-4 min-w-0 flex-1 relative flex items-center">
      <button className="flex items-center gap-3 min-w-0 pr-44 md:pr-72" onClick={onExpand}>
        <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl overflow-hidden border border-white/10 bg-zinc-900">
          {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0 text-left">
          <p className="text-xs text-white truncate font-semibold">{title}</p>
          <p className="text-[10px] text-white/60 truncate uppercase tracking-widest">{artist}</p>
        </div>
      </button>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:gap-2">
          <button className="p-2 text-white/70 hover:text-white tap-press" onClick={onPrev}>
            <SkipBack size={16} />
        </button>
        <button className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white text-black grid place-items-center hover:bg-primary tap-press" onClick={onTogglePlay}>
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <button className="p-2 text-white/70 hover:text-white tap-press" onClick={onNext}>
          <SkipForward size={16} />
        </button>
      </div>

      <div className="ml-auto hidden md:block h-14 w-64 rounded-xl border overflow-hidden"
        style={{
          borderColor: `${primary}55`,
          background: `linear-gradient(135deg, ${primary}1a, ${secondary}14)`,
          boxShadow: `0 0 18px ${primary}30`,
        }}
      >
        <MiniPlayerVisualizer analyser={analyser} settings={settings} />
      </div>
    </div>
  );
}

function MiniPlayerVisualizer({ analyser, settings }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const style = settings?.miniVisualizerStyle || 'bars';
    const count = Math.max(12, Math.min(56, Math.round(settings?.miniVisualizerBarCount ?? 28)));
    const sensitivity = Math.max(0.5, Math.min(2, settings?.miniVisualizerSensitivity ?? 1));
    const glow = Math.max(0, Math.min(2, settings?.miniVisualizerGlow ?? 0.7));
    const mirror = settings?.miniVisualizerMirror !== false;
    const data = new Uint8Array(1024);

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      ctx.clearRect(0, 0, w, h);

      if (!analyser) {
        rafRef.current = window.requestAnimationFrame(draw);
        return;
      }

      analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / count));
      const bars = [];
      for (let i = 0; i < count; i += 1) {
        let sum = 0;
        let c = 0;
        for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 1) {
          sum += data[j];
          c += 1;
        }
        bars.push(Math.min(1, ((sum / Math.max(1, c)) / 255) * sensitivity));
      }

      const primary = settings?.primaryColor || '#22d3ee';
      const secondary = settings?.secondaryColor || '#06b6d4';
      ctx.shadowBlur = 8 * glow;
      ctx.shadowColor = primary;

      if (style === 'wave') {
        ctx.beginPath();
        ctx.lineWidth = 2;
        for (let i = 0; i < bars.length; i += 1) {
          const x = (i / Math.max(1, bars.length - 1)) * w;
          const y = h * 0.5 - bars[i] * (h * 0.38);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        if (mirror) {
          for (let i = bars.length - 1; i >= 0; i -= 1) {
            const x = (i / Math.max(1, bars.length - 1)) * w;
            const y = h * 0.5 + bars[i] * (h * 0.28);
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          const fill = ctx.createLinearGradient(0, 0, 0, h);
          fill.addColorStop(0, `${primary}88`);
          fill.addColorStop(1, `${secondary}22`);
          ctx.fillStyle = fill;
          ctx.fill();
        }
        ctx.strokeStyle = primary;
        ctx.stroke();
      } else if (style === 'ring') {
        const cx = w / 2;
        const cy = h / 2;
        const baseR = Math.min(w, h) * 0.24;
        ctx.beginPath();
        for (let i = 0; i < bars.length; i += 1) {
          const t = i / bars.length;
          const angle = t * Math.PI * 2 - Math.PI / 2;
          const r = baseR + bars[i] * (h * 0.2);
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const grad = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR * 1.8);
        grad.addColorStop(0, `${secondary}22`);
        grad.addColorStop(1, `${primary}aa`);
        ctx.fillStyle = grad;
        ctx.fill();
      } else {
        const gap = 1.5;
        const bw = (w - gap * (bars.length - 1)) / bars.length;
        for (let i = 0; i < bars.length; i += 1) {
          const amp = bars[i];
          const barH = Math.max(2, amp * h * 0.8);
          const x = i * (bw + gap);
          const y = h - barH;
          const grad = ctx.createLinearGradient(x, y, x, h);
          grad.addColorStop(0, primary);
          grad.addColorStop(1, secondary);
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, bw, barH);
          if (mirror) {
            ctx.globalAlpha = 0.32;
            ctx.fillRect(x, h, bw, -barH * 0.35);
            ctx.globalAlpha = 1;
          }
        }
      }

      ctx.shadowBlur = 0;
      rafRef.current = window.requestAnimationFrame(draw);
    };

    rafRef.current = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, settings]);

  return <canvas ref={canvasRef} className="w-full h-full block" aria-label="Mini player visualizer" />;
}

export default function MusicPlayer({ isReaderPage = false, isSidebarCollapsed = false, isMobile = false }) {
  const {
    currentTrack,
    isPlaying,
    queue,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    volume,
    changeVolume,
    audioRef,
    analyser,
    isMainPlayerExpanded,
    toggleMainPlayer,
    visualizerSettings,
    updateVisualizerSettings,
    canPrev,
    canNext,
    playOrder,
    cyclePlayOrder,
    lyrics,
    lyricsLoading,
    crossfadeSeconds,
    setCrossfadeSeconds,
  } = useMusic();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricsContainerRef = useRef(null);
  const leftOffset = isReaderPage || isMobile ? 0 : (isSidebarCollapsed ? 80 : 256);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleMeta = () => setDuration(audio.duration || 0);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleMeta);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleMeta);
    };
  }, [audioRef, currentTrack]);

  const thumb = toThumb(currentTrack?.thumbnail_url);
  const normalizedStyle = normalizeVisualizerStyle(visualizerSettings.style);
  const styleLabel = getVisualizerStyleLabel(normalizedStyle);
  const infoLayout = layoutForStyle(normalizedStyle);
  const orderMeta = ORDER_META[playOrder];
  const OrderIcon = orderMeta.icon;
  const syncedLyrics = useMemo(
    () => lyrics.filter((line) => line && typeof line === 'object' && Number.isFinite(line.time)),
    [lyrics]
  );
  const activeLyricIndex = useMemo(() => {
    if (!syncedLyrics.length) return -1;
    let active = -1;
    for (let i = 0; i < syncedLyrics.length; i += 1) {
      if (currentTime >= syncedLyrics[i].time) active = i;
      else break;
    }
    return active;
  }, [currentTime, syncedLyrics]);

  useEffect(() => {
    if (!showLyrics || activeLyricIndex < 0 || !lyricsContainerRef.current) return;
    const target = lyricsContainerRef.current.querySelector(`[data-lyric-index="${activeLyricIndex}"]`);
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeLyricIndex, showLyrics]);

  const infoOverlay = useMemo(() => {
    const commonTitle = (
      <>
        <p className="text-lg md:text-2xl font-bold text-white truncate">{currentTrack?.title}</p>
        <p className="text-[11px] md:text-xs text-white/70 uppercase tracking-[0.25em] truncate">
          {currentTrack?.artist || 'Unknown Artist'}
        </p>
      </>
    );

    if (!thumb || !visualizerSettings.showAlbumArt) {
      return <div className="absolute bottom-6 left-6 right-6">{commonTitle}</div>;
    }

    if (infoLayout === 'bar-left') {
      return (
        <div className="absolute left-8 top-7 w-[320px] rounded-2xl bg-black/60 border border-white/10 p-3.5 backdrop-blur-md flex items-center gap-3">
          <img src={thumb} alt="" className="w-[72px] h-[72px] rounded-xl object-cover border border-white/10 shrink-0" />
          <div className="min-w-0 space-y-1">
            {commonTitle}
          </div>
        </div>
      );
    }

    if (infoLayout === 'cover-vinyl-left') {
      return (
        <div className="absolute left-10 top-1/2 -translate-y-1/2 rounded-2xl bg-black/45 p-5 border border-white/10 backdrop-blur-md max-w-sm">
          <div className="flex items-center gap-4">
            <div className="relative w-28 h-28 shrink-0">
              <div className="absolute inset-0 rounded-full border border-white/10 bg-black shadow-2xl" />
              <img src={thumb} alt="" className="absolute inset-[18px] w-[74px] h-[74px] rounded-full object-cover border border-white/20" />
            </div>
            <div className="min-w-0">
              {commonTitle}
            </div>
          </div>
        </div>
      );
    }

    if (infoLayout === 'dual-center') {
      return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-black/50 border border-white/10 p-4 backdrop-blur-md min-w-[320px] max-w-lg text-center">
          {commonTitle}
        </div>
      );
    }

    if (infoLayout === 'semi-arc') {
      return (
        <div className="absolute bottom-6 left-6 rounded-xl bg-black/45 border border-white/10 p-4 backdrop-blur-md w-[300px]">
          <div className="flex items-center gap-3">
            <img src={thumb} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" />
            <div className="min-w-0">{commonTitle}</div>
          </div>
        </div>
      );
    }

    if (infoLayout === 'semi-vertical') {
      return (
        <div className="absolute bottom-6 left-6 rounded-xl bg-black/45 border border-white/10 p-4 backdrop-blur-md w-[340px]">
          <div className="flex items-center gap-3">
            <div className="relative w-20 h-20 shrink-0">
              <div className="absolute left-10 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black border border-white/10" />
              <img src={thumb} alt="" className="relative z-10 w-20 h-20 rounded-xl object-cover border border-white/10" />
            </div>
            <div className="min-w-0">{commonTitle}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute bottom-6 left-6 rounded-xl bg-black/45 border border-white/10 p-4 backdrop-blur-md min-w-[260px] max-w-md">
        {commonTitle}
      </div>
    );
  }, [currentTrack, infoLayout, thumb, visualizerSettings.showAlbumArt]);

  if (!currentTrack || isReaderPage) return null;

  return (
    <>
      {!isMainPlayerExpanded && (
      <div
          className="fixed z-[180] bottom-4 right-4 h-20 rounded-2xl border border-white/10 bg-surface/85 backdrop-blur-2xl px-3 md:px-4 flex items-center gap-3 md:gap-4 shadow-2xl"
          style={{ left: `${leftOffset + 16}px` }}
        >
          <MiniPlayer
            thumb={thumb}
            title={currentTrack.title}
            artist={currentTrack.artist}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onPrev={prevTrack}
            onNext={nextTrack}
            onExpand={() => toggleMainPlayer(true)}
            analyser={analyser}
            settings={visualizerSettings}
          />
        </div>
      )}

      <div
        className={`fixed z-[170] top-0 right-0 bottom-0 bg-bg-dark transition-all duration-300 ${
          isMainPlayerExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ left: `${leftOffset}px` }}
      >
        <div className="h-full grid grid-rows-[auto_1fr_auto]">
          <header className="h-16 px-4 md:px-8 border-b border-white/10 flex items-center justify-between bg-surface/60 backdrop-blur-xl">
            <div>
              <p className="tech-label text-primary">Music Player</p>
              <p className="tech-label-sm">Visualizer: {styleLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQueue((v) => !v)}
                className={`p-2 rounded-lg border tap-press ${showQueue ? 'border-primary text-primary' : 'border-white/10 text-white/70'}`}
              >
                <ListMusic size={16} />
              </button>
              <button
                onClick={() => setShowSettings((v) => !v)}
                className={`p-2 rounded-lg border tap-press ${showSettings ? 'border-primary text-primary' : 'border-white/10 text-white/70'}`}
              >
                <SlidersHorizontal size={16} />
              </button>
              <button
                onClick={() => setShowLyrics((v) => !v)}
                className={`p-2 rounded-lg border tap-press ${showLyrics ? 'border-primary text-primary' : 'border-white/10 text-white/70'}`}
                title="Lyrics"
              >
                <FileText size={16} />
              </button>
              <button onClick={() => toggleMainPlayer(false)} className="p-2 rounded-lg border border-white/10 text-white/70 tap-press">
                <ChevronDown size={16} />
              </button>
            </div>
          </header>

          <main className="relative overflow-hidden">
            <Visualizer analyser={analyser} thumbnailUrl={currentTrack.thumbnail_url} settings={visualizerSettings} />
            {infoOverlay}

            {showQueue && (
              <aside className="absolute top-3 right-3 md:top-4 md:right-4 bottom-3 md:bottom-4 w-[calc(100%-24px)] md:w-[320px] rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl overflow-hidden animate-panel-left">
                <div className="p-4 border-b border-white/10">
                  <p className="text-sm font-semibold text-white">Queue</p>
                  <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest">{queue.length} tracks</p>
                </div>
                <div className="h-[calc(100%-56px)] overflow-y-auto custom-scrollbar">
                  {queue.map((track, index) => (
                    <button
                      key={`${track.id}-${index}`}
                      onClick={() => playTrack(track, queue)}
                      className={`w-full flex items-center gap-3 p-3 border-b border-white/5 text-left ${
                        currentTrack.id === track.id ? 'bg-primary/15' : 'hover:bg-white/5'
                      }`}
                    >
                      <img src={toThumb(track.thumbnail_url)} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                      <div className="min-w-0">
                        <p className="text-xs text-white truncate">{track.title}</p>
                        <p className="text-[10px] text-white/50 uppercase tracking-widest truncate">{track.artist}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>
            )}

            {showSettings && (
              <aside className="absolute top-3 left-3 md:top-4 md:left-4 bottom-3 md:bottom-4 w-[calc(100%-24px)] md:w-[340px] rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl overflow-hidden animate-panel-right">
                <VisualizerSettings settings={visualizerSettings} onChange={updateVisualizerSettings} onClose={() => setShowSettings(false)} />
              </aside>
            )}

            {showLyrics && (
              <aside className="absolute top-3 right-3 md:top-4 md:right-4 bottom-3 md:bottom-4 w-[calc(100%-24px)] md:w-[340px] rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl overflow-hidden animate-panel-left">
                <div className="p-4 border-b border-white/10">
                  <p className="text-sm font-semibold text-white">Lyrics</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-widest truncate">{currentTrack?.title}</p>
                </div>
                <div ref={lyricsContainerRef} className="h-[calc(100%-56px)] overflow-y-auto custom-scrollbar p-4 space-y-2">
                  {lyricsLoading ? (
                    <p className="tech-label">Fetching lyrics...</p>
                  ) : lyrics.length === 0 ? (
                    <p className="tech-label">No lyrics found for this track.</p>
                  ) : syncedLyrics.length > 0 ? (
                    lyrics.map((line, idx) => {
                      if (!line?.text) return null;
                      const isActive = idx === activeLyricIndex;
                      return (
                        <p
                          key={`${idx}-${line.text.slice(0, 10)}`}
                          data-lyric-index={idx}
                          className={`text-sm leading-relaxed transition-colors ${
                            isActive ? 'text-primary font-semibold' : 'text-white/65'
                          }`}
                        >
                          {line.text}
                        </p>
                      );
                    })
                  ) : (
                    lyrics.map((line, idx) => (
                      <p key={`${idx}-${line.text?.slice(0, 10) || ''}`} className="text-sm text-white/80 leading-relaxed">
                        {line.text}
                      </p>
                    ))
                  )}
                </div>
              </aside>
            )}
          </main>

            <footer className="p-3 md:p-6 border-t border-white/10 bg-surface/55 backdrop-blur-xl space-y-3 md:space-y-4">
            <div className="grid grid-cols-[52px_1fr_52px] md:grid-cols-[180px_1fr_180px] items-center gap-3 md:gap-6">
              <button onClick={prevTrack} disabled={!canPrev} className="p-2 md:p-0 text-white/70 disabled:opacity-30 flex justify-center md:justify-start">
                <SkipBack size={20} />
              </button>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] md:text-xs text-white/60 w-10">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(duration, 1)}
                    step={0.1}
                    value={currentTime}
                    onChange={(event) => {
                      audioRef.current.currentTime = Number(event.target.value);
                      setCurrentTime(Number(event.target.value));
                    }}
                    className="flex-1 accent-cyan-300"
                  />
                  <span className="text-[10px] md:text-xs text-white/60 w-10 text-right">{formatTime(duration)}</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={cyclePlayOrder}
                    className="px-2 py-1 rounded-lg border border-white/15 text-white/70 hover:text-white text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 tap-press"
                  >
                    <OrderIcon size={13} /> {orderMeta.label}
                  </button>
                  <button className="w-12 h-12 rounded-xl bg-white text-black grid place-items-center hover:bg-primary tap-press" onClick={togglePlay}>
                    {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
                  </button>
                </div>
              </div>

              <button onClick={nextTrack} disabled={!canNext} className="p-2 md:p-0 text-white/70 disabled:opacity-30 flex justify-center md:justify-end">
                <SkipForward size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <Volume2 size={16} className="text-white/60" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                className="w-28 md:w-44 accent-cyan-300"
              />
              <div className="ml-3 flex items-center gap-2">
                <span className="text-[10px] text-white/60 uppercase tracking-widest">Crossfade</span>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={crossfadeSeconds}
                  onChange={(event) => setCrossfadeSeconds(Number(event.target.value))}
                  className="w-24 md:w-32 accent-cyan-300"
                />
                <span className="text-[10px] text-white/60 w-7 text-right">{crossfadeSeconds}s</span>
              </div>
              <button onClick={() => toggleMainPlayer(false)} className="ml-auto p-2 rounded-lg border border-white/10 text-white/70 hover:text-white tap-press">
                <Maximize2 size={14} />
              </button>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
