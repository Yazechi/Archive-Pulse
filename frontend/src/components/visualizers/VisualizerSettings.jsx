import { useRef } from 'react';
import { Disc, Layers, Palette, SlidersHorizontal, Sparkles, Upload, Wand2, X, Zap, Pipette } from 'lucide-react';
import { VISUALIZER_STYLE_OPTIONS, normalizeVisualizerStyle } from './styleCatalog';

const groupButton = (active) => (
  `px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
    active
      ? 'bg-primary text-black border-primary'
      : 'bg-black/40 text-white/60 border-white/10 hover:text-white'
  }`
);

const ToggleButton = ({ label, value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    className={`px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
      value
        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        : 'bg-black/40 text-white/40 border-white/10 hover:text-white/70'
    }`}
  >
    {label}
  </button>
);

const FIELD_HINTS = {
  'Energy Smoothing': 'Higher = smoother, lower = snappier response.',
  'Transient Boost': 'Boosts quick attack peaks (kicks/snares).',
  'Beat Sensitivity': 'Controls beat pulse detection aggressiveness.',
  'Stereo Spread': 'Pushes side bands outward for width.',
  'Trail Strength': 'Controls afterglow persistence on motion-heavy styles.',
  'Spectral Tilt': 'Bias energy toward highs (+) or lows (-).',
};

const SliderField = ({ label, value, min, max, step = 1, onChange, unit = '' }) => (
  <label className="space-y-2">
    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/70 font-mono">
      <span>{label}</span>
      <span>{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full accent-cyan-300"
    />
    {FIELD_HINTS[label] && (
      <p className="text-[9px] text-white/40 font-mono uppercase tracking-[0.14em]">{FIELD_HINTS[label]}</p>
    )}
  </label>
);

const COLOR_PRESETS = [
  { id: 'cyan', name: 'Cyan', primary: '#22d3ee', secondary: '#06b6d4' },
  { id: 'pink', name: 'Pink', primary: '#f472b6', secondary: '#ec4899' },
  { id: 'purple', name: 'Purple', primary: '#a78bfa', secondary: '#8b5cf6' },
  { id: 'green', name: 'Emerald', primary: '#34d399', secondary: '#10b981' },
  { id: 'orange', name: 'Orange', primary: '#fb923c', secondary: '#f97316' },
  { id: 'blue', name: 'Blue', primary: '#60a5fa', secondary: '#3b82f6' },
  { id: 'teal', name: 'Teal', primary: '#2dd4bf', secondary: '#14b8a6' },
  { id: 'red', name: 'Rose', primary: '#fb7185', secondary: '#f43f5e' },
];

const MINI_VISUALIZER_STYLES = [
  { id: 'bars', label: 'Mini Bars' },
  { id: 'wave', label: 'Mini Wave' },
  { id: 'ring', label: 'Mini Ring' },
];

const STYLE_HINTS = {
  bar: 'Classic mirrored pulse bars.',
  'round-base': 'Radial bars from a spinning core.',
  semicircular: 'Half-wrap halo around the vinyl.',
  'semi-arc': 'Bottom arc burst from hidden platter.',
  'dual-mirrored': 'Center split with bilateral symmetry.',
  'cover-art': 'Side lanes around focus artwork.',
  'stacked-pillars': 'Segmented pillar stacks with depth.',
  'horizon-tower': 'Perspective skyline toward center.',
  'pulse-frame': 'Reactive ring frame with beat flares.',
  'spectral-ribbon': 'Flowing ribbon spline from spectrum.',
  'saturn-ring': 'Elliptical planetary ring with audio pulses.',
  'kaleido-orbit': 'Orbiting radial ring around center vinyl.',
  'diagonal-drift': 'Diagonal drifting equalizer lanes.',
};

const STYLE_PRESETS = {
  bar: [
    { label: 'Punchy', patch: { reactivity: 1.1, energySmoothing: 0.66, barWidthScale: 0.99, barHeightScale: 1.02, glowIntensity: 0.74 } },
    { label: 'Balanced', patch: { reactivity: 1.04, energySmoothing: 0.7, barWidthScale: 1, barHeightScale: 1, glowIntensity: 0.7 } },
    { label: 'Smooth', patch: { reactivity: 0.96, energySmoothing: 0.78, barWidthScale: 1.04, barHeightScale: 0.95, glowIntensity: 0.64 } },
  ],
  'round-base': [
    { label: 'Orbit Glow', patch: { reactivity: 1.1, glowIntensity: 0.8, barHeightScale: 1.02, vinylSpinSpeed: 1.08 } },
    { label: 'Neon Core', patch: { reactivity: 1.14, glowIntensity: 0.86, barHeightScale: 1.06, pulseIntensity: 1.08 } },
    { label: 'Soft Ring', patch: { reactivity: 1.0, glowIntensity: 0.72, barHeightScale: 0.96, energySmoothing: 0.76 } },
  ],
  semicircular: [
    { label: 'Halo', patch: { reactivity: 1.1, barHeightScale: 1.03, barWidthScale: 1.02, glowIntensity: 0.78 } },
    { label: 'Wide Arc', patch: { reactivity: 1.12, barHeightScale: 1.06, barWidthScale: 0.94, barGapScale: 0.96 } },
    { label: 'Classic', patch: { reactivity: 1.03, barHeightScale: 1.0, barWidthScale: 1.0, glowIntensity: 0.72 } },
  ],
  'semi-arc': [
    { label: 'Bounce', patch: { reactivity: 1.14, barHeightScale: 1.08, pulseIntensity: 1.1, beatSensitivity: 1.08 } },
    { label: 'Wide Base', patch: { reactivity: 1.08, barHeightScale: 1.03, barWidthScale: 1.08, barRoundness: 0.5 } },
    { label: 'Ambient', patch: { reactivity: 0.96, barHeightScale: 0.94, energySmoothing: 0.8, glowIntensity: 0.64 } },
  ],
  'dual-mirrored': [
    { label: 'Split Punch', patch: { reactivity: 1.24, barHeightScale: 1.14, barWidthScale: 0.9, glowIntensity: 0.82 } },
    { label: 'Stereo Wide', patch: { reactivity: 1.16, stereoSpread: 0.58, barHeightScale: 1.08, barGapScale: 0.92 } },
    { label: 'Velvet', patch: { reactivity: 1.0, energySmoothing: 0.78, glowIntensity: 0.62, barOpacityMin: 0.32 } },
  ],
  'cover-art': [
    { label: 'Frame Punch', patch: { reactivity: 1.2, barHeightScale: 1.12, glowIntensity: 0.82, artBorderRadius: 14 } },
    { label: 'Cinema', patch: { reactivity: 1.05, barHeightScale: 1.0, glowIntensity: 0.75, artBorderRadius: 24 } },
    { label: 'Minimal', patch: { reactivity: 0.95, barHeightScale: 0.9, glowIntensity: 0.58 } },
  ],
  'stacked-pillars': [
    { label: 'Industrial', patch: { reactivity: 1.14, barHeightScale: 1.08, barWidthScale: 1.02, glowIntensity: 0.76 } },
    { label: 'Towering', patch: { reactivity: 1.1, barHeightScale: 1.12, barWidthScale: 0.97, energySmoothing: 0.68 } },
    { label: 'Pulse Stack', patch: { reactivity: 1.12, transientBoost: 1.2, beatSensitivity: 1.08, glowSpread: 1.02 } },
  ],
  'horizon-tower': [
    { label: 'Skyline', patch: { reactivity: 1.16, barHeightScale: 1.1, barWidthScale: 0.95, glowIntensity: 0.8 } },
    { label: 'Depth Boost', patch: { reactivity: 1.22, spectralTilt: -0.14, stereoSpread: 0.52, barGapScale: 0.86 } },
    { label: 'Night Drive', patch: { reactivity: 1.05, energySmoothing: 0.76, glowIntensity: 0.7, trailStrength: 0.38 } },
  ],
  'pulse-frame': [
    { label: 'Rave Ring', patch: { reactivity: 1.14, pulseIntensity: 1.12, glowSpread: 1.06, beatSensitivity: 1.1 } },
    { label: 'Crystal', patch: { reactivity: 1.1, pulseIntensity: 1.06, glowSpread: 1.0, vinylSpinSpeed: 1.12 } },
    { label: 'Soft Pulse', patch: { reactivity: 1.0, pulseIntensity: 0.94, glowSpread: 0.86, energySmoothing: 0.8 } },
  ],
  'spectral-ribbon': [
    { label: 'Liquid', patch: { reactivity: 1.2, trailStrength: 0.4, energySmoothing: 0.72, glowSpread: 1.08 } },
    { label: 'Sharp', patch: { reactivity: 1.26, energySmoothing: 0.58, transientBoost: 1.25, spectralTilt: 0.16 } },
    { label: 'Dream', patch: { reactivity: 1.05, trailStrength: 0.5, energySmoothing: 0.82, glowSpread: 0.9 } },
  ],
  'saturn-ring': [
    { label: 'Orbital Pulse', patch: { reactivity: 1.14, pulseIntensity: 1.1, beatSensitivity: 1.08, glowSpread: 1.02, barHeightScale: 1.04 } },
    { label: 'Balanced Ring', patch: { reactivity: 1.06, pulseIntensity: 1.0, beatSensitivity: 1.0, glowSpread: 0.96, energySmoothing: 0.74 } },
    { label: 'Ambient Planet', patch: { reactivity: 0.98, pulseIntensity: 0.92, beatSensitivity: 0.92, glowSpread: 0.88, trailStrength: 0.34 } },
  ],
  'kaleido-orbit': [
    { label: 'Reactive', patch: { reactivity: 1.18, pulseIntensity: 1.12, beatSensitivity: 1.14, transientBoost: 1.2, glowSpread: 1.06 } },
    { label: 'Balanced', patch: { reactivity: 1.1, pulseIntensity: 1.04, beatSensitivity: 1.06, transientBoost: 1.12, glowSpread: 1.0 } },
    { label: 'Ambient Orbit', patch: { reactivity: 1.02, pulseIntensity: 0.96, beatSensitivity: 0.94, transientBoost: 1.0, energySmoothing: 0.8 } },
  ],
  'diagonal-drift': [
    { label: 'Reference', patch: { reactivity: 1.12, energySmoothing: 0.7, barHeightScale: 1.0, barWidthScale: 1.0, trailStrength: 0.22 } },
    { label: 'Punch', patch: { reactivity: 1.24, energySmoothing: 0.62, barHeightScale: 1.12, glowIntensity: 0.82, trailStrength: 0.2 } },
    { label: 'Cinematic', patch: { reactivity: 1.02, energySmoothing: 0.8, barHeightScale: 0.92, glowIntensity: 0.68, trailStrength: 0.3 } },
  ],
};

export default function VisualizerSettings({ settings, onChange, onClose }) {
  const normalizedStyle = normalizeVisualizerStyle(settings.style);
  const stylePresets = STYLE_PRESETS[normalizedStyle] || [];
  const previousSettingsRef = useRef(null);
  const canUndoPreset = Boolean(previousSettingsRef.current);

  const applyPreset = (patch) => {
    previousSettingsRef.current = { ...settings };
    onChange(patch);
  };

  const undoPreset = () => {
    if (!previousSettingsRef.current) return;
    onChange(previousSettingsRef.current);
    previousSettingsRef.current = null;
  };

  const onFileChange = (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ backgroundMode: 'custom', backgroundImage: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white uppercase">Visualizer Settings</h3>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 mt-1">
            Style, background, and reactivity
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Wand2 size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Visualizer Style</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {VISUALIZER_STYLE_OPTIONS.map((styleOption) => (
            <button
              key={styleOption.id}
              onClick={() => onChange({ style: styleOption.id })}
              className={groupButton(normalizedStyle === styleOption.id)}
            >
              {styleOption.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/45 font-mono uppercase tracking-[0.16em]">
          {STYLE_HINTS[normalizedStyle]}
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Zap size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Style Presets</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stylePresets.map((preset) => (
            <button
              key={`${normalizedStyle}-${preset.label}`}
              onClick={() => applyPreset(preset.patch)}
              className="px-2 py-2 rounded-lg border border-white/12 bg-black/45 text-[9px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/10 hover:text-white transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button
          onClick={undoPreset}
          disabled={!canUndoPreset}
          className={`w-full px-2 py-2 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all ${
            canUndoPreset
              ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
              : 'border-white/10 bg-black/35 text-white/35 cursor-not-allowed'
          }`}
        >
          Undo Last Preset
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Upload size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Background</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onChange({ backgroundMode: 'default', backgroundImage: null })}
            className={groupButton(settings.backgroundMode === 'default')}
          >
            Default Galaxy
          </button>
          <button
            onClick={() => onChange({ backgroundMode: 'solid' })}
            className={groupButton(settings.backgroundMode === 'solid')}
          >
            Solid Dark
          </button>
          <label className={groupButton(settings.backgroundMode === 'custom')}>
            Upload Custom
            <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Sparkles size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Effects</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleButton
            label="Mirror Reflection"
            value={settings.mirrorEffect !== false}
            onChange={(v) => onChange({ mirrorEffect: v })}
          />
          <ToggleButton
            label="Show Album Art"
            value={settings.showAlbumArt !== false}
            onChange={(v) => onChange({ showAlbumArt: v })}
          />
          <ToggleButton
            label="Show Particles"
            value={settings.showParticles !== false}
            onChange={(v) => onChange({ showParticles: v })}
          />
          <ToggleButton
            label="Show Vignette"
            value={settings.showVignette !== false}
            onChange={(v) => onChange({ showVignette: v })}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Palette size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Color Theme</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onChange({ colorPreset: preset.id, primaryColor: preset.primary, secondaryColor: preset.secondary })}
              className={`flex items-center justify-center gap-2 px-2 py-2 rounded-lg border text-[9px] font-bold uppercase tracking-wide transition-all ${
                settings.colorPreset === preset.id
                  ? 'border-white/40 bg-white/10'
                  : 'border-white/10 bg-black/40 hover:bg-white/5'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }}
              />
              <span className="text-white/70">{preset.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Disc size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Vinyl &amp; Art</span>
        </div>
        <SliderField label="Vinyl Size" min={0.5} max={1.5} step={0.05} value={settings.vinylScale ?? 1} onChange={(v) => onChange({ vinylScale: v })} unit="x" />
        <SliderField label="Vinyl Spin Speed" min={0} max={3} step={0.1} value={settings.vinylSpinSpeed ?? 1} onChange={(v) => onChange({ vinylSpinSpeed: v })} unit="x" />
        <SliderField label="Art Border Radius" min={0} max={50} step={1} value={settings.artBorderRadius ?? 18} onChange={(v) => onChange({ artBorderRadius: v })} unit="%" />
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Zap size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Animation</span>
        </div>
        <SliderField label="Particle Density" min={40} max={200} step={10} value={settings.particleCount ?? 140} onChange={(v) => onChange({ particleCount: v })} />
        <SliderField label="Particle Speed" min={0.2} max={2} step={0.1} value={settings.particleSpeed ?? 1} onChange={(v) => onChange({ particleSpeed: v })} unit="x" />
        <SliderField label="Reflection Opacity" min={0.1} max={0.5} step={0.02} value={settings.reflectionOpacity ?? 0.28} onChange={(v) => onChange({ reflectionOpacity: v })} />
        <SliderField label="Bass Boost" min={0.5} max={2.5} step={0.1} value={settings.bassBoost ?? 1} onChange={(v) => onChange({ bassBoost: v })} unit="x" />
        <SliderField label="Treble Sensitivity" min={0.5} max={2} step={0.1} value={settings.trebleSensitivity ?? 1} onChange={(v) => onChange({ trebleSensitivity: v })} unit="x" />
        <SliderField label="Mid Sensitivity" min={0.5} max={2} step={0.1} value={settings.midSensitivity ?? 1} onChange={(v) => onChange({ midSensitivity: v })} unit="x" />
        <SliderField label="Pulse Intensity" min={0.5} max={2} step={0.1} value={settings.pulseIntensity ?? 1} onChange={(v) => onChange({ pulseIntensity: v })} unit="x" />
        <SliderField label="Glow Spread" min={0.5} max={2} step={0.1} value={settings.glowSpread ?? 1} onChange={(v) => onChange({ glowSpread: v })} unit="x" />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Pipette size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Color Extraction</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleButton
            label="Auto Extract From Thumbnail"
            value={settings.autoExtractColor === true}
            onChange={(v) => onChange({ autoExtractColor: v })}
          />
        </div>
        <p className="text-[9px] text-white/40 font-mono">
          Automatically extract accent colors from the current track&apos;s thumbnail
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white">
          <SlidersHorizontal size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Audio Analysis</span>
        </div>
        <SliderField label="FFT Size" min={512} max={8192} step={512} value={settings.fftSize ?? 2048} onChange={(v) => onChange({ fftSize: v })} />
        <SliderField label="Smoothing" min={0.2} max={0.95} step={0.01} value={settings.smoothing ?? 0.75} onChange={(v) => onChange({ smoothing: v })} />
        <SliderField label="Reactivity" min={0.6} max={2.6} step={0.05} value={settings.reactivity ?? 1} onChange={(v) => onChange({ reactivity: v })} />
        <SliderField label="Bar Count" min={24} max={256} step={1} value={settings.barCount ?? 96} onChange={(v) => onChange({ barCount: v })} />
        <SliderField label="Energy Smoothing" min={0.2} max={0.95} step={0.01} value={settings.energySmoothing ?? 0.68} onChange={(v) => onChange({ energySmoothing: v })} />
        <SliderField label="Transient Boost" min={0.6} max={2.2} step={0.05} value={settings.transientBoost ?? 1.15} onChange={(v) => onChange({ transientBoost: v })} unit="x" />
        <SliderField label="Beat Sensitivity" min={0.6} max={2.2} step={0.05} value={settings.beatSensitivity ?? 1} onChange={(v) => onChange({ beatSensitivity: v })} unit="x" />
        <SliderField label="Stereo Spread" min={0} max={1} step={0.05} value={settings.stereoSpread ?? 0.3} onChange={(v) => onChange({ stereoSpread: v })} />
        <SliderField label="Trail Strength" min={0} max={0.9} step={0.05} value={settings.trailStrength ?? 0.3} onChange={(v) => onChange({ trailStrength: v })} />
        <SliderField label="Spectral Tilt" min={-1} max={1} step={0.05} value={settings.spectralTilt ?? 0} onChange={(v) => onChange({ spectralTilt: v })} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Layers size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Bar Appearance</span>
        </div>
        <SliderField label="Glow Intensity" min={0} max={2} step={0.05} value={settings.glowIntensity ?? 0.7} onChange={(v) => onChange({ glowIntensity: v })} />
        <SliderField label="Bar Width" min={0.5} max={2.5} step={0.05} value={settings.barWidthScale ?? 1} onChange={(v) => onChange({ barWidthScale: v })} unit="x" />
        <SliderField label="Bar Gap" min={0.3} max={2} step={0.05} value={settings.barGapScale ?? 1} onChange={(v) => onChange({ barGapScale: v })} unit="x" />
        <SliderField label="Bar Roundness" min={0} max={1} step={0.05} value={settings.barRoundness ?? 0.45} onChange={(v) => onChange({ barRoundness: v })} />
        <SliderField label="Bar Height" min={0.5} max={3} step={0.05} value={settings.barHeightScale ?? 1} onChange={(v) => onChange({ barHeightScale: v })} unit="x" />
        <SliderField label="Bar Opacity Min" min={0.2} max={0.8} step={0.05} value={settings.barOpacityMin ?? 0.4} onChange={(v) => onChange({ barOpacityMin: v })} />
        <SliderField label="Bar Opacity Max" min={0.7} max={1} step={0.02} value={settings.barOpacityMax ?? 0.95} onChange={(v) => onChange({ barOpacityMax: v })} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Wand2 size={14} />
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono">Mini Player Visualizer</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {MINI_VISUALIZER_STYLES.map((styleOption) => (
            <button
              key={styleOption.id}
              onClick={() => onChange({ miniVisualizerStyle: styleOption.id })}
              className={groupButton((settings.miniVisualizerStyle || 'bars') === styleOption.id)}
            >
              {styleOption.label}
            </button>
          ))}
        </div>
        <SliderField label="Mini Sensitivity" min={0.5} max={2} step={0.05} value={settings.miniVisualizerSensitivity ?? 1} onChange={(v) => onChange({ miniVisualizerSensitivity: v })} unit="x" />
        <SliderField label="Mini Bar Count" min={12} max={56} step={1} value={settings.miniVisualizerBarCount ?? 28} onChange={(v) => onChange({ miniVisualizerBarCount: v })} />
        <SliderField label="Mini Glow" min={0} max={2} step={0.05} value={settings.miniVisualizerGlow ?? 0.7} onChange={(v) => onChange({ miniVisualizerGlow: v })} unit="x" />
        <ToggleButton
          label="Mini Mirror"
          value={settings.miniVisualizerMirror !== false}
          onChange={(v) => onChange({ miniVisualizerMirror: v })}
        />
      </section>
    </div>
  );
}
