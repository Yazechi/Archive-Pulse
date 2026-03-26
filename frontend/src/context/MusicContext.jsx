import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { extractAccentColor } from '../components/visualizers/useAccentColor';

const MusicContext = createContext();

export const MusicProvider = ({ children }) => {
  const DEFAULT_VISUALIZER_SETTINGS = {
    qualityMode: 'auto',
    stylePreset: 'balanced',
    intensity: 1,
    motion: 1,
    motionProfile: 'steady',
    palette: 'aurora',
    accentMode: 'auto',
    accentSource: 'dominant',
    accentBehavior: 'single',
    customBaseColor: '#ff4fd8',
    customAccentColor: '#44d7ff',
    density: 1,
    depth: 1,
    smoothing: 1,
    transientSensitivity: 1,
    noiseFloor: 0.08,
    bassFocus: 1,
    midFocus: 1,
    trebleFocus: 1,
    bloom: 1,
    ambientGlow: 1,
    barGlow: 1,
    rimGlow: 1,
    shadowStrength: 1,
    style: 'circle',
    barShape: 'square',
    radius: 1,
    scale: 1,
    verticalOffset: 0,
    coverSize: 1,
    vinylSize: 1,
    revealAmount: 0.32,
    coverMode: 'reveal',
    backgroundFx: 'gradient',
    vignette: 1,
    grain: 0,
    lightRays: 0.35,
    fog: 0.25,
    gradientDrift: 0.35,
    beatFx: 'cover-pulse',
    coverPulse: 0.25,
    rimPulse: 0.35,
    flashOnKick: 0.2,
    sparkBurst: 0.15,
    saturation: 1,
    brightness: 1,
    contrast: 1,
    temperature: 0,
  };
  const STYLE_DEFAULTS = {
    circle: { radius: 1, density: 1, scale: 1, coverSize: 1, vinylSize: 1, revealAmount: 0.32, coverMode: 'overlay', backgroundFx: 'gradient', ambientGlow: 1.1, barGlow: 1.15, rimGlow: 1.1, beatFx: 'cover-pulse' },
    semi: { radius: 1, density: 1, scale: 1, coverSize: 0.94, vinylSize: 1.02, revealAmount: 0.34, coverMode: 'reveal', backgroundFx: 'fog', ambientGlow: 1.15, barGlow: 1.1, rimGlow: 1.2, beatFx: 'rim-pulse' },
    bars: { radius: 0.92, density: 1.06, scale: 1, coverSize: 0.94, vinylSize: 0.94, revealAmount: 0.32, coverMode: 'overlay', backgroundFx: 'gradient', ambientGlow: 0.85, barGlow: 1.35, rimGlow: 0.75, beatFx: 'flash' },
    mirrored: { radius: 0.96, density: 1.02, scale: 1, coverSize: 0.96, vinylSize: 0.96, revealAmount: 0.32, coverMode: 'overlay', backgroundFx: 'rays', ambientGlow: 0.95, barGlow: 1.25, rimGlow: 0.9, beatFx: 'spark' },
    'pulse-ring': { radius: 1.02, density: 1.08, scale: 1, coverSize: 1, vinylSize: 1, revealAmount: 0.32, coverMode: 'overlay', backgroundFx: 'rays', ambientGlow: 1.2, barGlow: 1.4, rimGlow: 1.3, beatFx: 'rim-pulse' },
    'wave-line': { radius: 0.9, density: 1, scale: 1, coverSize: 0.95, vinylSize: 0.95, revealAmount: 0.32, coverMode: 'overlay', backgroundFx: 'drift', ambientGlow: 0.9, barGlow: 1.1, rimGlow: 0.8, beatFx: 'flash' },
    'stacked-bars': { radius: 0.92, density: 1.18, scale: 1, coverSize: 0.93, vinylSize: 0.94, revealAmount: 0.32, coverMode: 'overlay', backgroundFx: 'gradient', ambientGlow: 0.95, barGlow: 1.45, rimGlow: 0.85, beatFx: 'spark' },
    halo: { radius: 1.08, density: 1.1, scale: 1, coverSize: 0.98, vinylSize: 1, revealAmount: 0.32, coverMode: 'overlay', backgroundFx: 'fog', ambientGlow: 1.35, barGlow: 1.25, rimGlow: 1.45, beatFx: 'rim-pulse' },
  };

  const readVisualizerSettings = () => {
    try {
      const raw = localStorage.getItem('archive-visualizer-settings');
      if (raw) return { ...DEFAULT_VISUALIZER_SETTINGS, ...JSON.parse(raw) };
    } catch (_e) {}
    return DEFAULT_VISUALIZER_SETTINGS;
  };

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [volume, setVolume] = useState(0.7);
  const [isMainPlayerActive, setIsMainPlayerActive] = useState(false);
  const [isMainPlayerExpanded, setIsMainPlayerExpanded] = useState(false);
  const [analyser, setAnalyser] = useState(null);
  const [visualizerSettings, setVisualizerSettings] = useState(readVisualizerSettings);
  const audioRef = useRef(new Audio());
  
  // Audio Visualizer Context
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    const handleExpand = () => setIsMainPlayerExpanded(true);
    window.addEventListener('archive:expandPlayer', handleExpand);
    return () => window.removeEventListener('archive:expandPlayer', handleExpand);
  }, []);

  const toggleMainPlayer = (state) => {
    setIsMainPlayerExpanded(state !== undefined ? state : !isMainPlayerExpanded);
  };

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;
      analyserRef.current.smoothingTimeConstant = 0.72;
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      setAnalyser(analyserRef.current);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (!currentTrack) return;
    initAudioContext();
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Playback failed', err);
        setIsPlaying(false);
      }
    }
  }, [currentTrack, initAudioContext, isPlaying]);

  const playTrack = useCallback(async (track, trackList = []) => {
    if (!track) return;
    if (trackList.length > 0) setQueue(trackList);

    if (currentTrack?.id === track.id) {
      await togglePlay();
      return;
    }

    const sourceId = track.source_id || track.id;
    const url = track.source === 'youtube' 
      ? `http://127.0.0.1:5000/api/stream/${sourceId}`
      : `http://127.0.0.1:5000/uploads/music/${sourceId}`;
    const thumbUrl = track.thumbnail_url;
    const fullThumb = thumbUrl ? (thumbUrl.startsWith('http') ? thumbUrl : `http://127.0.0.1:5000${thumbUrl}`) : null;

    if (fullThumb) {
      try {
        await Promise.all([
          extractAccentColor(fullThumb, 'dominant'),
          extractAccentColor(fullThumb, 'vivid'),
          extractAccentColor(fullThumb, 'dark'),
          extractAccentColor(fullThumb, 'light'),
        ]);
      } catch (_e) {}
    }

    setCurrentTrack(track);
    audioRef.current.src = url;
    
    const onLoaded = () => {
      if (track.last_position) {
        audioRef.current.currentTime = track.last_position;
      }
      audioRef.current.removeEventListener('loadedmetadata', onLoaded);
    };
    audioRef.current.addEventListener('loadedmetadata', onLoaded);
    
    initAudioContext();

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Playback failed', err);
      setIsPlaying(false);
    }
  }, [currentTrack, initAudioContext, togglePlay]);

  const nextTrack = useCallback(() => {
    if (queue.length === 0 || !currentTrack) return;
    const index = queue.findIndex(t => t.id === currentTrack.id);
    if (index !== -1 && index < queue.length - 1) {
      playTrack(queue[index + 1]);
    }
  }, [queue, currentTrack, playTrack]);

  const prevTrack = useCallback(() => {
    if (queue.length === 0 || !currentTrack) return;
    const index = queue.findIndex(t => t.id === currentTrack.id);
    if (index > 0) {
      playTrack(queue[index - 1]);
    }
  }, [queue, currentTrack, playTrack]);

  const currentIndex = useMemo(
    () => queue.findIndex(t => t.id === currentTrack?.id),
    [queue, currentTrack]
  );
  const canPrev = currentIndex > 0;
  const canNext = currentIndex !== -1 && currentIndex < queue.length - 1;

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = volume;
    audio.crossOrigin = "anonymous";
    
    const handleEnded = () => {
      setIsPlaying(false);
      nextTrack();
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [queue, currentTrack, volume, nextTrack]);

  const changeVolume = (val) => {
    const v = Math.max(0, Math.min(1, val));
    setVolume(v);
    audioRef.current.volume = v;
  };

  const updateVisualizerSettings = useCallback((patch) => {
    setVisualizerSettings((prev) => {
      const stylePatch = patch?.style && patch.style !== prev.style
        ? (STYLE_DEFAULTS[patch.style] || {})
        : {};
      const next = { ...DEFAULT_VISUALIZER_SETTINGS, ...prev, ...stylePatch, ...patch };
      try {
        localStorage.setItem('archive-visualizer-settings', JSON.stringify(next));
      } catch (_e) {}
      return next;
    });
  }, []);

  return (
    <MusicContext.Provider value={{ 
      currentTrack, isPlaying, queue, volume, isMainPlayerActive, setIsMainPlayerActive,
      playTrack, togglePlay, nextTrack, prevTrack, changeVolume, audioRef, analyserRef, analyser,
      isMainPlayerExpanded, toggleMainPlayer, canPrev, canNext,
      visualizerSettings, updateVisualizerSettings
    }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => useContext(MusicContext);
