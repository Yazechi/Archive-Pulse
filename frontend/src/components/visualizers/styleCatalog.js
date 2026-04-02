export const VISUALIZER_STYLE_OPTIONS = [
  { id: 'bar', label: 'Bar' },
  { id: 'round-base', label: 'Round Base' },
  { id: 'semicircular', label: 'SemiCircular Vinyl Wrap' },
  { id: 'semi-arc', label: 'Semi Arc' },
  { id: 'dual-mirrored', label: 'Dual Mirrored' },
  { id: 'cover-art', label: 'Cover Art Side Bars' },
  { id: 'stacked-pillars', label: 'Stacked Pillars' },
  { id: 'horizon-tower', label: 'Horizon Tower' },
  { id: 'pulse-frame', label: 'Pulse Frame' },
  { id: 'spectral-ribbon', label: 'Spectral Ribbon' },
  { id: 'saturn-ring', label: 'Saturn Ring' },
  { id: 'kaleido-orbit', label: 'Kaleido Orbit' },
  { id: 'diagonal-drift', label: 'Diagonal Drift' },
];

export const VISUALIZER_STYLES = VISUALIZER_STYLE_OPTIONS.map((style) => style.id);

const LEGACY_STYLE_ALIASES = {
  BarSpectrum: 'bar',
  barSpectrum: 'bar',
  TrapNationsStyleSpectrum: 'round-base',
  trapNationsStyleSpectrum: 'round-base',
  SemiCircularBarSpectrum: 'semicircular',
  semiCircularBarSpectrum: 'semicircular',
  SemiArcBarSpectrum: 'semi-arc',
  semiArcBarSpectrum: 'semi-arc',
  DualMirroredLineSpectrum: 'dual-mirrored',
  dualMirroredLineSpectrum: 'dual-mirrored',
  CoverArtFluidWaveSpectrum: 'cover-art',
  coverArtFluidWaveSpectrum: 'cover-art',
  OrbitalRingPulse: 'stacked-pillars',
  orbitalRingPulse: 'stacked-pillars',
  SpiralGalaxyMesh: 'horizon-tower',
  spiralGalaxyMesh: 'horizon-tower',
  PrismPulseTunnel: 'pulse-frame',
  prismPulseTunnel: 'pulse-frame',
  bar: 'bar',
  trapnation: 'round-base',
  'neon-orbit': 'round-base',
  'round-base': 'round-base',
  semicircular: 'semicircular',
  'semi-arc': 'semi-arc',
  'dual-mirrored': 'dual-mirrored',
  'cover-art-wave': 'cover-art',
  'cover-art': 'cover-art',
  'orbital-ring': 'stacked-pillars',
  'spiral-galaxy': 'horizon-tower',
  'prism-tunnel': 'pulse-frame',
  'stacked-pillars': 'stacked-pillars',
  'horizon-tower': 'horizon-tower',
  'pulse-frame': 'pulse-frame',
  'spectral-ribbon': 'spectral-ribbon',
  'saturn-ring': 'saturn-ring',
  'kaleido-orbit': 'kaleido-orbit',
  'matrix-rain': 'diagonal-drift',
  'diagonal-drift': 'diagonal-drift',
};

export const normalizeVisualizerStyle = (style) => LEGACY_STYLE_ALIASES[style] || 'bar';

export const getVisualizerStyleLabel = (style) => (
  VISUALIZER_STYLE_OPTIONS.find((option) => option.id === normalizeVisualizerStyle(style))?.label || 'Bar'
);

