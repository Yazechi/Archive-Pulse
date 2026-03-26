import { useMusic } from '../context/MusicContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import Spectrum3DCanvas from './visualizers/Spectrum3DCanvas';
import useAccentColor from './visualizers/useAccentColor';

const VIS_BANDS = [
  { label: 'SUB', lo: 1, hi: 8, color: '#ff9e80' },
  { label: 'BASS', lo: 8, hi: 24, color: '#ffd180' },
  { label: 'LOW MID', lo: 24, hi: 72, color: '#8be9fd' },
  { label: 'MID', lo: 72, hi: 150, color: '#7cc7ff' },
  { label: 'HIGH MID', lo: 150, hi: 260, color: '#b39ddb' },
  { label: 'HIGH', lo: 260, hi: 380, color: '#a5d6a7' },
  { label: 'AIR', lo: 380, hi: 510, color: '#fff59d' },
];

const DEFAULT_PANEL_SETTINGS = {
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

const PanelSection = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <div className="text-[10px] uppercase tracking-[0.28em] text-white/48 font-black">{title}</div>
        <span className="material-symbols-outlined text-white/35 text-base">{open ? 'remove' : 'add'}</span>
      </button>
      {open ? <div className="space-y-3 mt-3">{children}</div> : null}
    </section>
  );
};

const Segmented = ({ options, value, onChange, disabled = false, columns = 3 }) => (
  <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
    {options.map((item) => (
      <button
        key={item.value}
        onClick={() => !disabled && onChange(item.value)}
        disabled={disabled}
        className={`rounded-xl border px-2 py-2 text-[11px] font-bold tracking-wide transition-all ${
          value === item.value
            ? 'border-cyan-200/40 bg-cyan-200/18 text-white'
            : disabled
              ? 'border-white/5 bg-white/[0.03] text-white/25 cursor-not-allowed'
              : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10'
        }`}
      >
        {item.preview ? <span className="mb-1 block h-8 rounded-lg border border-white/10" style={{ background: item.preview }} /> : null}
        {item.label}
      </button>
    ))}
  </div>
);

const RangeField = ({ label, min, max, step, value, onChange }) => (
  <label className="block space-y-2">
    <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/45">
      <span>{label}</span>
      <span>{typeof value === 'number' ? value.toFixed(2) : value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full"
    />
  </label>
);

const VisualizerSettingsPanel = ({ open, settings, onChange, onReset }) => {
  const [activeTab, setActiveTab] = useState('general');
  if (!open) return null;

  const palettePreview = {
    aurora: 'linear-gradient(90deg, hsl(316 92% 62%), hsl(198 92% 64%))',
    sunset: 'linear-gradient(90deg, hsl(12 94% 60%), hsl(42 94% 58%))',
    ocean: 'linear-gradient(90deg, hsl(202 92% 60%), hsl(168 82% 52%))',
    ember: 'linear-gradient(90deg, hsl(6 94% 56%), hsl(32 96% 58%))',
    neon: 'linear-gradient(90deg, hsl(286 100% 64%), hsl(174 94% 54%))',
    forest: 'linear-gradient(90deg, hsl(116 72% 48%), hsl(78 78% 54%))',
    synth: 'linear-gradient(90deg, hsl(330 96% 62%), hsl(268 88% 62%))',
    gold: 'linear-gradient(90deg, hsl(48 96% 58%), hsl(24 94% 58%))',
    mono: 'linear-gradient(90deg, hsl(212 40% 72%), hsl(212 18% 48%))',
    custom: `linear-gradient(90deg, ${settings.customBaseColor || '#ff4fd8'}, ${settings.customAccentColor || '#44d7ff'})`,
  };
  const palettes = [
    'aurora', 'sunset', 'ocean', 'ember', 'neon', 'forest', 'synth', 'gold', 'mono', 'custom'
  ].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1), preview: palettePreview[value] }));
  const accentModes = [
    { value: 'auto', label: 'Auto' },
    { value: 'blend', label: 'Blend' },
    { value: 'palette', label: 'Palette' },
    { value: 'complement', label: 'Comp' },
  ];
  const accentSources = [
    { value: 'dominant', label: 'Dominant' },
    { value: 'vivid', label: 'Vivid' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ];
  const accentBehaviors = [
    { value: 'single', label: 'Single' },
    { value: 'two-tone', label: 'Two Tone' },
    { value: 'triadic', label: 'Triadic' },
    { value: 'analogous', label: 'Analog' },
    { value: 'complementary', label: 'Complement' },
    { value: 'split', label: 'Split' },
  ];
  const stylePresets = [
    { value: 'balanced', label: 'Balanced' },
    { value: 'cinematic', label: 'Cinema' },
    { value: 'club', label: 'Club' },
    { value: 'soft', label: 'Soft' },
    { value: 'crisp', label: 'Crisp' },
  ];
  const coverModes = [
    { value: 'reveal', label: 'Reveal' },
    { value: 'overlay', label: 'Overlay' },
  ];
  const styles = [
    { value: 'circle', label: 'Circle', preview: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0 28%, transparent 29%), conic-gradient(from 0deg, #ff63d8, #7cd6ff, #ff9a5f, #ff63d8)' },
    { value: 'semi', label: 'Semi', preview: 'linear-gradient(90deg, transparent 0 48%, rgba(255,255,255,0.06) 49% 51%, transparent 52%), radial-gradient(circle at 35% 50%, rgba(255,255,255,0.06) 0 22%, transparent 23%), conic-gradient(from 270deg at 50% 50%, #ff8f70 0 180deg, transparent 180deg)' },
    { value: 'bars', label: 'Bars', preview: 'linear-gradient(180deg, transparent 0 35%, #ff63d8 35% 100%), repeating-linear-gradient(90deg, transparent 0 6%, rgba(255,255,255,0.14) 6% 8%)' },
    { value: 'mirrored', label: 'Mirrored', preview: 'linear-gradient(90deg, #ff9a5f 0 18%, transparent 18% 82%, #7c6bff 82% 100%)' },
    { value: 'pulse-ring', label: 'Pulse', preview: 'radial-gradient(circle, transparent 0 34%, #8ae8ff 35% 41%, transparent 42%), radial-gradient(circle, transparent 0 50%, #ff63d8 51% 56%, transparent 57%)' },
    { value: 'wave-line', label: 'Wave', preview: 'linear-gradient(180deg, transparent 0 60%, rgba(255,255,255,0.08) 61% 100%), linear-gradient(135deg, transparent 0 38%, #7cd6ff 39% 42%, transparent 43% 53%, #ff63d8 54% 57%, transparent 58%)' },
    { value: 'stacked-bars', label: 'Stacked', preview: 'repeating-linear-gradient(90deg, #ff63d8 0 6%, transparent 6% 10%), linear-gradient(180deg, transparent 0 25%, #ffb15f 25% 65%, #7cd6ff 65% 100%)' },
    { value: 'halo', label: 'Halo', preview: 'radial-gradient(circle, transparent 0 28%, #7cd6ff 29% 35%, transparent 36% 52%, #ff63d8 53% 60%, transparent 61%)' },
  ];
  const barShapes = [
    { value: 'square', label: 'Square' },
    { value: 'rounded', label: 'Rounded' },
    { value: 'tapered', label: 'Tapered' },
    { value: 'capsule', label: 'Capsule' },
    { value: 'needle', label: 'Needle' },
  ];
  const motionProfiles = [
    { value: 'steady', label: 'Steady' },
    { value: 'elastic', label: 'Elastic' },
    { value: 'snappy', label: 'Snappy' },
    { value: 'floaty', label: 'Floaty' },
    { value: 'cinematic', label: 'Cinema' },
  ];
  const bgOptions = [
    { value: 'gradient', label: 'Gradient' },
    { value: 'grain', label: 'Grain' },
    { value: 'rays', label: 'Rays' },
    { value: 'fog', label: 'Fog' },
    { value: 'drift', label: 'Drift' },
  ];
  const beatOptions = [
    { value: 'cover-pulse', label: 'Cover' },
    { value: 'rim-pulse', label: 'Rim' },
    { value: 'flash', label: 'Flash' },
    { value: 'spark', label: 'Spark' },
    { value: 'none', label: 'None' },
  ];

  const qualities = [
    { value: 'auto', label: 'Auto' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];
  const tabs = [
    { value: 'general', label: 'General' },
    { value: 'color', label: 'Color' },
    { value: 'motion', label: 'Motion' },
    { value: 'layout', label: 'Layout' },
    { value: 'fx', label: 'FX' },
  ];
  const handleExport = async () => {
    const payload = JSON.stringify(settings, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      window.alert('Visualizer preset copied to clipboard.');
    } catch (_e) {
      window.prompt('Copy preset JSON:', payload);
    }
  };
  const handleImport = () => {
    const raw = window.prompt('Paste visualizer preset JSON:');
    if (!raw) return;
    try {
      onChange(JSON.parse(raw));
    } catch (_e) {
      window.alert('Invalid preset JSON.');
    }
  };

  return (
    <div className="w-full max-h-[78vh] overflow-y-auto rounded-[1.7rem] border border-white/12 bg-[#081221]/98 shadow-[0_24px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl p-4 space-y-4 animate-fade-in text-white">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] uppercase tracking-[0.25em] text-white/75 font-black">Visualizer</h4>
        <div className="flex items-center gap-3">
          <button onClick={handleImport} className="text-[9px] uppercase tracking-widest text-white/55 hover:text-white transition-colors">Import</button>
          <button onClick={handleExport} className="text-[9px] uppercase tracking-widest text-white/55 hover:text-white transition-colors">Export</button>
          <button onClick={onReset} className="text-[9px] uppercase tracking-widest text-white/55 hover:text-white transition-colors">Reset</button>
        </div>
      </div>

      <Segmented options={tabs} value={activeTab} onChange={setActiveTab} columns={5} />

      {activeTab === 'general' && (
        <div className="grid grid-cols-2 gap-4">
          <PanelSection title="Preset">
            <Segmented options={qualities} value={settings.qualityMode} onChange={(value) => onChange({ qualityMode: value })} columns={4} />
            <Segmented options={stylePresets} value={settings.stylePreset} onChange={(value) => onChange({ stylePreset: value })} columns={5} />
          </PanelSection>
          <PanelSection title="Style">
            <Segmented options={styles} value={settings.style} onChange={(value) => onChange({ style: value })} columns={4} />
            <Segmented options={coverModes} value={settings.coverMode} onChange={(value) => onChange({ coverMode: value })} columns={2} />
            <Segmented options={barShapes} value={settings.barShape} onChange={(value) => onChange({ barShape: value })} columns={3} />
          </PanelSection>
        </div>
      )}

      {activeTab === 'color' && (
        <div className="grid grid-cols-2 gap-4">
          <PanelSection title="Accent">
            <Segmented options={accentModes} value={settings.accentMode} onChange={(value) => onChange({ accentMode: value })} columns={4} />
            <Segmented options={accentSources} value={settings.accentSource} onChange={(value) => onChange({ accentSource: value })} columns={4} />
            <Segmented options={accentBehaviors} value={settings.accentBehavior} onChange={(value) => onChange({ accentBehavior: value })} columns={3} />
          </PanelSection>
          <PanelSection title="Palette">
            <Segmented options={palettes} value={settings.palette} onChange={(value) => settings.accentMode !== 'auto' && onChange({ palette: value })} disabled={settings.accentMode === 'auto'} columns={5} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-widest text-white/45">Primary</span>
                <input type="color" value={settings.customBaseColor || '#ff4fd8'} onChange={(e) => onChange({ palette: 'custom', customBaseColor: e.target.value, accentMode: settings.accentMode === 'auto' ? 'palette' : settings.accentMode })} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 p-1" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-widest text-white/45">Accent</span>
                <input type="color" value={settings.customAccentColor || '#44d7ff'} onChange={(e) => onChange({ palette: 'custom', customAccentColor: e.target.value, accentMode: settings.accentMode === 'auto' ? 'palette' : settings.accentMode })} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 p-1" />
              </label>
            </div>
            <RangeField label="Saturation" min="0.4" max="1.8" step="0.05" value={settings.saturation} onChange={(value) => onChange({ saturation: value })} />
            <RangeField label="Brightness" min="0.5" max="1.5" step="0.05" value={settings.brightness} onChange={(value) => onChange({ brightness: value })} />
            <RangeField label="Contrast" min="0.6" max="1.6" step="0.05" value={settings.contrast} onChange={(value) => onChange({ contrast: value })} />
            <RangeField label="Temperature" min="-1" max="1" step="0.05" value={settings.temperature} onChange={(value) => onChange({ temperature: value })} />
          </PanelSection>
        </div>
      )}

      {activeTab === 'motion' && (
        <div className="grid grid-cols-2 gap-4">
          <PanelSection title="Motion">
            <Segmented options={motionProfiles} value={settings.motionProfile} onChange={(value) => onChange({ motionProfile: value })} columns={5} />
            <RangeField label="Intensity" min="0.3" max="2" step="0.05" value={settings.intensity} onChange={(value) => onChange({ intensity: value })} />
            <RangeField label="Motion" min="0.3" max="2" step="0.05" value={settings.motion} onChange={(value) => onChange({ motion: value })} />
            <RangeField label="Smoothing" min="0.2" max="1.8" step="0.05" value={settings.smoothing} onChange={(value) => onChange({ smoothing: value })} />
            <RangeField label="Transient" min="0.4" max="2" step="0.05" value={settings.transientSensitivity} onChange={(value) => onChange({ transientSensitivity: value })} />
          </PanelSection>
          <PanelSection title="Tuning">
            <RangeField label="Noise Floor" min="0" max="0.4" step="0.01" value={settings.noiseFloor} onChange={(value) => onChange({ noiseFloor: value })} />
            <RangeField label="Bass Focus" min="0.4" max="2" step="0.05" value={settings.bassFocus} onChange={(value) => onChange({ bassFocus: value })} />
            <RangeField label="Mid Focus" min="0.4" max="2" step="0.05" value={settings.midFocus} onChange={(value) => onChange({ midFocus: value })} />
            <RangeField label="Treble Focus" min="0.4" max="2" step="0.05" value={settings.trebleFocus} onChange={(value) => onChange({ trebleFocus: value })} />
          </PanelSection>
        </div>
      )}

      {activeTab === 'layout' && (
        <div className="grid grid-cols-2 gap-4">
          <PanelSection title="Layout">
            <RangeField label="Radius" min="0.75" max="1.35" step="0.05" value={settings.radius} onChange={(value) => onChange({ radius: value })} />
            <RangeField label="Density" min="0.55" max="1.8" step="0.05" value={settings.density} onChange={(value) => onChange({ density: value })} />
            <RangeField label="Scale" min="0.75" max="1.35" step="0.05" value={settings.scale} onChange={(value) => onChange({ scale: value })} />
            <RangeField label="Offset Y" min="-0.35" max="0.35" step="0.01" value={settings.verticalOffset} onChange={(value) => onChange({ verticalOffset: value })} />
            <RangeField label="Cover Size" min="0.7" max="1.35" step="0.05" value={settings.coverSize} onChange={(value) => onChange({ coverSize: value })} />
            <RangeField label="Vinyl Size" min="0.7" max="1.35" step="0.05" value={settings.vinylSize} onChange={(value) => onChange({ vinylSize: value })} />
            <RangeField label="Reveal" min="0" max="0.7" step="0.01" value={settings.revealAmount} onChange={(value) => onChange({ revealAmount: value })} />
          </PanelSection>
          <PanelSection title="Notes">
            <p className="text-sm text-white/55 leading-6">
              Style changes now apply per-style defaults automatically. Use this tab to fine-tune after switching styles instead of carrying old layout values into a new renderer mode.
            </p>
          </PanelSection>
        </div>
      )}

      {activeTab === 'fx' && (
        <div className="grid grid-cols-2 gap-4">
          <PanelSection title="Glow">
            <RangeField label="Bloom" min="0.2" max="2" step="0.05" value={settings.bloom} onChange={(value) => onChange({ bloom: value })} />
            <RangeField label="Ambient" min="0" max="2" step="0.05" value={settings.ambientGlow} onChange={(value) => onChange({ ambientGlow: value })} />
            <RangeField label="Bar Glow" min="0" max="2" step="0.05" value={settings.barGlow} onChange={(value) => onChange({ barGlow: value })} />
            <RangeField label="Rim Glow" min="0" max="2" step="0.05" value={settings.rimGlow} onChange={(value) => onChange({ rimGlow: value })} />
            <RangeField label="Shadow" min="0" max="2" step="0.05" value={settings.shadowStrength} onChange={(value) => onChange({ shadowStrength: value })} />
          </PanelSection>
          <PanelSection title="Background">
            <Segmented options={bgOptions} value={settings.backgroundFx} onChange={(value) => onChange({ backgroundFx: value })} columns={5} />
            <RangeField label="Vignette" min="0" max="2" step="0.05" value={settings.vignette} onChange={(value) => onChange({ vignette: value })} />
            <RangeField label="Grain" min="0" max="1" step="0.05" value={settings.grain} onChange={(value) => onChange({ grain: value })} />
            <RangeField label="Light Rays" min="0" max="1.5" step="0.05" value={settings.lightRays} onChange={(value) => onChange({ lightRays: value })} />
            <RangeField label="Fog" min="0" max="1.5" step="0.05" value={settings.fog} onChange={(value) => onChange({ fog: value })} />
            <RangeField label="Drift" min="0" max="1.5" step="0.05" value={settings.gradientDrift} onChange={(value) => onChange({ gradientDrift: value })} />
          </PanelSection>
          <PanelSection title="Beat Fx">
            <Segmented options={beatOptions} value={settings.beatFx} onChange={(value) => onChange({ beatFx: value })} columns={5} />
            <RangeField label="Cover Pulse" min="0" max="1" step="0.05" value={settings.coverPulse} onChange={(value) => onChange({ coverPulse: value })} />
            <RangeField label="Rim Pulse" min="0" max="1" step="0.05" value={settings.rimPulse} onChange={(value) => onChange({ rimPulse: value })} />
            <RangeField label="Kick Flash" min="0" max="1" step="0.05" value={settings.flashOnKick} onChange={(value) => onChange({ flashOnKick: value })} />
            <RangeField label="Spark Burst" min="0" max="1" step="0.05" value={settings.sparkBurst} onChange={(value) => onChange({ sparkBurst: value })} />
          </PanelSection>
        </div>
      )}
    </div>
  );
};

const BandMeters = () => {
  const { analyser } = useMusic();
  const meterRefs = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      analyser.getByteFrequencyData(dataArray);

      VIS_BANDS.forEach((band, i) => {
        const el = meterRefs.current[i];
        if (!el) return;
        let sum = 0;
        for (let b = band.lo; b < band.hi; b++) sum += dataArray[b] || 0;
        const avg = sum / (Math.max(1, band.hi - band.lo) * 255);
        el.style.width = `${Math.max(6, avg * 100)}%`;
        el.style.opacity = `${0.3 + avg * 0.7}`;
      });
    };

    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  return (
    <div className="space-y-2">
      {VIS_BANDS.map((band, i) => (
        <div key={band.label} className="flex items-center gap-3">
          <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest w-14 text-right shrink-0">{band.label}</span>
          <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
            <div
              ref={(el) => { meterRefs.current[i] = el; }}
              className="h-full rounded-full transition-none"
              style={{ width: '6%', background: band.color, boxShadow: `0 0 9px ${band.color}77` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const MainPlayer = ({ queue }) => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    audioRef,
    analyser,
    playTrack,
    toggleMainPlayer,
    canPrev,
    canNext,
    visualizerSettings,
    updateVisualizerSettings,
  } = useMusic();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekHover, setSeekHover] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!Number.isNaN(audio.currentTime)) setCurrentTime(audio.currentTime);
    if (!Number.isNaN(audio.duration)) setDuration(audio.duration);

    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onMeta = () => setDuration(audio.duration || 0);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
    };
  }, [audioRef, currentTrack?.id]);

  const formatTime = (t) => {
    if (Number.isNaN(t) || t === Infinity) return '0:00';
    return `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback((e) => {
    if (!duration || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
  }, [duration, audioRef]);

  const thumbUrl = currentTrack?.thumbnail_url;
  const fullThumb = thumbUrl ? (thumbUrl.startsWith('http') ? thumbUrl : `http://127.0.0.1:5000${thumbUrl}`) : null;
  const accentColor = useAccentColor(fullThumb, visualizerSettings.accentSource);

  if (!currentTrack) return null;

  const progress = Math.min(100, Math.max(0, (currentTime / (duration || 1)) * 100));
  const currentIdx = queue.findIndex((s) => s.id === currentTrack.id);
  const remainingQueue = currentIdx === -1 ? [] : queue.slice(currentIdx + 1);
  const isSemiStyle = visualizerSettings.style === 'semi';
  const isBarsStyle = visualizerSettings.style === 'bars';
  const isMirroredStyle = visualizerSettings.style === 'mirrored';
  const isLinearStyle = isBarsStyle || isMirroredStyle;
  const coverMode = visualizerSettings.coverMode || 'reveal';
  const centerX = '50%';
  const centerY = `${50 + (visualizerSettings.verticalOffset || 0) * 25}%`;
  const stageScale = visualizerSettings.scale || 1;
  const vinylSizeBase = isSemiStyle ? 35.5 : isLinearStyle ? 33.5 : 35.5;
  const coverSizeBase = isSemiStyle ? 22.5 : isLinearStyle ? 20.5 : 24;
  const vinylSize = `${vinylSizeBase * (visualizerSettings.vinylSize || 1) * stageScale}%`;
  const coverSize = `${coverSizeBase * (visualizerSettings.coverSize || 1) * stageScale}%`;
  const vinylCenterLeft = isSemiStyle && coverMode === 'reveal' ? `${50 + (visualizerSettings.revealAmount || 0.32) * 12.5}%` : centerX;
  const vinylCenterTop = centerY;
  const coverCenterLeft = centerX;
  const coverCenterTop = centerY;
  const coverTranslate = 'translate(-50%, -50%)';

  return (
    <div className="relative min-h-screen flex flex-col max-w-7xl mx-auto animate-fade-in">
      <button
        onClick={() => toggleMainPlayer(false)}
        className="absolute top-0 right-0 z-50 w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/10 transition-all group"
      >
        <span className="material-symbols-outlined text-white/40 group-hover:text-white text-xl transition-colors">keyboard_arrow_down</span>
      </button>

      <div className="flex flex-col xl:flex-row gap-8 flex-1 pt-4">
        <div className="xl:w-[56%] relative flex items-center justify-center">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 78% 70% at 50% 50%, rgba(122,206,255,0.15) 0%, rgba(255,157,124,0.08) 42%, transparent 78%)' }} />

          <div className="relative w-full max-w-[650px] aspect-square rounded-[2.2rem] overflow-hidden border border-white/10 bg-[#091220]/55 backdrop-blur-xl">
            <Spectrum3DCanvas analyser={analyser} isPlaying={isPlaying} settings={visualizerSettings} accentColor={accentColor} />

            <div className="absolute inset-0 pointer-events-none z-10">
              <div
                className="absolute rounded-full border border-white/10"
                style={{
                  width: vinylSize,
                  height: vinylSize,
                  left: vinylCenterLeft,
                  top: vinylCenterTop,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 28px rgba(0,0,0,0.42)',
                  background: 'radial-gradient(circle at 45% 42%, #4a4a4a 0%, #141414 48%, #050505 100%)'
                }}
              >
                <div className="absolute inset-[10%] rounded-full border border-white/5" />
                <div className="absolute inset-[23%] rounded-full border border-white/5" />
                  <div className="absolute inset-[37%] rounded-full border border-white/5" />
              </div>

              <div
                className="absolute z-10 overflow-hidden border border-white/15 shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
                style={{
                  width: coverSize,
                  height: coverSize,
                  borderRadius: isLinearStyle ? '1.15rem' : '0.55rem',
                  left: coverCenterLeft,
                  top: coverCenterTop,
                  transform: coverTranslate,
                }}
              >
                {thumbUrl ? (
                  <img src={fullThumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#0a1019] flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/15 text-4xl">music_note</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:w-[44%] flex flex-col px-2 xl:px-4 py-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="px-4 py-1.5 rounded-full bg-cyan-200/10 border border-cyan-100/20 backdrop-blur-md">
                  <span className="text-[9px] font-black uppercase tracking-[0.45em] text-cyan-100">Now Playing</span>
                </div>
                {isPlaying && (
                  <div className="flex gap-1 h-3 items-end">
                    {[0, 0.15, 0.3].map((d, i) => (
                      <div key={i} className="w-0.5 bg-cyan-200 rounded-full" style={{ height: '100%', animation: 'wave 1s ease-in-out infinite', animationDelay: `${d}s` }} />
                    ))}
                  </div>
                )}
              </div>

              <h2 className="font-headline italic leading-[0.9] tracking-tighter text-white" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>{currentTrack.title}</h2>
              <p className="text-[11px] uppercase tracking-[0.5em] text-white/45 font-black">{currentTrack.artist}</p>
            </div>

            <div className="shrink-0">
              <button
                onClick={() => setSettingsOpen((p) => !p)}
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all ${
                  settingsOpen ? 'bg-cyan-200/16 border-cyan-100/25' : 'bg-white/6 border-white/12 hover:bg-white/12'
                }`}
                title="Visualizer settings"
              >
                <span className="material-symbols-outlined text-white/80 text-lg">tune</span>
              </button>
            </div>
          </div>

          {settingsOpen && (
            <VisualizerSettingsPanel
              open={settingsOpen}
              settings={visualizerSettings}
              onChange={updateVisualizerSettings}
              onReset={() => updateVisualizerSettings(DEFAULT_PANEL_SETTINGS)}
            />
          )}

          <div className="space-y-3">
            <div className="relative w-full cursor-pointer" style={{ height: seekHover ? '8px' : '4px', transition: 'height 0.2s' }} onClick={handleSeek} onMouseEnter={() => setSeekHover(true)} onMouseLeave={() => setSeekHover(false)}>
              <div className="absolute inset-0 rounded-full bg-white/10" />
              <div className="absolute top-0 left-0 h-full rounded-full transition-none" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #72e3ff, #7ab6ff 45%, #b8a7ff 70%, #ffa27f)', boxShadow: '0 0 12px rgba(122,206,255,0.55)' }} />
              {seekHover && <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-xl" style={{ left: `calc(${Math.min(99, progress)}% - 8px)` }} />}
            </div>
            <div className="flex justify-between text-[10px] font-bold text-white/35 tabular-nums uppercase tracking-widest">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-10">
            <button onClick={prevTrack} disabled={!canPrev} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${canPrev ? 'text-white/35 hover:text-white hover:scale-110 active:scale-90' : 'text-white/15 cursor-not-allowed'}`} title={canPrev ? 'Previous' : 'No previous track'}>
              <span className="material-symbols-outlined text-3xl">skip_previous</span>
            </button>

            <button onClick={togglePlay} className="relative w-20 h-20 rounded-full flex items-center justify-center group transition-all hover:scale-105 active:scale-95">
              <div className="absolute inset-0 rounded-full opacity-70 blur-xl group-hover:opacity-95 transition-opacity" style={{ background: 'linear-gradient(135deg, #72e3ff, #b8a7ff, #ffa27f)' }} />
              <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, #72e3ff, #7ab6ff 45%, #b8a7ff 72%, #ffa27f)' }} />
              <span className="material-symbols-outlined text-4xl text-black relative z-10" style={{ fontVariationSettings: '"FILL" 1' }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>

            <button onClick={nextTrack} disabled={!canNext} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${canNext ? 'text-white/35 hover:text-white hover:scale-110 active:scale-90' : 'text-white/15 cursor-not-allowed'}`} title={canNext ? 'Next' : 'No next track'}>
              <span className="material-symbols-outlined text-3xl">skip_next</span>
            </button>
          </div>

          <div className="pt-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
            <p className="text-[8px] uppercase tracking-[0.5em] text-white/25 font-black mb-4">Frequency Analysis</p>
            <BandMeters />
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.08] mt-8 pt-8 space-y-5 pb-8">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/35">Next in Queue</h3>
          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest bg-white/[0.03] px-4 py-1.5 rounded-full border border-white/[0.07]">{remainingQueue.length} tracks</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {remainingQueue.slice(0, 8).map((song, i) => (
            <div key={song.id} onClick={() => playTrack(song, queue)} className="group flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-cyan-200/25 transition-all cursor-pointer hover:-translate-y-0.5 animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative border border-white/10">
                {song.thumbnail_url ? (
                  <img src={song.thumbnail_url.startsWith('http') ? song.thumbnail_url : `http://127.0.0.1:5000${song.thumbnail_url}`} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/20 text-base">music_note</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>play_arrow</span>
                </div>
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-headline text-sm truncate group-hover:text-cyan-100 transition-colors leading-tight">{song.title}</p>
                <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold truncate mt-0.5">{song.artist}</p>
              </div>
            </div>
          ))}

          {remainingQueue.length === 0 && (
            <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-white/[0.1]">
              <span className="material-symbols-outlined text-4xl text-white/10 block mb-3">queue_music</span>
              <p className="font-headline italic text-xl text-white/20">Queue is empty</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainPlayer;
