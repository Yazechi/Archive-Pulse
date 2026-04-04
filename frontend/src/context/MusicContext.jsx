import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MusicContext } from './musicContextInternal';
import { normalizeVisualizerStyle } from '../components/visualizers/styleCatalog';

const DEFAULT_VISUALIZER_SETTINGS = {
  style: 'bar',
  fftSize: 2048,
  smoothing: 0.75,
  barCount: 96,
  reactivity: 1,
  lineWidth: 2,
  glowIntensity: 0.7,
  barWidthScale: 1,
  barGapScale: 1,
  barRoundness: 0.45,
  barHeightScale: 1,
  mirrorEffect: true,
  primaryColor: '#22d3ee',
  secondaryColor: '#06b6d4',
  colorPreset: 'cyan',
  backgroundMode: 'default',
  backgroundImage: null,
  showAlbumArt: true,
  showParticles: true,
  showVignette: true,
  vinylScale: 1,
  vinylSpinSpeed: 1,
  artBorderRadius: 18,
  particleCount: 140,
  particleSpeed: 1,
  reflectionOpacity: 0.28,
  barOpacityMin: 0.4,
  barOpacityMax: 0.95,
  bassBoost: 1,
  trebleSensitivity: 1,
  midSensitivity: 1,
  pulseIntensity: 1,
  glowSpread: 1,
  energySmoothing: 0.68,
  transientBoost: 1.15,
  stereoSpread: 0.3,
  beatSensitivity: 1,
  trailStrength: 0.3,
  spectralTilt: 0,
  autoExtractColor: false,
  miniVisualizerStyle: 'bars',
  miniVisualizerSensitivity: 1,
  miniVisualizerBarCount: 28,
  miniVisualizerGlow: 0.7,
  miniVisualizerMirror: true,
  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  eqPreset: 'flat',
  playbackRate: 1,
};

const PLAY_ORDER_MODES = ['normal', 'shuffle', 'repeat-one', 'repeat-all'];

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const toValidFftSize = (value) => {
  const normalized = clampNumber(value, 32, 32768, DEFAULT_VISUALIZER_SETTINGS.fftSize);
  const exponent = Math.round(Math.log2(normalized));
  return 2 ** Math.min(15, Math.max(5, exponent));
};

const sanitizeVisualizerSettings = (settings) => ({
  ...settings,
  style: normalizeVisualizerStyle(settings.style),
  fftSize: toValidFftSize(settings.fftSize),
  smoothing: clampNumber(settings.smoothing, 0, 1, DEFAULT_VISUALIZER_SETTINGS.smoothing),
  barCount: Math.round(clampNumber(settings.barCount, 24, 256, DEFAULT_VISUALIZER_SETTINGS.barCount)),
  reactivity: clampNumber(settings.reactivity, 0.6, 2.6, DEFAULT_VISUALIZER_SETTINGS.reactivity),
  glowIntensity: clampNumber(settings.glowIntensity, 0, 2, DEFAULT_VISUALIZER_SETTINGS.glowIntensity),
  barWidthScale: clampNumber(settings.barWidthScale, 0.5, 2.5, DEFAULT_VISUALIZER_SETTINGS.barWidthScale),
  barGapScale: clampNumber(settings.barGapScale, 0.3, 2, DEFAULT_VISUALIZER_SETTINGS.barGapScale),
  barRoundness: clampNumber(settings.barRoundness, 0, 1, DEFAULT_VISUALIZER_SETTINGS.barRoundness),
  barHeightScale: clampNumber(settings.barHeightScale, 0.5, 3, DEFAULT_VISUALIZER_SETTINGS.barHeightScale),
  vinylScale: clampNumber(settings.vinylScale, 0.5, 1.5, DEFAULT_VISUALIZER_SETTINGS.vinylScale),
  vinylSpinSpeed: clampNumber(settings.vinylSpinSpeed, 0, 3, DEFAULT_VISUALIZER_SETTINGS.vinylSpinSpeed),
  artBorderRadius: clampNumber(settings.artBorderRadius, 0, 50, DEFAULT_VISUALIZER_SETTINGS.artBorderRadius),
  particleCount: clampNumber(settings.particleCount, 40, 200, DEFAULT_VISUALIZER_SETTINGS.particleCount),
  particleSpeed: clampNumber(settings.particleSpeed, 0.2, 2, DEFAULT_VISUALIZER_SETTINGS.particleSpeed),
  reflectionOpacity: clampNumber(settings.reflectionOpacity, 0.1, 0.5, DEFAULT_VISUALIZER_SETTINGS.reflectionOpacity),
  barOpacityMin: clampNumber(settings.barOpacityMin, 0.2, 0.8, DEFAULT_VISUALIZER_SETTINGS.barOpacityMin),
  barOpacityMax: clampNumber(settings.barOpacityMax, 0.7, 1, DEFAULT_VISUALIZER_SETTINGS.barOpacityMax),
  bassBoost: clampNumber(settings.bassBoost, 0.5, 2.5, DEFAULT_VISUALIZER_SETTINGS.bassBoost),
  trebleSensitivity: clampNumber(settings.trebleSensitivity, 0.5, 2, DEFAULT_VISUALIZER_SETTINGS.trebleSensitivity),
  midSensitivity: clampNumber(settings.midSensitivity, 0.5, 2, DEFAULT_VISUALIZER_SETTINGS.midSensitivity),
  pulseIntensity: clampNumber(settings.pulseIntensity, 0.5, 2, DEFAULT_VISUALIZER_SETTINGS.pulseIntensity),
  glowSpread: clampNumber(settings.glowSpread, 0.5, 2, DEFAULT_VISUALIZER_SETTINGS.glowSpread),
  energySmoothing: clampNumber(settings.energySmoothing, 0.2, 0.95, DEFAULT_VISUALIZER_SETTINGS.energySmoothing),
  transientBoost: clampNumber(settings.transientBoost, 0.6, 2.2, DEFAULT_VISUALIZER_SETTINGS.transientBoost),
  stereoSpread: clampNumber(settings.stereoSpread, 0, 1, DEFAULT_VISUALIZER_SETTINGS.stereoSpread),
  beatSensitivity: clampNumber(settings.beatSensitivity, 0.6, 2.2, DEFAULT_VISUALIZER_SETTINGS.beatSensitivity),
  trailStrength: clampNumber(settings.trailStrength, 0, 0.9, DEFAULT_VISUALIZER_SETTINGS.trailStrength),
  spectralTilt: clampNumber(settings.spectralTilt, -1, 1, DEFAULT_VISUALIZER_SETTINGS.spectralTilt),
  autoExtractColor: settings.autoExtractColor === true,
  miniVisualizerStyle: ['bars', 'wave', 'ring'].includes(settings.miniVisualizerStyle)
    ? settings.miniVisualizerStyle
    : DEFAULT_VISUALIZER_SETTINGS.miniVisualizerStyle,
  miniVisualizerSensitivity: clampNumber(settings.miniVisualizerSensitivity, 0.5, 2, DEFAULT_VISUALIZER_SETTINGS.miniVisualizerSensitivity),
  miniVisualizerBarCount: Math.round(clampNumber(settings.miniVisualizerBarCount, 12, 56, DEFAULT_VISUALIZER_SETTINGS.miniVisualizerBarCount)),
  miniVisualizerGlow: clampNumber(settings.miniVisualizerGlow, 0, 2, DEFAULT_VISUALIZER_SETTINGS.miniVisualizerGlow),
  miniVisualizerMirror: settings.miniVisualizerMirror !== false,
  eqPreset: typeof settings.eqPreset === 'string' ? settings.eqPreset : DEFAULT_VISUALIZER_SETTINGS.eqPreset,
});

const safeJSONParse = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse stored JSON settings', error);
    return fallback;
  }
};

export const MusicProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [volume, setVolume] = useState(0.7);
  const [isMainPlayerActive, setIsMainPlayerActive] = useState(false);
  const [isMainPlayerExpanded, setIsMainPlayerExpanded] = useState(false);
  const [analyser, setAnalyser] = useState(null);
  const [lyrics, setLyrics] = useState([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [currentLyricIndex] = useState(-1);
  const [crossfadeSeconds, setCrossfadeSeconds] = useState(() => {
    const stored = Number(localStorage.getItem('archive-crossfade-seconds'));
    return Number.isFinite(stored) ? Math.min(12, Math.max(0, stored)) : 3;
  });
  const [playOrder, setPlayOrder] = useState(() => {
    const stored = localStorage.getItem('archive-play-order');
    return PLAY_ORDER_MODES.includes(stored) ? stored : 'normal';
  });
  const [visualizerSettings, setVisualizerSettings] = useState(() => {
    const stored = safeJSONParse(localStorage.getItem('archive-visualizer-settings'), {});
    return sanitizeVisualizerSettings({ ...DEFAULT_VISUALIZER_SETTINGS, ...stored });
  });

  const audioRef = useRef(new Audio());
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const eqNodesRef = useRef([]);
  const bassBoostRef = useRef(null);
  const crossfadeTimerRef = useRef(null);
  const crossfadeAdvanceRef = useRef(false);
  const resolvedStreamUrlsRef = useRef(new Map());

  const persistVisualizerSettings = useCallback((next) => {
    localStorage.setItem('archive-visualizer-settings', JSON.stringify(next));
  }, []);

  const updateVisualizerSettings = useCallback((patch) => {
    setVisualizerSettings((prev) => {
      const next = sanitizeVisualizerSettings({ ...prev, ...patch });
      persistVisualizerSettings(next);
      return next;
    });
  }, [persistVisualizerSettings]);

  const setEQGain = useCallback((index, gain) => {
    if (eqNodesRef.current[index]) {
      eqNodesRef.current[index].gain.value = gain;
    }
    setVisualizerSettings((prev) => {
      const nextGains = [...(prev.eqGains || DEFAULT_VISUALIZER_SETTINGS.eqGains)];
      nextGains[index] = gain;
      const next = sanitizeVisualizerSettings({ ...prev, eqGains: nextGains, eqPreset: 'custom' });
      persistVisualizerSettings(next);
      return next;
    });
  }, [persistVisualizerSettings]);

  const applyEQPreset = useCallback((presetName, gains, bassBoost = visualizerSettings.bassBoost) => {
    const nextGains = Array.isArray(gains)
      ? gains.map((gain) => clampNumber(gain, -12, 12, 0))
      : DEFAULT_VISUALIZER_SETTINGS.eqGains;
    if (eqNodesRef.current.length > 0) {
      eqNodesRef.current.forEach((node, index) => {
        node.gain.value = nextGains[index] || 0;
      });
    }
    if (bassBoostRef.current) {
      bassBoostRef.current.gain.value = bassBoost;
    }
    setVisualizerSettings((prev) => {
      const next = sanitizeVisualizerSettings({
        ...prev,
        eqGains: nextGains,
        bassBoost,
        eqPreset: presetName,
      });
      persistVisualizerSettings(next);
      return next;
    });
  }, [persistVisualizerSettings, visualizerSettings.bassBoost]);

  const setBassBoost = useCallback((gain) => {
    if (bassBoostRef.current) {
      bassBoostRef.current.gain.value = gain;
    }
    updateVisualizerSettings({ bassBoost: gain });
  }, [updateVisualizerSettings]);

  const setPlaybackRate = useCallback((rate) => {
    audioRef.current.playbackRate = rate;
    updateVisualizerSettings({ playbackRate: rate });
  }, [updateVisualizerSettings]);

  const toggleMainPlayer = useCallback((state) => {
    setIsMainPlayerExpanded((prev) => (state === undefined ? !prev : state));
  }, []);

  useEffect(() => {
    const handleExpand = () => setIsMainPlayerExpanded(true);
    window.addEventListener('archive:expandPlayer', handleExpand);
    return () => window.removeEventListener('archive:expandPlayer', handleExpand);
  }, []);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextCtor();
      audioContextRef.current = context;

      const source = context.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      const analyserNode = context.createAnalyser();
      analyserRef.current = analyserNode;

      const frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      eqNodesRef.current = frequencies.map((freq, index) => {
        const filter = context.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = visualizerSettings.eqGains[index] || 0;
        return filter;
      });

      const bassBoost = context.createBiquadFilter();
      bassBoost.type = 'lowshelf';
      bassBoost.frequency.value = 200;
      bassBoost.gain.value = visualizerSettings.bassBoost || 0;
      bassBoostRef.current = bassBoost;

      let node = source;
      eqNodesRef.current.forEach((eq) => {
        node.connect(eq);
        node = eq;
      });
      node.connect(bassBoost);
      bassBoost.connect(analyserNode);
      analyserNode.connect(context.destination);
      setAnalyser(analyserNode);
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [visualizerSettings.bassBoost, visualizerSettings.eqGains]);

  useEffect(() => {
    if (!analyserRef.current) return;
    const safeFftSize = toValidFftSize(visualizerSettings.fftSize);
    const safeSmoothing = clampNumber(visualizerSettings.smoothing, 0, 1, DEFAULT_VISUALIZER_SETTINGS.smoothing);
    analyserRef.current.fftSize = safeFftSize;
    analyserRef.current.smoothingTimeConstant = safeSmoothing;
  }, [visualizerSettings.fftSize, visualizerSettings.smoothing]);

  useEffect(() => {
    audioRef.current.playbackRate = visualizerSettings.playbackRate || 1;
  }, [visualizerSettings.playbackRate]);

  useEffect(() => {
    localStorage.setItem('archive-play-order', playOrder);
  }, [playOrder]);

  useEffect(() => {
    localStorage.setItem('archive-crossfade-seconds', String(crossfadeSeconds));
  }, [crossfadeSeconds]);

  const getTrackUrl = useCallback((track) => {
    const sourceId = track.source_id || track.id;
    if (track.source === 'youtube') {
      return `http://127.0.0.1:5000/api/stream/${sourceId}`;
    }
    return `http://127.0.0.1:5000/uploads/music/${sourceId}`;
  }, []);

  const warmupStreamUrls = useCallback((tracks = []) => {
    tracks
      .filter((item) => item?.source === 'youtube')
      .slice(0, 6)
      .forEach((item) => {
        const sourceId = item.source_id || item.id;
        if (!sourceId || resolvedStreamUrlsRef.current.has(sourceId)) return;
        fetch(`http://127.0.0.1:5000/api/resolve-stream/${sourceId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.url) resolvedStreamUrlsRef.current.set(sourceId, data.url);
          })
          .catch(() => {});
      });
  }, []);

  const fadeAudioVolume = useCallback((from, to, durationMs) => new Promise((resolve) => {
    if (crossfadeTimerRef.current) {
      window.clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    const audio = audioRef.current;
    const duration = Math.max(120, durationMs);
    const stepMs = 40;
    const steps = Math.max(1, Math.floor(duration / stepMs));
    let step = 0;
    audio.volume = from;
    crossfadeTimerRef.current = window.setInterval(() => {
      step += 1;
      const t = Math.min(1, step / steps);
      audio.volume = from + (to - from) * t;
      if (t >= 1) {
        window.clearInterval(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
        resolve();
      }
    }, stepMs);
  }), []);

  const playTrack = useCallback(async (track, trackList = [], options = {}) => {
    if (!track) return false;
    initAudioContext();
    const useTransition = options.useTransition !== false;

    if (trackList.length > 0) {
      setQueue(trackList);
      warmupStreamUrls(trackList);
    } else {
      setQueue((prev) => {
        if (prev.length === 0) return [track];
        if (prev.some((item) => item.id === track.id)) return prev;
        return [...prev, track];
      });
    }

    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      return true;
    }

    if (currentTrack) {
      setHistory((prev) => [currentTrack, ...prev.filter((item) => item.id !== currentTrack.id)].slice(0, 20));
    }

    const audio = audioRef.current;
    const targetVolume = volume;
    const shouldCrossfade = useTransition && crossfadeSeconds > 0 && isPlaying && currentTrack;
    try {
      if (shouldCrossfade) {
        const fadeDuration = Math.max(250, Math.floor((crossfadeSeconds * 1000) / 2));
        await fadeAudioVolume(audio.volume, 0, fadeDuration);
      }

      audio.src = getTrackUrl(track);
      const shouldResumeFromLast = options.resumeFromLast === true;
      const resumeAt = shouldResumeFromLast ? Number(track.last_position) || 0 : 0;
      audio.currentTime = Math.max(0, resumeAt);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      setCurrentTrack(track);
      crossfadeAdvanceRef.current = false;
      if (shouldCrossfade) audio.volume = 0;

      await audio.play();
      setIsPlaying(true);

      if (shouldCrossfade) {
        await fadeAudioVolume(0, targetVolume, Math.max(250, Math.floor((crossfadeSeconds * 1000) / 2)));
      } else {
        audio.volume = targetVolume;
      }

      // Log play activity (fire and forget)
      fetch('http://127.0.0.1:5000/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'play',
          content_type: 'song',
          content_id: track.id,
          content_title: track.title,
          content_thumbnail: track.thumbnail_url
        })
      }).catch(() => {}); // Ignore errors
      fetch(`http://127.0.0.1:5000/api/songs/${track.id}/play`, { method: 'POST' }).catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Playback failed', error);
      setIsPlaying(false);
      return false;
    }
  }, [crossfadeSeconds, currentTrack, fadeAudioVolume, getTrackUrl, initAudioContext, isPlaying, volume, warmupStreamUrls]);

  const getCurrentIndex = useCallback(() => {
    if (!currentTrack || queue.length === 0) return -1;
    return queue.findIndex((item) => item.id === currentTrack.id);
  }, [currentTrack, queue]);

  const cyclePlayOrder = useCallback(() => {
    setPlayOrder((prev) => {
      const index = PLAY_ORDER_MODES.indexOf(prev);
      return PLAY_ORDER_MODES[(index + 1) % PLAY_ORDER_MODES.length];
    });
  }, []);

  const nextTrack = useCallback(async () => {
    if (!currentTrack || queue.length === 0) return false;
    const currentIndex = getCurrentIndex();
    if (currentIndex === -1) return false;

    if (playOrder === 'repeat-one') {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      return true;
    }

    if (playOrder === 'shuffle' && queue.length > 1) {
      let randomIndex = currentIndex;
      while (randomIndex === currentIndex) {
        randomIndex = Math.floor(Math.random() * queue.length);
      }
      return playTrack(queue[randomIndex], queue);
    }

    const hasNext = currentIndex < queue.length - 1;
    if (hasNext) {
      return playTrack(queue[currentIndex + 1], queue);
    }

    if (playOrder === 'repeat-all') {
      return playTrack(queue[0], queue);
    }

    setIsPlaying(false);
    return false;
  }, [currentTrack, getCurrentIndex, playOrder, playTrack, queue]);

  const prevTrack = useCallback(async () => {
    if (!currentTrack || queue.length === 0) return false;

    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return true;
    }

    const currentIndex = getCurrentIndex();
    if (currentIndex > 0) {
      return playTrack(queue[currentIndex - 1], queue);
    }

    if (playOrder === 'repeat-all' && queue.length > 1) {
      return playTrack(queue[queue.length - 1], queue);
    }

    if (playOrder === 'shuffle' && history.length > 0) {
      return playTrack(history[0], queue);
    }

    return false;
  }, [currentTrack, getCurrentIndex, history, playOrder, playTrack, queue]);

  const togglePlay = useCallback(async () => {
    if (!currentTrack) return;
    initAudioContext();
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Playback failed', error);
      setIsPlaying(false);
    }
  }, [currentTrack, initAudioContext, isPlaying]);

  const changeVolume = useCallback((value) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolume(clamped);
    audioRef.current.volume = clamped;
  }, []);

  const removeFromQueue = useCallback((trackId) => {
    setQueue((prev) => prev.filter((track) => track.id !== trackId));
  }, []);

  const moveQueueItem = useCallback((fromIndex, toIndex) => {
    setQueue((prev) => {
      if (!Array.isArray(prev) || prev.length < 2) return prev;
      if (fromIndex === toIndex) return prev;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchLyrics = async () => {
      if (!currentTrack?.title) {
        setLyrics([]);
        return;
      }
      setLyricsLoading(true);
      try {
        const queryParts = deriveLyricsQuery(currentTrack);
        const query = new URLSearchParams({
          title: queryParts.title,
        });
        if (queryParts.artist) query.set('artist', queryParts.artist);
        const res = await fetch(
          `http://127.0.0.1:5000/api/lyrics?${query.toString()}`
        );
        if (!res.ok) throw new Error('lyrics unavailable');
        const data = await res.json();
        if (!cancelled) setLyrics(normalizeLyricsPayload(data));
      } catch {
        if (!cancelled) setLyrics([]);
      } finally {
        if (!cancelled) setLyricsLoading(false);
      }
    };
    fetchLyrics();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.title, currentTrack?.artist]);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = volume;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      if (!crossfadeSeconds || crossfadeSeconds <= 0 || crossfadeAdvanceRef.current) return;
      const duration = Number(audio.duration);
      if (!Number.isFinite(duration) || duration <= 0) return;
      const threshold = Math.max(0.8, crossfadeSeconds);
      if (audio.currentTime >= duration - threshold) {
        crossfadeAdvanceRef.current = true;
        void nextTrack();
      }
    };
    const handleEnded = () => {
      crossfadeAdvanceRef.current = false;
      void nextTrack();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      if (crossfadeTimerRef.current) {
        window.clearInterval(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
      }
    };
  }, [crossfadeSeconds, nextTrack, volume]);

  const currentIndex = useMemo(() => getCurrentIndex(), [getCurrentIndex]);
  const canPrev = useMemo(() => {
    if (!currentTrack) return false;
    if (playOrder === 'shuffle') return queue.length > 1 || history.length > 0;
    if (playOrder === 'repeat-all') return queue.length > 0;
    return currentIndex > 0;
  }, [currentIndex, currentTrack, history.length, playOrder, queue.length]);
  const canNext = useMemo(() => {
    if (!currentTrack) return false;
    if (playOrder === 'shuffle') return queue.length > 1;
    if (playOrder === 'repeat-one' || playOrder === 'repeat-all') return queue.length > 0;
    return currentIndex !== -1 && currentIndex < queue.length - 1;
  }, [currentIndex, currentTrack, playOrder, queue.length]);

  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        queue,
        history,
        removeFromQueue,
        moveQueueItem,
        clearQueue,
        volume,
        isMainPlayerActive,
        setIsMainPlayerActive,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        changeVolume,
        audioRef,
        analyserRef,
        analyser,
        isMainPlayerExpanded,
        toggleMainPlayer,
        canPrev,
        canNext,
        visualizerSettings,
        updateVisualizerSettings,
        lyrics,
        lyricsLoading,
        currentLyricIndex,
        crossfadeSeconds,
        setCrossfadeSeconds,
        setEQGain,
        applyEQPreset,
        setBassBoost,
        setPlaybackRate,
        playOrder,
        setPlayOrder,
        cyclePlayOrder,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};
const deriveLyricsQuery = (track) => {
  const rawTitle = String(track?.title || '').trim();
  const rawArtist = String(track?.artist || '').trim();
  const stripped = rawTitle
    .split('|')[0]
    .replace(/\((official|lyrics?|audio|video|hd)\)/gi, '')
    .trim();
  const splitIdx = stripped.indexOf(' - ');
  if (splitIdx !== -1) {
    const parsedArtist = stripped.slice(0, splitIdx).trim();
    const parsedTitle = stripped.slice(splitIdx + 3).trim();
    if (parsedArtist && parsedTitle) {
      return { artist: parsedArtist, title: parsedTitle };
    }
  }
  return { artist: rawArtist, title: rawTitle };
};
const normalizeLyricsPayload = (data) => {
    if (Array.isArray(data?.syncedLines) && data.syncedLines.length > 0) {
      return data.syncedLines
        .map((line) => ({
          time: Number(line.time),
          text: String(line.text || '').trim(),
          synced: true,
        }))
        .filter((line) => Number.isFinite(line.time) && line.time >= 0 && line.text);
    }
    if (Array.isArray(data?.lines)) {
      return data.lines
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .map((text) => ({ time: null, text, synced: false }));
    }
    return [];
  };
