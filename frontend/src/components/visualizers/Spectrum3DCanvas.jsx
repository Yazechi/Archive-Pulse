import { useEffect, useMemo, useRef } from 'react';

const QUALITY_PRESETS = {
  low: { bars: 84, maxFps: 28, dpr: 1, smoothing: 0.22 },
  medium: { bars: 120, maxFps: 40, dpr: 1.4, smoothing: 0.19 },
  high: { bars: 168, maxFps: 54, dpr: 2, smoothing: 0.16 },
};

const PALETTES = {
  aurora: { baseHue: 316, spread: 28, accentHue: 198 },
  sunset: { baseHue: 12, spread: 20, accentHue: 42 },
  ocean: { baseHue: 202, spread: 18, accentHue: 168 },
  ember: { baseHue: 6, spread: 16, accentHue: 32 },
  neon: { baseHue: 286, spread: 42, accentHue: 174 },
  forest: { baseHue: 116, spread: 18, accentHue: 78 },
  synth: { baseHue: 330, spread: 24, accentHue: 268 },
  gold: { baseHue: 48, spread: 14, accentHue: 24 },
  mono: { baseHue: 212, spread: 6, accentHue: 212 },
  custom: { baseHue: 320, spread: 24, accentHue: 190 },
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const hexToHue = (hex, fallback) => {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return fallback;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return fallback;
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6; break;
  }
  return Math.round(h * 360);
};

export default function Spectrum3DCanvas({ analyser, isPlaying, compact = false, settings, accentColor }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const safeSettings = useMemo(() => ({
    stylePreset: settings?.stylePreset || 'balanced',
    qualityMode: settings?.qualityMode || 'auto',
    intensity: clamp(settings?.intensity ?? 1, 0.3, 2),
    motion: clamp(settings?.motion ?? 1, 0.3, 2),
    motionProfile: settings?.motionProfile || 'steady',
    palette: settings?.palette || 'aurora',
    accentMode: settings?.accentMode || 'auto',
    accentBehavior: settings?.accentBehavior || 'single',
    customBaseColor: settings?.customBaseColor || '#ff4fd8',
    customAccentColor: settings?.customAccentColor || '#44d7ff',
    density: clamp(settings?.density ?? 1, 0.55, 1.8),
    depth: clamp(settings?.depth ?? 1, 0.5, 1.8),
    smoothing: clamp(settings?.smoothing ?? 1, 0.2, 1.8),
    transientSensitivity: clamp(settings?.transientSensitivity ?? 1, 0.4, 2),
    noiseFloor: clamp(settings?.noiseFloor ?? 0.08, 0, 0.4),
    bassFocus: clamp(settings?.bassFocus ?? 1, 0.4, 2),
    midFocus: clamp(settings?.midFocus ?? 1, 0.4, 2),
    trebleFocus: clamp(settings?.trebleFocus ?? 1, 0.4, 2),
    bloom: clamp(settings?.bloom ?? 1, 0.2, 2),
    ambientGlow: clamp(settings?.ambientGlow ?? 1, 0, 2),
    barGlow: clamp(settings?.barGlow ?? 1, 0, 2),
    rimGlow: clamp(settings?.rimGlow ?? 1, 0, 2),
    shadowStrength: clamp(settings?.shadowStrength ?? 1, 0, 2),
    style: settings?.style || 'circle',
    barShape: settings?.barShape || 'square',
    radius: clamp(settings?.radius ?? 1, 0.75, 1.35),
    scale: clamp(settings?.scale ?? 1, 0.75, 1.35),
    verticalOffset: clamp(settings?.verticalOffset ?? 0, -0.35, 0.35),
    revealAmount: clamp(settings?.revealAmount ?? 0.32, 0, 0.7),
    coverMode: settings?.coverMode || 'reveal',
    backgroundFx: settings?.backgroundFx || 'gradient',
    vignette: clamp(settings?.vignette ?? 1, 0, 2),
    grain: clamp(settings?.grain ?? 0, 0, 1),
    lightRays: clamp(settings?.lightRays ?? 0.35, 0, 1.5),
    fog: clamp(settings?.fog ?? 0.25, 0, 1.5),
    gradientDrift: clamp(settings?.gradientDrift ?? 0.35, 0, 1.5),
    beatFx: settings?.beatFx || 'cover-pulse',
    coverPulse: clamp(settings?.coverPulse ?? 0.25, 0, 1),
    rimPulse: clamp(settings?.rimPulse ?? 0.35, 0, 1),
    flashOnKick: clamp(settings?.flashOnKick ?? 0.2, 0, 1),
    sparkBurst: clamp(settings?.sparkBurst ?? 0.15, 0, 1),
    saturation: clamp(settings?.saturation ?? 1, 0.4, 1.8),
    brightness: clamp(settings?.brightness ?? 1, 0.5, 1.5),
    contrast: clamp(settings?.contrast ?? 1, 0.6, 1.6),
    temperature: clamp(settings?.temperature ?? 0, -1, 1),
  }), [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const freqBins = analyser?.frequencyBinCount || 512;
    const freqData = new Uint8Array(freqBins);
    const barsPool = new Float32Array(320);
    let quality = safeSettings.qualityMode === 'auto' ? 'medium' : safeSettings.qualityMode;
    let viewportVisible = true;
    let tabVisible = !document.hidden;
    let pulse = 0;
    let drift = 0;
    let frameCount = 0;
    let fpsAccum = 0;
    let fpsWindowStart = performance.now();
    let lastTs = 0;

    const observer = new IntersectionObserver((entries) => {
      viewportVisible = !!entries[0]?.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(canvas);

    const onVisibility = () => {
      tabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const getPreset = () => QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;

    const resize = () => {
      const preset = getPreset();
      const dpr = Math.min(window.devicePixelRatio || 1, preset.dpr);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    resize();
    const resizeObs = new ResizeObserver(resize);
    resizeObs.observe(canvas);

    const selectAutoQuality = (fps) => {
      if (safeSettings.qualityMode !== 'auto') return;
      quality = fps > 47 ? 'high' : fps > 34 ? 'medium' : 'low';
    };

    const getMotionMul = () => {
      if (safeSettings.motionProfile === 'snappy') return 1.7;
      if (safeSettings.motionProfile === 'elastic') return 1.35;
      if (safeSettings.motionProfile === 'floaty') return 0.7;
      if (safeSettings.motionProfile === 'cinematic') return 0.9;
      return 1;
    };

    const getPresetMul = () => {
      if (safeSettings.stylePreset === 'club') return { intensity: 1.2, glow: 1.2 };
      if (safeSettings.stylePreset === 'soft') return { intensity: 0.82, glow: 0.9 };
      if (safeSettings.stylePreset === 'crisp') return { intensity: 1.05, glow: 0.8 };
      if (safeSettings.stylePreset === 'cinematic') return { intensity: 0.94, glow: 1.25 };
      return { intensity: 1, glow: 1 };
    };

    const withTemp = (hue) => hue + safeSettings.temperature * 24;
    const applyBehavior = (baseHue, accentHue, t) => {
      if (safeSettings.accentBehavior === 'two-tone') return t < 0.5 ? baseHue : accentHue;
      if (safeSettings.accentBehavior === 'triadic') return baseHue + (t < 0.33 ? 0 : t < 0.66 ? 120 : 240);
      if (safeSettings.accentBehavior === 'analogous') return baseHue + (t - 0.5) * 44;
      if (safeSettings.accentBehavior === 'complementary') return baseHue + (t < 0.5 ? 0 : 180);
      if (safeSettings.accentBehavior === 'split') return accentHue + (t < 0.5 ? -28 : 28);
      return baseHue + (accentHue - baseHue) * t;
    };

    const drawLine = (x1, y1, x2, y2, width, color, glow, cap) => {
      ctx.lineCap = cap;
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.shadowBlur = glow;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const draw = (ts) => {
      rafRef.current = requestAnimationFrame(draw);
      if (!viewportVisible || !tabVisible) return;

      const preset = getPreset();
      const frameMs = 1000 / preset.maxFps;
      if (ts - lastTs < frameMs) return;
      const dt = lastTs ? (ts - lastTs) : frameMs;
      lastTs = ts;
      frameCount += 1;
      fpsAccum += 1000 / Math.max(1, dt);
      if (ts - fpsWindowStart > 1800) {
        selectAutoQuality(fpsAccum / Math.max(1, frameCount));
        frameCount = 0;
        fpsAccum = 0;
        fpsWindowStart = ts;
      }

      if (analyser) analyser.getByteFrequencyData(freqData);

      const paletteSeed = PALETTES[safeSettings.palette] || PALETTES.aurora;
      const basePalette = safeSettings.palette === 'custom'
        ? {
            baseHue: hexToHue(safeSettings.customBaseColor, 320),
            accentHue: hexToHue(safeSettings.customAccentColor, 190),
            spread: 28,
          }
        : paletteSeed;
      const accentBase = accentColor?.hue ?? basePalette.baseHue;
      const accentDetail = accentColor?.accentHue ?? basePalette.accentHue;
      const isAccentAuto = safeSettings.accentMode === 'auto';
      const palette = isAccentAuto
        ? { baseHue: accentBase, accentHue: accentDetail, spread: 28 }
        : {
            baseHue: safeSettings.accentMode === 'blend' ? (basePalette.baseHue * 0.7 + accentBase * 0.3) : safeSettings.accentMode === 'complement' ? (basePalette.baseHue + 180) % 360 : basePalette.baseHue,
            accentHue: safeSettings.accentMode === 'palette' ? basePalette.accentHue : safeSettings.accentMode === 'blend' ? (basePalette.accentHue * 0.55 + accentDetail * 0.45) : safeSettings.accentMode === 'complement' ? (accentDetail + 180) % 360 : basePalette.accentHue,
            spread: safeSettings.accentMode === 'palette' ? basePalette.spread : safeSettings.accentMode === 'blend' ? basePalette.spread + 6 : Math.max(basePalette.spread, 18),
          };
      const glowHue = isAccentAuto ? accentDetail : safeSettings.accentMode === 'palette' ? basePalette.accentHue : safeSettings.accentMode === 'complement' ? (accentDetail + 180) % 360 : accentDetail;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2 + h * safeSettings.verticalOffset * 0.18;
      const min = Math.min(w, h);
      const style = safeSettings.style;
      const styleSemi = style === 'semi';
      const styleBars = style === 'bars';
      const styleMirrored = style === 'mirrored';
      const stylePulse = style === 'pulse-ring';
      const styleWave = style === 'wave-line';
      const styleStacked = style === 'stacked-bars';
      const styleHalo = style === 'halo';
      const vinylRadius = (compact ? min * 0.18 : min * 0.205) * safeSettings.radius * safeSettings.scale;
      const coverSize = vinylRadius * (compact ? 0.95 : 1.08);
      const baseSpectrumRadius = vinylRadius * (styleSemi || stylePulse ? 1.03 : styleHalo ? 1.42 : 1.02);
      const presetMul = getPresetMul();
      const maxBarLength = (compact ? min * 0.06 : min * 0.058) * safeSettings.intensity * presetMul.intensity;
      const motionMul = getMotionMul();
      const smoothingMul = safeSettings.motionProfile === 'snappy' ? 1.55 : safeSettings.motionProfile === 'elastic' ? 1.25 : safeSettings.motionProfile === 'floaty' ? 0.72 : 1;
      const smoothing = clamp(preset.smoothing * safeSettings.smoothing / smoothingMul, 0.05, 0.95);
      const barCount = Math.min(barsPool.length, Math.max(24, Math.floor(preset.bars * safeSettings.density)));

      let energy = 0;
      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor(((i / barCount) ** 1.48) * Math.min(420, freqBins - 1));
        const raw = (freqData[idx] || 0) / 255;
        const freqNorm = idx / Math.max(1, freqBins - 1);
        const focus = freqNorm < 0.18 ? safeSettings.bassFocus : freqNorm < 0.56 ? safeSettings.midFocus : safeSettings.trebleFocus;
        const filtered = Math.max(0, raw - safeSettings.noiseFloor) * focus * safeSettings.transientSensitivity;
        barsPool[i] += (filtered - barsPool[i]) * smoothing;
        energy += barsPool[i];
      }
      energy /= Math.max(1, barCount);
      pulse = pulse * 0.84 + energy * 0.16;
      drift += (0.00045 + energy * 0.0014) * safeSettings.motion * motionMul;

      const cap = safeSettings.barShape === 'rounded' || safeSettings.barShape === 'capsule' ? 'round' : 'butt';
      const baseWidth = safeSettings.barShape === 'needle' ? 1.4 : safeSettings.barShape === 'capsule' ? 3.8 : 3;
      const getWidth = (v) => safeSettings.barShape === 'tapered' ? baseWidth * (0.55 + v * 0.9) : baseWidth;
      const getGlow = (v) => (6 + v * 12) * safeSettings.bloom * safeSettings.barGlow * presetMul.glow;
      const getHue = (t) => withTemp(applyBehavior(palette.baseHue, palette.accentHue, t));
      const toColor = (hue, alpha) => `hsla(${hue}, ${Math.round(94 * safeSettings.saturation)}%, ${Math.round(66 * safeSettings.brightness)}%, ${alpha})`;

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createRadialGradient(cx, cy, min * 0.05, cx, cy, min * 0.82);
      bg.addColorStop(0, `hsla(${withTemp(glowHue)}, 92%, 62%, ${0.08 * safeSettings.ambientGlow})`);
      bg.addColorStop(0.45, `hsla(${withTemp(glowHue + 18)}, 92%, 58%, ${0.06 * safeSettings.ambientGlow})`);
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      if (safeSettings.backgroundFx === 'gradient') {
        const wash = ctx.createLinearGradient(0, 0, w, h);
        wash.addColorStop(0, `hsla(${withTemp(glowHue - 26)}, 90%, 56%, ${0.08 * safeSettings.gradientDrift})`);
        wash.addColorStop(1, `hsla(${withTemp(glowHue + 32)}, 90%, 52%, ${0.08 * safeSettings.gradientDrift})`);
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w, h);
      }
      if (safeSettings.backgroundFx === 'rays' || safeSettings.lightRays > 0) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(drift * safeSettings.gradientDrift);
        for (let i = 0; i < 10; i++) {
          ctx.rotate(Math.PI / 5);
          ctx.fillStyle = `hsla(${withTemp(glowHue + i * 7)}, 100%, 70%, ${0.028 * safeSettings.lightRays})`;
          ctx.fillRect(vinylRadius * 0.12, -6, vinylRadius * 2.1, 12);
        }
        ctx.restore();
      }
      if (safeSettings.backgroundFx === 'fog' || safeSettings.fog > 0) {
        const fog = ctx.createRadialGradient(cx, cy, vinylRadius * 0.6, cx, cy, min * 0.8);
        fog.addColorStop(0, `rgba(255,255,255,${0.035 * safeSettings.fog})`);
        fog.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, 0, w, h);
      }
      if (safeSettings.vignette > 0) {
        const vignette = ctx.createRadialGradient(cx, cy, min * 0.25, cx, cy, min * 0.8);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, `rgba(0,0,0,${0.22 * safeSettings.vignette})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
      }

      const rimPulse = safeSettings.beatFx === 'rim-pulse' ? pulse * vinylRadius * 0.16 * safeSettings.rimPulse : 0;

      if (styleBars || styleStacked) {
        const halfBars = Math.max(12, Math.floor(barCount / 2));
        const halfWidth = min * 0.4;
        const baseline = cy + vinylRadius * 0.96;
        const gap = 2;
        const bw = Math.max(2, (halfWidth - gap * (halfBars - 1)) / Math.max(1, halfBars));
        for (let i = 0; i < halfBars; i++) {
          const t = i / Math.max(1, halfBars - 1);
          const v = barsPool[i] * safeSettings.intensity;
          const len = 8 + clamp(v, 0, 2) * maxBarLength * (styleStacked ? 2.1 : 1.8);
          const hue = getHue(t);
          const offset = i * (bw + gap) + bw * 0.5;
          drawLine(cx - offset, baseline, cx - offset, baseline - len, getWidth(v), toColor(hue, 0.44 + v * 0.5), getGlow(v), cap);
          drawLine(cx + offset, baseline, cx + offset, baseline - len, getWidth(v), toColor(hue, 0.44 + v * 0.5), getGlow(v), cap);
          if (styleStacked) {
            const innerOffset = Math.max(2, bw * 0.42);
            drawLine(cx - offset - innerOffset, baseline - len * 0.36, cx - offset - innerOffset, baseline - len * 0.92, Math.max(1, getWidth(v) * 0.38), toColor(hue + 42, 0.52 + v * 0.32), getGlow(v) * 0.95, 'round');
            drawLine(cx + offset + innerOffset, baseline - len * 0.36, cx + offset + innerOffset, baseline - len * 0.92, Math.max(1, getWidth(v) * 0.38), toColor(hue + 42, 0.52 + v * 0.32), getGlow(v) * 0.95, 'round');
            drawLine(cx - offset, baseline - len * 0.18, cx - offset, baseline - len * 0.66, Math.max(1, getWidth(v) * 0.24), toColor(hue - 28, 0.62 + v * 0.2), getGlow(v) * 0.6, 'round');
            drawLine(cx + offset, baseline - len * 0.18, cx + offset, baseline - len * 0.66, Math.max(1, getWidth(v) * 0.24), toColor(hue - 28, 0.62 + v * 0.2), getGlow(v) * 0.6, 'round');
          }
        }
      } else if (styleMirrored) {
        const sideBars = Math.floor(barCount / 2);
        const gap = compact ? 3.5 : 4.2;
        const leftStart = cx - vinylRadius - min * 0.14;
        const rightStart = cx + vinylRadius + min * 0.14;
        for (let i = 0; i < sideBars; i++) {
          const t = i / Math.max(1, sideBars - 1);
          const v = barsPool[i] * safeSettings.intensity;
          const len = 16 + clamp(v, 0, 2) * maxBarLength * 1.15;
          const hue = getHue(1 - t * 0.8);
          const y = cy - sideBars * gap * 0.5 + i * gap;
          drawLine(leftStart, y, leftStart - len, y, getWidth(v), toColor(hue, 0.42 + v * 0.52), getGlow(v), cap);
          drawLine(rightStart, y, rightStart + len, y, getWidth(v), toColor(hue, 0.42 + v * 0.52), getGlow(v), cap);
        }
      } else if (styleWave) {
        const usableWidth = min * 0.88;
        const left = cx - usableWidth / 2;
        ctx.beginPath();
        for (let i = 0; i < barCount; i++) {
          const t = i / Math.max(1, barCount - 1);
          const x = left + usableWidth * t;
          const v = barsPool[i] * safeSettings.intensity;
          const y = cy + vinylRadius * 1.02 - (0.2 + v) * maxBarLength * 1.25;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = toColor(getHue(0.6), 0.94);
        ctx.lineWidth = 3.2;
        ctx.shadowBlur = 16 * safeSettings.barGlow;
        ctx.stroke();
      } else {
        const startAngle = -Math.PI / 2;
        const sweep = styleSemi ? Math.PI : Math.PI * 2;
        for (let i = 0; i < barCount; i++) {
          const t = i / Math.max(1, barCount - 1);
          const a = startAngle + sweep * t + (styleSemi ? 0 : drift);
          const v = barsPool[i] * safeSettings.intensity;
          const hue = getHue(t);
          const multiplier = styleSemi ? 1.7 : stylePulse ? 2.1 : styleHalo ? 1.35 : 1.15;
          const len = 4 + clamp(v, 0, 2) * maxBarLength * multiplier;
          const inner = baseSpectrumRadius + rimPulse + (!styleSemi ? Math.sin(a * 3 + drift * 3) * vinylRadius * (styleHalo ? 0.006 : 0.015) * safeSettings.motion : 0);
          const outer = inner + len;
          drawLine(
            cx + Math.cos(a) * inner,
            cy + Math.sin(a) * inner,
            cx + Math.cos(a) * outer,
            cy + Math.sin(a) * outer,
            getWidth(v),
            toColor(hue, 0.44 + v * 0.5),
            getGlow(v),
            cap
          );
          if (styleHalo) {
            const haloInner = inner - vinylRadius * 0.18;
            const haloOuter = haloInner + len * 0.42;
            drawLine(
              cx + Math.cos(a) * haloInner,
              cy + Math.sin(a) * haloInner,
              cx + Math.cos(a) * haloOuter,
              cy + Math.sin(a) * haloOuter,
              Math.max(1, getWidth(v) * 0.55),
              toColor(hue + 34, 0.28 + v * 0.28),
              getGlow(v) * 0.7,
              'round'
            );
          }
        }
        if (styleSemi) {
          ctx.strokeStyle = toColor(withTemp(glowHue), 0.22 * safeSettings.rimGlow);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cx, cy, vinylRadius * 1.01, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;

      if (!compact && !styleBars && !styleMirrored && !styleWave) {
        ctx.strokeStyle = toColor(withTemp(glowHue), 0.2 + pulse * 0.24 * safeSettings.rimGlow);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, vinylRadius * 1.03 + rimPulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      const centerGlow = ctx.createRadialGradient(cx, cy, vinylRadius * 0.12, cx, cy, vinylRadius * 0.8);
      centerGlow.addColorStop(0, `rgba(255,255,255,${0.06 + pulse * 0.08 * safeSettings.contrast})`);
      centerGlow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = centerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, vinylRadius * (0.82 + (safeSettings.beatFx === 'cover-pulse' ? pulse * 0.16 * safeSettings.coverPulse : 0)), 0, Math.PI * 2);
      ctx.fill();

      if ((safeSettings.beatFx === 'flash' || safeSettings.beatFx === 'cover-pulse') && safeSettings.flashOnKick > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, pulse - 0.18) * 0.75 * safeSettings.flashOnKick})`;
        ctx.fillRect(0, 0, w, h);
      }
      if (safeSettings.beatFx === 'spark' && safeSettings.sparkBurst > 0 && pulse > 0.2) {
        for (let i = 0; i < 14; i++) {
          const a = drift * 40 + i * (Math.PI * 2 / 14);
          const dist = vinylRadius * (1.1 + pulse * 0.6);
          ctx.fillStyle = toColor(getHue(i / 14), 0.32 * safeSettings.sparkBurst);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, 1.4 + pulse * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (safeSettings.grain > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.02 * safeSettings.grain})`;
        for (let i = 0; i < 60; i++) {
          ctx.fillRect((i * 37 + drift * 1000) % w, (i * 61 + drift * 700) % h, 1, 1);
        }
      }

      if (!compact && (styleBars || styleMirrored || styleWave || styleStacked)) {
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + pulse * 0.06})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - coverSize * 0.52, cy - coverSize * 0.52, coverSize * 1.04, coverSize * 1.04);
      }
    };

    draw(0);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObs.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [analyser, isPlaying, safeSettings, compact]);

  return <canvas ref={canvasRef} className="w-full h-full block" style={{ display: 'block' }} />;
}
