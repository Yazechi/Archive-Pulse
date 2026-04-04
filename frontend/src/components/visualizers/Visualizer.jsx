import { useEffect, useMemo, useRef } from 'react';
import { normalizeVisualizerStyle, VISUALIZER_STYLES } from './styleCatalog';

const clamp = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const toValidFftSize = (value) => {
  const normalized = clamp(value, 32, 32768, 2048);
  const exponent = Math.round(Math.log2(normalized));
  return 2 ** Math.min(15, Math.max(5, exponent));
};

const getFullThumb = (thumbnailUrl) => {
  if (!thumbnailUrl) return null;
  return thumbnailUrl.startsWith('http') ? thumbnailUrl : `http://127.0.0.1:5000${thumbnailUrl}`;
};

// Extract dominant color from image
const extractDominantColor = (image) => {
  if (!image || !image.complete || image.width === 0) return null;
  try {
    const canvas = document.createElement('canvas');
    const size = 50; // Sample at low resolution for performance
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(image, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    
    // Collect color samples, ignoring very dark/light pixels
    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    let vibrantR = 0, vibrantG = 0, vibrantB = 0, vibrantCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      
      // Skip very dark or very light pixels
      if (brightness > 30 && brightness < 225) {
        totalR += r;
        totalG += g;
        totalB += b;
        count++;
        
        // Track vibrant colors (high saturation)
        if (saturation > 50) {
          vibrantR += r;
          vibrantG += g;
          vibrantB += b;
          vibrantCount++;
        }
      }
    }
    
    // Prefer vibrant colors if available, otherwise use average
    let avgR, avgG, avgB;
    if (vibrantCount > count * 0.1) {
      avgR = Math.round(vibrantR / vibrantCount);
      avgG = Math.round(vibrantG / vibrantCount);
      avgB = Math.round(vibrantB / vibrantCount);
    } else if (count > 0) {
      avgR = Math.round(totalR / count);
      avgG = Math.round(totalG / count);
      avgB = Math.round(totalB / count);
    } else {
      return null;
    }
    
    // Convert to hex
    const toHex = (c) => c.toString(16).padStart(2, '0');
    const primary = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
    
    // Create secondary color (slightly shifted/darker)
    const secR = Math.max(0, Math.round(avgR * 0.75));
    const secG = Math.max(0, Math.round(avgG * 0.75));
    const secB = Math.max(0, Math.round(avgB * 0.75));
    const secondary = `#${toHex(secR)}${toHex(secG)}${toHex(secB)}`;
    
    return { primary, secondary };
  } catch (e) {
    return null;
  }
};

const hexToRgb = (hex, fallback = { r: 34, g: 211, b: 238 }) => {
  if (typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
};

const toRgba = (hex, alpha, fallback) => {
  const { r, g, b } = hexToRgb(hex, fallback);
  return `rgba(${r},${g},${b},${alpha})`;
};

const mixHex = (a, b, t, alpha = 1) => {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const p = Math.max(0, Math.min(1, t));
  const r = Math.round(c1.r + (c2.r - c1.r) * p);
  const g = Math.round(c1.g + (c2.g - c1.g) * p);
  const bOut = Math.round(c1.b + (c2.b - c1.b) * p);
  return `rgba(${r},${g},${bOut},${alpha})`;
};

// Frequency band definitions (Hz) matching musical elements:
// - Sub-Bass/Bass (20-250 Hz): Kick drum, bass guitar, deep synth
// - Low-Mid (250-500 Hz): Guitar body, piano lower register, male voice warmth
// - Midrange (500-2000 Hz): Vocals, lead instruments - human ear most sensitive
// - High-Mid/Presence (2000-4000 Hz): Snare snap, guitar attack, vocal clarity
// - Treble/Air (4000-20000 Hz): Cymbals, hi-hats, sibilance, shimmer
const FREQ_BANDS = {
  subBass: { min: 20, max: 60 },
  bass: { min: 60, max: 250 },
  lowMid: { min: 250, max: 500 },
  mid: { min: 500, max: 2000 },
  highMid: { min: 2000, max: 4000 },
  treble: { min: 4000, max: 12000 },
  air: { min: 12000, max: 20000 },
};

// Convert frequency (Hz) to FFT bin index
// sampleRate typically 44100 Hz, fftSize determines bin resolution
const freqToBin = (freq, fftSize, sampleRate = 44100) => {
  const binWidth = sampleRate / fftSize;
  return Math.round(freq / binWidth);
};

// Calculate energy in a specific frequency range (Hz)
const calcBandEnergyHz = (arr, minFreq, maxFreq, fftSize, sampleRate = 44100) => {
  const binCount = arr.length; // fftSize / 2
  const actualFftSize = binCount * 2;
  const startBin = Math.max(0, freqToBin(minFreq, actualFftSize, sampleRate));
  const endBin = Math.min(binCount - 1, freqToBin(maxFreq, actualFftSize, sampleRate));
  if (endBin <= startBin) return 0;
  let sum = 0;
  for (let i = startBin; i <= endBin; i += 1) sum += arr[i];
  return sum / (endBin - startBin + 1);
};

// Legacy ratio-based band energy (kept for compatibility, but uses improved weighting)
const calcBandEnergy = (arr, startRatio, endRatio) => {
  const start = Math.max(0, Math.floor(arr.length * startRatio));
  const end = Math.max(start + 1, Math.floor(arr.length * endRatio));
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += arr[i];
  return sum / (end - start);
};

// Logarithmic frequency sampling for visualizer bars
// Maps bars to frequency spectrum using log scale (matches human hearing)
const sampleBars = (arr, count) => {
  const result = [];
  const binCount = arr.length;
  
  // Frequency range to display (20 Hz to ~18 kHz for typical music)
  const minFreq = 20;
  const maxFreq = 18000;
  const sampleRate = 44100;
  const fftSize = binCount * 2;
  
  // Use logarithmic distribution for bar positions
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  
  for (let i = 0; i < count; i += 1) {
    // Calculate frequency range for this bar using log scale
    const t0 = i / count;
    const t1 = (i + 1) / count;
    const freqLow = Math.pow(10, logMin + (logMax - logMin) * t0);
    const freqHigh = Math.pow(10, logMin + (logMax - logMin) * t1);
    
    // Convert to bin indices
    const binLow = Math.max(0, Math.floor(freqToBin(freqLow, fftSize, sampleRate)));
    const binHigh = Math.min(binCount - 1, Math.ceil(freqToBin(freqHigh, fftSize, sampleRate)));
    
    // Average the bins in this frequency range
    let sum = 0;
    let binsCounted = 0;
    for (let j = binLow; j <= binHigh; j += 1) {
      sum += arr[j];
      binsCounted += 1;
    }
    const avg = binsCounted > 0 ? sum / binsCounted : 0;
    
    // Apply frequency-dependent boost to compensate for typical music spectrum
    // Bass tends to be louder, treble quieter - this balances the visual
    const freqMid = (freqLow + freqHigh) / 2;
    let freqBoost = 1.0;
    if (freqMid < 250) {
      // Bass: slight reduction (it's usually loud)
      freqBoost = 0.85;
    } else if (freqMid < 500) {
      // Low-mid: neutral
      freqBoost = 1.0;
    } else if (freqMid < 2000) {
      // Mid: slight boost for vocals/instruments
      freqBoost = 1.1;
    } else if (freqMid < 4000) {
      // High-mid (presence): boost for clarity
      freqBoost = 1.25;
    } else {
      // Treble: significant boost (usually quiet)
      freqBoost = 1.4 + (freqMid - 4000) / 16000 * 0.6;
    }
    
    // Apply power curve for visual appeal and frequency boost
    const boosted = Math.pow(avg / 255, 0.7) * 255 * freqBoost;
    result.push(Math.min(255, boosted));
  }
  return result;
};

const mirroredIndexSample = (bars, i, count) => {
  const center = (count - 1) / 2;
  const dist = Math.abs(i - center) / Math.max(1, center); // 0 center -> 1 edges
  const mirrored = bars[Math.floor(dist * (bars.length - 1))] ?? 0;
  const idxA = Math.floor((i / Math.max(1, count - 1)) * (bars.length - 1));
  const idxB = Math.floor(((count - 1 - i) / Math.max(1, count - 1)) * (bars.length - 1));
  const wing = ((bars[idxA] ?? mirrored) + (bars[idxB] ?? mirrored)) * 0.5;
  const edgeBlend = Math.pow(dist, 0.85) * 0.34;
  return mirrored * (1 - edgeBlend) + wing * edgeBlend;
};

const radialMirroredSample = (bars, i, count) => {
  const half = count / 2;
  const cyc = i % count;
  const dist = Math.min(cyc, count - cyc) / Math.max(1, half); // 0 top/bottom center -> 1 side arcs
  const mirrored = bars[Math.floor(dist * (bars.length - 1))] ?? 0;
  const idxA = Math.floor((cyc / Math.max(1, count - 1)) * (bars.length - 1));
  const idxB = Math.floor((((count - cyc) % count) / Math.max(1, count - 1)) * (bars.length - 1));
  const side = ((bars[idxA] ?? mirrored) + (bars[idxB] ?? mirrored)) * 0.5;
  const sideBlend = Math.pow(dist, 0.85) * 0.3;
  return mirrored * (1 - sideBlend) + side * sideBlend;
};

const centerBurstProfile = (i, count, floor = 0.22, sharpness = 1.8) => {
  const center = (count - 1) / 2;
  const dist = Math.abs(i - center) / Math.max(1, center);
  const burst = Math.pow(Math.max(0, 1 - dist), sharpness);
  return floor + (1 - floor) * burst;
};

const dualCenterBurstProfile = (i, count, floor = 0.24, sharpness = 1.7) => {
  const half = count / 2;
  const cyc = i % count;
  const dist = Math.min(cyc, Math.abs(cyc - half), count - cyc) / Math.max(1, half);
  const burst = Math.pow(Math.max(0, 1 - dist), sharpness);
  return floor + (1 - floor) * burst;
};

const roundRectPath = (ctx, x, y, w, h, r) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

const drawImageCover = (ctx, image, x, y, w, h) => {
  if (!image) return;
  const imgRatio = image.width / image.height;
  const boxRatio = w / h;
  let sx = 0, sy = 0, sw = image.width, sh = image.height;
  if (imgRatio > boxRatio) {
    sw = image.height * boxRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / boxRatio;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
};

const drawSquareArt = (ctx, image, x, y, size, radius = 18) => {
  ctx.save();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  if (image) {
    drawImageCover(ctx, image, x, y, size, size);
  } else {
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.stroke();
};

const drawVinyl = (ctx, x, y, radius, image, spin = 0, showThumb = true, scale = 1) => {
  const scaledRadius = radius * scale;
  ctx.save();
  ctx.translate(x, y);

  const outer = ctx.createRadialGradient(0, 0, scaledRadius * 0.1, 0, 0, scaledRadius);
  outer.addColorStop(0, '#181818');
  outer.addColorStop(0.55, '#0c0c0c');
  outer.addColorStop(1, '#000');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(0, 0, scaledRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 10; i += 1) {
    const r = scaledRadius * (0.22 + i * 0.07);
    ctx.lineWidth = i % 2 ? 1 : 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (showThumb && image) {
    ctx.rotate(spin);
    const labelRadius = scaledRadius * 0.34;
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    drawImageCover(ctx, image, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, scaledRadius * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Particle system for moving space particles
class ParticleSystem {
  constructor(count = 120) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.5 + Math.random() * 1.5,
        speedX: (Math.random() - 0.5) * 0.0003,
        speedY: (Math.random() - 0.5) * 0.0003,
        alpha: 0.2 + Math.random() * 0.5,
        twinkleSpeed: 0.002 + Math.random() * 0.004,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  update(speedMultiplier = 1) {
    for (const p of this.particles) {
      p.x += p.speedX * speedMultiplier;
      p.y += p.speedY * speedMultiplier;
      if (p.x < 0) p.x = 1;
      if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1;
      if (p.y > 1) p.y = 0;
    }
  }

  draw(ctx, width, height, tick, intensity = 1) {
    for (const p of this.particles) {
      const twinkle = 0.5 + 0.5 * Math.sin(tick * p.twinkleSpeed + p.twinkleOffset);
      const alpha = p.alpha * twinkle * intensity;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const particleSystem = new ParticleSystem(140);

const drawBackground = (ctx, width, height, settings, customImage, tick, energy = 0, particleSpeed = 1) => {
  const primaryColor = settings.primaryColor || '#22d3ee';
  const secondaryColor = settings.secondaryColor || '#06b6d4';
  const glowSpread = clamp(settings.glowSpread, 0.5, 2, 1);

  if (settings.backgroundMode === 'custom' && customImage) {
    ctx.globalAlpha = 0.34;
    drawImageCover(ctx, customImage, 0, 0, width, height);
    ctx.globalAlpha = 1;
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#030712');
    gradient.addColorStop(0.4, '#111827');
    gradient.addColorStop(0.75, '#1e1b4b');
    gradient.addColorStop(1, '#020617');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const drift = tick * 0.0018;
    const cx = width * (0.5 + Math.sin(drift * 0.8) * 0.1);
    const cy = height * (0.45 + Math.cos(drift * 0.65) * 0.08);
    const wash = ctx.createRadialGradient(cx, cy, width * 0.05, cx, cy, Math.max(width, height) * 0.8);
    wash.addColorStop(0, toRgba(primaryColor, 0.1 * glowSpread));
    wash.addColorStop(0.48, toRgba(secondaryColor, 0.07 * glowSpread));
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
  }

  if (settings.showParticles !== false) {
    particleSystem.update(particleSpeed);
    particleSystem.draw(ctx, width, height, tick, 0.7 + energy * 0.003);
  }

  if (settings.backgroundMode === 'solid') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
  }

  if (settings.showVignette !== false) {
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.25,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
};

const drawRoundedBar = (ctx, x, y, w, h, radius, fillStyle) => {
  ctx.fillStyle = fillStyle;
  const safeRadius = Math.min(radius, w / 2, h / 2, 8);
  if (safeRadius < 0.75 || w < 6 || h < 6) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  roundRectPath(ctx, x, y, w, h, safeRadius);
  ctx.fill();
};

// Universal reflection drawer
const drawReflectionBars = (ctx, barData, payload) => {
  const { glowIntensity, tick, barRoundness, reflectionOpacity = 0.28 } = payload;
  
  for (const bar of barData) {
    const { x, y, w, h, colorA, colorB, amp } = bar;
    const ripple = Math.sin(x * 0.01 + tick * 0.025) * 1.5;
    const fadeAlpha = Math.max(0.05, reflectionOpacity - (amp * 0.15));
    const grad = ctx.createLinearGradient(x, y + ripple, x, y + ripple + h * 0.4);
    grad.addColorStop(0, colorA.replace(/[\d.]+\)$/, `${fadeAlpha})`));
    grad.addColorStop(1, colorB.replace(/[\d.]+\)$/, '0.02)'));
    ctx.shadowBlur = 3 * glowIntensity;
    ctx.shadowColor = colorA.replace(/[\d.]+\)$/, '0.2)');
    drawRoundedBar(ctx, x, y + ripple, w, h * 0.4, w * barRoundness, grad);
  }
  ctx.shadowBlur = 0;
};

// ==================== STYLE: BAR ====================
// Classic bottom bars - modern NCS/EDM style with glow and mirrored symmetry
const drawBar = (ctx, payload) => {
  const {
    bars, width, height, glowIntensity, mirrorEffect,
    barWidthScale, barGapScale, barRoundness, barHeightScale,
    barOpacityMin, barOpacityMax, primaryColor, secondaryColor, bloomStrength,
    beatPulse, tick,
  } = payload;

  const pulse = 1 + (beatPulse || 0) * 0.15;
  
  // Mirror bars for symmetry (signature EDM visualizer look)
  const halfCount = Math.min(48, Math.floor(bars.length / 2));
  const count = halfCount * 2;
  
  const bottom = height * 0.75;
  const xStart = width * 0.03;
  const xEnd = width * 0.97;
  const available = xEnd - xStart;
  const baseGap = 2.5 * barGapScale;
  const perBar = available / count;
  const w = Math.max(3, (perBar - baseGap) * barWidthScale);
  const gap = Math.max(1.5, perBar - w);
  const totalW = w * count + gap * (count - 1);
  const leftPad = xStart + (available - totalW) / 2;
  const maxHeight = height * 0.55 * barHeightScale * pulse;

  const barData = [];
  for (let i = 0; i < count; i += 1) {
    // Mirror: left half shows same data as right half
    const mirrorIdx = i < halfCount ? halfCount - 1 - i : i - halfCount;
    const amp = (bars[mirrorIdx] || 0) / 255;
    const reactive = Math.pow(amp, 0.75);
    
    const h = Math.max(4, reactive * maxHeight);
    const x = leftPad + i * (w + gap);
    const y = Math.max(4, bottom - h);
    const visibleH = Math.min(h, bottom - y);
    
    const alpha = barOpacityMin + reactive * (barOpacityMax - barOpacityMin);
    
    // Modern gradient: bright tip fading to base color
    const grad = ctx.createLinearGradient(x, y, x, y + visibleH);
    grad.addColorStop(0, toRgba('#ffffff', Math.min(1, alpha + 0.15)));
    grad.addColorStop(0.15, toRgba(primaryColor, alpha));
    grad.addColorStop(0.7, toRgba(primaryColor, alpha * 0.9));
    grad.addColorStop(1, toRgba(secondaryColor, alpha * 0.5));
    
    ctx.save();
    ctx.shadowBlur = (8 + reactive * 22) * glowIntensity * (0.7 + bloomStrength * 0.5);
    ctx.shadowColor = toRgba(primaryColor, 0.7 + reactive * 0.25);
    drawRoundedBar(ctx, x, y, w, visibleH, w * barRoundness, grad);
    ctx.restore();
    
    barData.push({ x, y: bottom + 8, w, h: visibleH, colorA: toRgba(primaryColor, alpha), colorB: toRgba(secondaryColor, alpha * 0.5), amp: reactive });
  }
  ctx.shadowBlur = 0;

  // Draw subtle baseline
  ctx.save();
  ctx.strokeStyle = toRgba(primaryColor, 0.15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xStart, bottom + 2);
  ctx.lineTo(xEnd, bottom + 2);
  ctx.stroke();
  ctx.restore();

  if (mirrorEffect) {
    drawReflectionBars(ctx, barData, payload);
  }
};

// ==================== STYLE: COVER ART SIDE BARS ====================
// Vinyl on left, horizontal bars on right - blue/indigo gradient
const drawCoverArtBars = (ctx, payload) => {
  const {
    width, height, bars, glowIntensity, thumb, mirrorEffect,
    barWidthScale, barGapScale, barRoundness, barHeightScale, tick,
    vinylScale, vinylSpinSpeed, barOpacityMin, barOpacityMax, primaryColor, secondaryColor, bloomStrength,
  } = payload;

  const panelW = width * 0.32;
  const vinylR = Math.min(width, height) * 0.16;
  const cx = panelW * 0.55;
  const cy = height * 0.42;
  drawVinyl(ctx, cx, cy, vinylR, thumb, tick * 0.0028 * vinylSpinSpeed, true, vinylScale);

  const count = Math.min(96, bars.length);
  const start = panelW + 20;
  const end = width * 0.96;
  const available = end - start;
  const baseGap = 2.5 * barGapScale;
  const perBar = available / count;
  const barW = Math.max(3, (perBar - baseGap) * barWidthScale);
  const gap = Math.max(1, perBar - barW);
  const centerY = height * 0.42;
  const maxH = height * 0.26 * barHeightScale;

  const barData = [];
  for (let i = 0; i < count; i += 1) {
    const amp = bars[i] / 255;
    const h = Math.max(6, amp * maxH);
    const x = start + i * (barW + gap);
    const alpha = barOpacityMin + amp * (barOpacityMax - barOpacityMin);
    const colorA = mixHex(primaryColor, secondaryColor, 0.35, alpha);
    const colorB = toRgba(secondaryColor, alpha * 0.52);
    const grad = ctx.createLinearGradient(x, centerY - h, x, centerY + h);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.shadowBlur = (8 + amp * 22) * glowIntensity * (0.7 + bloomStrength * 0.6);
    ctx.shadowColor = toRgba(primaryColor, 0.82);
    drawRoundedBar(ctx, x, centerY - h, barW, h * 2, barW * barRoundness, grad);
    barData.push({ x, y: centerY + maxH + 12, w: barW, h: h * 2, colorA, colorB, amp });
  }
  ctx.shadowBlur = 0;

  if (mirrorEffect) {
    drawReflectionBars(ctx, barData, payload);
  }
};

// ==================== STYLE: DUAL MIRRORED ====================
// Center vinyl, bars extend left and right - sky blue gradient
const drawDualMirroredBars = (ctx, payload) => {
  const {
    width, height, bars, thumb, glowIntensity, mirrorEffect,
    barWidthScale, barGapScale, barRoundness, barHeightScale, tick,
    vinylScale, vinylSpinSpeed, barOpacityMin, barOpacityMax, primaryColor, secondaryColor, bloomStrength,
  } = payload;

  const centerX = width / 2;
  const centerY = height * 0.42;
  const vinylR = Math.min(width, height) * 0.12;
  drawVinyl(ctx, centerX, centerY, vinylR, thumb, tick * 0.0024 * vinylSpinSpeed, true, vinylScale);

  const margin = vinylR * vinylScale * 1.3;
  const sideBars = Math.min(42, Math.floor(bars.length / 2));
  const sideWidth = width * 0.5 - margin - 20;
  const baseGap = 3 * barGapScale;
  const perBar = sideWidth / sideBars;
  const barW = Math.max(4, (perBar - baseGap) * barWidthScale);
  const gap = Math.max(1, perBar - barW);
  const maxH = height * 0.28 * barHeightScale;

  const barData = [];
  for (let i = 0; i < sideBars; i += 1) {
    const amp = bars[i] / 255;
    const h = Math.max(8, amp * maxH);
    const xLeft = centerX - margin - (i + 1) * (barW + gap);
    const xRight = centerX + margin + i * (barW + gap);
    const y = centerY - h;
    const alpha = barOpacityMin + amp * (barOpacityMax - barOpacityMin);
    const colorA = toRgba(primaryColor, alpha);
    const colorB = toRgba(secondaryColor, alpha * 0.52);
    const grad = ctx.createLinearGradient(0, y, 0, centerY + h);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.shadowBlur = (8 + amp * 24) * glowIntensity * (0.72 + bloomStrength * 0.58);
    ctx.shadowColor = toRgba(primaryColor, 0.86);
    drawRoundedBar(ctx, xLeft, y, barW, h * 2, barW * barRoundness, grad);
    drawRoundedBar(ctx, xRight, y, barW, h * 2, barW * barRoundness, grad);
    barData.push({ x: xLeft, y: centerY + maxH + 10, w: barW, h: h * 2, colorA, colorB, amp });
    barData.push({ x: xRight, y: centerY + maxH + 10, w: barW, h: h * 2, colorA, colorB, amp });
  }
  ctx.shadowBlur = 0;

  if (mirrorEffect) {
    drawReflectionBars(ctx, barData, payload);
  }
};

// ==================== STYLE: SEMI-ARC ====================
// Large vinyl at bottom (half hidden), bars emanate from top edge of vinyl in arc
const drawSemiArc = (ctx, payload) => {
  const {
    bars, width, height, glowIntensity, thumb,
    barWidthScale, barHeightScale, tick,
    vinylScale, vinylSpinSpeed, barOpacityMin, barOpacityMax, primaryColor, secondaryColor, bloomStrength,
  } = payload;

  const cx = width / 2;
  // Position vinyl so bottom half is cut off by screen edge
  const vinylR = Math.min(width, height) * 0.42 * vinylScale;
  const baseY = height + vinylR * 0.38; // Push vinyl below screen edge
  
  // Draw large vinyl (only top portion visible)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height); // Clip to canvas bounds
  ctx.clip();
  drawVinyl(ctx, cx, baseY, vinylR / vinylScale, thumb, tick * 0.0018 * vinylSpinSpeed, true, vinylScale);
  ctx.restore();

  const count = Math.min(96, bars.length);
  // Arc spans from left to right across the top of the vinyl
  const startAngle = Math.PI * 1.15; // Start from lower left
  const endAngle = Math.PI * 1.85;   // End at lower right
  const innerRadius = vinylR * 1.02;  // Start just outside vinyl edge

  for (let i = 0; i < count; i += 1) {
    const mirroredAmp = mirroredIndexSample(bars, i, count) / 255;
    const t = i / Math.max(1, count - 1);
    const angle = startAngle + (endAngle - startAngle) * t;
    const amp = mirroredAmp * centerBurstProfile(i, count, 0.26, 1.7);
    // Taller bars for more dramatic effect
    const extension = Math.max(8, amp * (height * 0.32) * barHeightScale);
    
    const x1 = cx + Math.cos(angle) * innerRadius;
    const y1 = baseY + Math.sin(angle) * innerRadius;
    const x2 = cx + Math.cos(angle) * (innerRadius + extension);
    const y2 = baseY + Math.sin(angle) * (innerRadius + extension);
    
    // Only draw if the bar origin is visible
    if (y1 > height + 20) continue;
    
    const alpha = barOpacityMin + amp * (barOpacityMax - barOpacityMin);
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, toRgba(primaryColor, alpha));
    grad.addColorStop(1, toRgba(secondaryColor, alpha * 0.6));
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, (3 + amp * 4) * barWidthScale);
    ctx.shadowBlur = (8 + amp * 18) * glowIntensity * (0.7 + bloomStrength * 0.5);
    ctx.shadowColor = toRgba(primaryColor, 0.85);
    ctx.beginPath();
    ctx.moveTo(x1, Math.min(y1, height - 2));
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
};

// ==================== STYLE: SEMICIRCULAR VINYL WRAP ====================
// Cover overlaps vinyl, semicircle wraps exposed half - cyan gradient
const drawSemicircularVinylWrap = (ctx, payload) => {
  const {
    bars, width, height, thumb, glowIntensity,
    barWidthScale, barHeightScale, tick,
    vinylScale, vinylSpinSpeed, barOpacityMin, barOpacityMax, artBorderRadius, primaryColor, secondaryColor, bloomStrength,
  } = payload;

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const vinylR = Math.min(width, height) * 0.21;
  const square = vinylR * 1.75 * vinylScale;

  drawVinyl(ctx, centerX, centerY, vinylR, thumb, tick * 0.0022 * vinylSpinSpeed, true, vinylScale);
  
  const coverX = centerX - square;
  const coverY = centerY - square / 2;
  drawSquareArt(ctx, thumb, coverX, coverY, square, artBorderRadius);

  const count = Math.min(72, bars.length);
  const startAngle = -Math.PI * 0.5;
  const endAngle = Math.PI * 0.5;

  for (let i = 0; i < count; i += 1) {
    const baseAmp = mirroredIndexSample(bars, i, count) / 255;
    const amp = baseAmp * centerBurstProfile(i, count, 0.26, 1.65);
    const t = i / Math.max(1, count - 1);
    const angle = startAngle + (endAngle - startAngle) * t;
    const extension = Math.max(12, amp * (height * 0.2) * barHeightScale);
    const inner = vinylR * vinylScale * 1.05;
    const outer = inner + extension;
    const x1 = centerX + Math.cos(angle) * inner;
    const y1 = centerY + Math.sin(angle) * inner;
    const x2 = centerX + Math.cos(angle) * outer;
    const y2 = centerY + Math.sin(angle) * outer;
    
    const alpha = barOpacityMin + amp * (barOpacityMax - barOpacityMin);
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, toRgba(primaryColor, alpha));
    grad.addColorStop(1, toRgba(secondaryColor, alpha * 0.5));
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(5, (6 + amp * 5) * barWidthScale);
    ctx.shadowBlur = (10 + amp * 24) * glowIntensity * (0.75 + bloomStrength * 0.55);
    ctx.shadowColor = toRgba(primaryColor, 0.9);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
};

// ==================== STYLE: ROUND BASE ====================
// TrapNation-inspired: mirrored curved wings, RGB time-delayed layers,
// beat-reactive global scale, and mirrored starfield drift.
const roundBaseState = {
  history: [],
  maxHistory: 6,
  pushBars(bars) {
    this.history.unshift([...bars]);
    if (this.history.length > this.maxHistory) this.history.pop();
  },
  delayed(delay) {
    if (!this.history.length) return null;
    return this.history[Math.min(delay, this.history.length - 1)];
  },
};

const roundBaseStarfield = {
  stars: [],
  initialized: false,
  dist: 256,
  currentSpeed: 1,
  targetSpeed: 1,
  init(count = 420) {
    if (this.initialized) return;
    for (let i = 0; i < count; i += 1) {
      this.stars.push({
        x: ((Math.random() > 0.5 ? 1 : -1) * Math.random() * this.dist),
        y: ((Math.random() > 0.5 ? 1 : -1) * Math.random() * this.dist),
        z: ((Math.random() > 0.5 ? 1 : -1) * Math.random() * this.dist),
        a: 0.2 + Math.random() * 0.45,
      });
    }
    this.initialized = true;
  },
  update() {
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.1;
    for (const s of this.stars) {
      s.z -= this.currentSpeed;
      s.x += 0.5 * Math.sin(s.z / 256);
      s.y += 0.5 * Math.sin(s.z / 256);
      if (s.z < -this.dist) {
        s.z = this.dist;
        s.x = -1 * Math.random() * this.dist;
        s.y = ((Math.random() > 0.5 ? 1 : -1) * Math.random() * this.dist);
      }
    }
  },
  draw(ctx, width, height) {
    for (const s of this.stars) {
      if (s.z <= 0) continue;
      const xp = width / 2 + (s.x * this.dist) / s.z;
      const yp = height / 2 + (s.y * this.dist) / s.z;
      if (xp < 0 || xp > width || yp < 0 || yp > height) continue;
      const size = Math.max(0.5, 5 * (1 - s.z / this.dist));
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.beginPath();
      ctx.arc(xp, yp, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(width - xp, yp, size, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

const roundBaseBeat = {
  previousScale: 1,
  targetScale: 1,
  currentScale: 1,
  previousStarSpeed: 1,
  targetStarSpeed: 1,
  direction: 0,
  falloff: 0,
  lastTS: 0,
  lowEma: 0,
  beatScale: 1.32,
  increaseDuration: 55,
  stayDuration: 180,
  decreaseDuration: 120,
  update(deltaMS, lowBand) {
    this.lowEma = this.lowEma * 0.9 + lowBand * 0.1;
    const beatTriggered = lowBand > this.lowEma * 1.18 + 8;
    if (beatTriggered) {
      if (this.direction === 0 || this.direction === -1) {
        this.direction = 1;
        this.previousScale = this.currentScale;
        this.targetScale = this.beatScale;
        this.previousStarSpeed = roundBaseStarfield.currentSpeed;
        this.targetStarSpeed = 5;
        this.falloff = this.increaseDuration;
      } else if (this.direction === 2) {
        this.falloff = this.stayDuration;
      }
    }
    if (this.falloff > 0 && this.direction !== 0) {
      this.falloff -= deltaMS;
      if (this.falloff <= 0) {
        if (this.direction === 1) {
          this.direction = 2;
          this.previousScale = this.currentScale;
          this.targetScale = this.currentScale;
          this.previousStarSpeed = roundBaseStarfield.currentSpeed;
          this.targetStarSpeed = roundBaseStarfield.currentSpeed;
          this.falloff = this.stayDuration;
        } else if (this.direction === 2) {
          this.direction = -1;
          this.previousScale = this.currentScale;
          this.targetScale = 1;
          this.previousStarSpeed = roundBaseStarfield.currentSpeed;
          this.targetStarSpeed = 1;
          this.falloff = this.decreaseDuration;
        } else {
          this.direction = 0;
          this.previousScale = 1;
          this.targetScale = 1;
          this.previousStarSpeed = 1;
          this.targetStarSpeed = 1;
          this.falloff = 0;
        }
      }
    }
    if (this.falloff > 0) {
      const duration = this.direction === 2 ? this.stayDuration
        : this.direction === 1 ? this.increaseDuration
          : this.decreaseDuration;
      const t = Math.max(0, Math.min(1, (duration - this.falloff) / duration));
      const smooth = t * t * (3 - 2 * t);
      this.currentScale = this.previousScale + (this.targetScale - this.previousScale) * smooth;
      roundBaseStarfield.targetSpeed = this.previousStarSpeed + (this.targetStarSpeed - this.previousStarSpeed) * smooth;
    }
    return this.currentScale;
  },
};

// Cardinal spline curve drawing (like the reference's ctx.curve)
const drawCardinalSpline = (ctx, points, tension = 0.5, closed = false, append = false) => {
  if (points.length < 4) return;
  
  if (!append) {
    ctx.beginPath();
  }
  
  const getPoint = (i) => {
    if (closed) {
      const idx = ((i % (points.length / 2)) + points.length / 2) % (points.length / 2);
      return { x: points[idx * 2], y: points[idx * 2 + 1] };
    }
    const idx = Math.max(0, Math.min(points.length / 2 - 1, i));
    return { x: points[idx * 2], y: points[idx * 2 + 1] };
  };
  
  const numPoints = points.length / 2;
  
  for (let i = 0; i < numPoints - (closed ? 0 : 1); i++) {
    const p0 = getPoint(i - 1);
    const p1 = getPoint(i);
    const p2 = getPoint(i + 1);
    const p3 = getPoint(i + 2);
    
    if (i === 0) {
      if (append) {
        ctx.lineTo(p1.x, p1.y);
      } else {
      ctx.moveTo(p1.x, p1.y);
      }
    }
    
    const t1x = (p2.x - p0.x) * tension;
    const t1y = (p2.y - p0.y) * tension;
    const t2x = (p3.x - p1.x) * tension;
    const t2y = (p3.y - p1.y) * tension;
    
    const steps = 12;
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      
      const h1 = 2 * t3 - 3 * t2 + 1;
      const h2 = -2 * t3 + 3 * t2;
      const h3 = t3 - 2 * t2 + t;
      const h4 = t3 - t2;
      
      const x = h1 * p1.x + h2 * p2.x + h3 * t1x + h4 * t2x;
      const y = h1 * p1.y + h2 * p2.y + h3 * t1y + h4 * t2y;
      
      ctx.lineTo(x, y);
    }
  }
};

const normalizeRoundBaseAmp = (value, maxLen, amplitudeMultiplier = 1) => {
  const v = Math.max(0, Math.min(255, Number(value) || 0)) / 255;
  return Math.pow(v, 0.75) * maxLen * amplitudeMultiplier;
};

const drawRoundBase = (ctx, payload) => {
  const {
    width, height, bars, thumb, glowIntensity,
    barHeightScale, vinylScale, primaryColor,
  } = payload;

  roundBaseStarfield.init(400);
  roundBaseState.pushBars(bars);

  const now = performance.now();
  const deltaMS = roundBaseBeat.lastTS ? now - roundBaseBeat.lastTS : 16.67;
  roundBaseBeat.lastTS = now;

  const lowBand = ((bars[0] ?? 0) + (bars[1] ?? 0) + (bars[2] ?? 0) + (bars[3] ?? 0)) / 4;
  const scaleFactor = roundBaseBeat.update(deltaMS, lowBand);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, width, height);

  roundBaseStarfield.update();
  roundBaseStarfield.draw(ctx, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const base = Math.min(width, height);
  const radius = base * 0.13 * vinylScale;
  const maxLen = Math.max(10, base * 0.26 * barHeightScale);

  const startFreq = 0;
  const endFreq = Math.min(17, bars.length - 1);
  const freqCount = endFreq - startFreq + 1;
  const degToRad = (deg) => (deg * Math.PI) / 180;
  const angle = 180 / (2 + freqCount);

  const generateCurvePoints = (sourceBars, amplitudeMultiplier) => {
    const points = [];
    const mirrorPoints = [];

    let idx = 0;
    const x0 = radius * Math.cos(idx * degToRad(angle));
    const y0 = radius * Math.sin(idx * degToRad(angle));
    points.push(x0, y0);
    mirrorPoints.push(x0, -y0);
    idx++;
    
    for (let i = startFreq; i <= endFreq; i++) {
      const rawValue = sourceBars?.[i] ?? 0;
      const value = normalizeRoundBaseAmp(rawValue, maxLen, amplitudeMultiplier);
      const xW = (radius + value) * Math.cos(idx * degToRad(angle));
      const yW = (radius + value) * Math.sin(idx * degToRad(angle));
      points.push(xW, yW);
      mirrorPoints.push(xW, -yW);
      idx++;
    }

    const xF = radius * Math.cos(idx * degToRad(angle));
    const yF = radius * Math.sin(idx * degToRad(angle));
    points.push(xF, yF);
    mirrorPoints.push(xF, -yF);

    return { points, mirrorPoints };
  };

  const whiteBars = roundBaseState.delayed(0) ?? bars;
  const redBars = roundBaseState.delayed(1) ?? whiteBars;
  const blueBars = roundBaseState.delayed(2) ?? whiteBars;
  const greenBars = roundBaseState.delayed(3) ?? whiteBars;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scaleFactor, scaleFactor);

  ctx.save();
  ctx.rotate(degToRad(-90));

  if (scaleFactor > 1) {
    const glowAlpha = Math.min(0.8, 0.35 * (scaleFactor - 1) * 3.2);
    ctx.shadowColor = `rgba(255, 255, 255, ${glowAlpha})`;
    ctx.shadowBlur = 5 * ((scaleFactor * 100) - 100) * glowIntensity;
  }

  const greenData = generateCurvePoints(greenBars, 1.7);
  const blueData = generateCurvePoints(blueBars, 1.45);
  const redData = generateCurvePoints(redBars, 1.2);
  const whiteData = generateCurvePoints(whiteBars, 1.0);

  if (greenData.points.length > 0) {
    ctx.fillStyle = '#00ff00';
    drawCardinalSpline(ctx, greenData.points, 0.5, false, false);
    drawCardinalSpline(ctx, greenData.mirrorPoints, 0.5, false, true);
    ctx.closePath();
    ctx.fill();
  }

  if (blueData.points.length > 0) {
    ctx.fillStyle = '#0000ff';
    drawCardinalSpline(ctx, blueData.points, 0.5, false, false);
    drawCardinalSpline(ctx, blueData.mirrorPoints, 0.5, false, true);
    ctx.closePath();
    ctx.fill();
  }

  if (redData.points.length > 0) {
    ctx.fillStyle = '#ff0000';
    drawCardinalSpline(ctx, redData.points, 0.5, false, false);
    drawCardinalSpline(ctx, redData.mirrorPoints, 0.5, false, true);
    ctx.closePath();
    ctx.fill();
  }

  if (whiteData.points.length > 0) {
    ctx.fillStyle = '#ffffff';
    drawCardinalSpline(ctx, whiteData.points, 0.5, false, false);
    drawCardinalSpline(ctx, whiteData.mirrorPoints, 0.5, false, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  if (thumb) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
    ctx.clip();
    const thumbSize = radius * 1.84;
    drawImageCover(ctx, thumb, -thumbSize / 2, -thumbSize / 2, thumbSize, thumbSize);
    ctx.restore();
  }

  ctx.strokeStyle = toRgba(primaryColor, 0.4 * scaleFactor);
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10 * glowIntensity * scaleFactor;
  ctx.shadowColor = toRgba(primaryColor, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
  ctx.shadowBlur = 0;
};

// ==================== STYLE: STACKED PILLARS ====================
// Wide bottom bars with soft purple/blue gradient - pillar-like
const drawStackedPillars = (ctx, payload) => {
  const {
    bars, width, height, glowIntensity, mirrorEffect,
    barWidthScale, barGapScale, barRoundness, barHeightScale, tick,
    barOpacityMin, barOpacityMax, primaryColor, secondaryColor, bloomStrength,
  } = payload;

  const count = Math.min(54, bars.length);
  const bottom = height * 0.68;
  const maxH = height * 0.56;
  const xStart = width * 0.04;
  const xEnd = width * 0.96;
  const available = xEnd - xStart;
  const baseGap = 4 * barGapScale;
  const perBar = available / count;
  const w = Math.max(5, (perBar - baseGap) * barWidthScale * 1.3);
  const gap = Math.max(2, perBar - w);
  const totalW = w * count + gap * (count - 1);
  const leftPad = xStart + (available - totalW) / 2;

  const barData = [];
  for (let i = 0; i < count; i += 1) {
    const amp = bars[i] / 255;
    const h = Math.max(8, amp * maxH * barHeightScale);
    const x = leftPad + i * (w + gap);
    const y = bottom - h;
    const alpha = barOpacityMin + amp * (barOpacityMax - barOpacityMin);
    const colorA = mixHex(primaryColor, '#a78bfa', 0.5, alpha);
    const colorB = mixHex(secondaryColor, '#6366f1', 0.5, alpha * 0.5);
    const grad = ctx.createLinearGradient(x, y, x, bottom);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.shadowBlur = (10 + amp * 26) * glowIntensity * (0.72 + bloomStrength * 0.58);
    ctx.shadowColor = toRgba(primaryColor, 0.85);
    const segments = 3 + Math.round(amp * 5);
    const segGap = 2 + Math.sin(i * 0.35 + tick * 0.05);
    const segH = Math.max(4, (h - segGap * (segments - 1)) / segments);
    for (let s = 0; s < segments; s += 1) {
      const sy = y + s * (segH + segGap);
      drawRoundedBar(ctx, x, sy, w, segH, w * Math.min(barRoundness, 0.45), grad);
    }
    const capY = y - Math.max(6, w * 0.75);
    ctx.beginPath();
    ctx.arc(x + w / 2, capY, Math.max(3, w * 0.28), 0, Math.PI * 2);
    ctx.fillStyle = toRgba(primaryColor, alpha);
    ctx.fill();
    barData.push({ x, y: bottom + 8, w, h, colorA, colorB, amp });
  }
  ctx.shadowBlur = 0;

  if (mirrorEffect) {
    drawReflectionBars(ctx, barData, payload);
  }
};

// ==================== STYLE: HORIZON TOWER ====================
// Center-spreading bars that taper outward - teal gradient
const drawHorizonTower = (ctx, payload) => {
  const {
    bars, width, height, glowIntensity, mirrorEffect,
    barWidthScale, barGapScale, barRoundness, barHeightScale, beatPulse,
    barOpacityMin, barOpacityMax, primaryColor, secondaryColor, bloomStrength,
  } = payload;

  const centerX = width / 2;
  const horizonY = height * 0.72;
  const count = Math.min(88, bars.length);
  const laneCount = Math.floor(count / 2);
  const depth = height * 0.54;
  const baseGap = 3 * barGapScale;

  const barData = [];
  for (let i = 0; i < laneCount; i += 1) {
    const amp = bars[i] / 255;
    const t = i / Math.max(1, laneCount - 1);
    const z = 1 - t;
    const y = horizonY - z * depth;
    const perspective = 0.25 + z * 0.85;
    const xSpread = (1 - z) * width * 0.48;
    const xLeft = centerX - xSpread - baseGap;
    const xRight = centerX + xSpread + baseGap;
    const w = Math.max(3, (4 + z * 12) * barWidthScale * perspective);
    const h = Math.max(6, amp * height * 0.22 * barHeightScale * (0.55 + z));
    const pulse = 1 + (beatPulse || 0) * 0.25;
    const alpha = barOpacityMin + amp * (barOpacityMax - barOpacityMin);
    const colorA = toRgba(primaryColor, alpha * (0.6 + z * 0.45));
    const colorB = toRgba(secondaryColor, alpha * 0.5);
    const grad = ctx.createLinearGradient(0, y - h * pulse, 0, y + h * pulse);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.shadowBlur = (10 + amp * 26) * glowIntensity * (0.7 + bloomStrength * 0.6);
    ctx.shadowColor = toRgba(primaryColor, 0.85);
    const top = y - h * pulse;
    const bottom = y + h * pulse;
    const visibleTop = Math.max(4, top);
    const visibleBottom = Math.min(height - 4, bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    if (visibleHeight < 2) continue;

    drawRoundedBar(ctx, xLeft - w, visibleTop, w, visibleHeight, w * barRoundness, grad);
    drawRoundedBar(ctx, xRight, visibleTop, w, visibleHeight, w * barRoundness, grad);
    barData.push({ x: xLeft - w, y: horizonY + 6, w, h: visibleHeight, colorA, colorB, amp });
    barData.push({ x: xRight, y: horizonY + 6, w, h: visibleHeight, colorA, colorB, amp });
  }

  ctx.strokeStyle = toRgba(primaryColor, 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(width, horizonY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (mirrorEffect) {
    drawReflectionBars(ctx, barData, payload);
  }
};

// ==================== STYLE: PULSE FRAME ====================
// Full circular bars around center vinyl with rotating thumbnail - stronger reactions
const drawPulseFrame = (ctx, payload) => {
  const {
    bars, width, height, glowIntensity, thumb, bass, energy,
    barWidthScale, barHeightScale, tick,
    vinylScale, vinylSpinSpeed, barOpacityMin, barOpacityMax, primaryColor, secondaryColor, bloomStrength,
  } = payload;

  const centerX = width / 2;
  const centerY = height / 2;
  const vinylR = Math.min(width, height) * 0.18 * vinylScale;
  const spin = tick * 0.0022 * vinylSpinSpeed;

  // Draw vinyl with rotating thumbnail
  drawVinyl(ctx, centerX, centerY, vinylR / vinylScale, thumb, spin, true, vinylScale);

  const count = Math.min(108, bars.length);
  const baseRadius = vinylR + 8;
  // Boost based on bass and overall energy for stronger reactions
  const pulseBoost = 1 + (bass / 255) * 0.4 + (energy / 255) * 0.2;
  
  for (let i = 0; i < count; i++) {
    const amp = bars[Math.floor(i * bars.length / count)] / 255;
    const t = i / count;
    const angle = t * Math.PI * 2 - Math.PI / 2;
    
    // Much stronger extension with pulse boost
    const extension = Math.max(6, amp * 80 * barHeightScale * pulseBoost);
    
    const x1 = centerX + Math.cos(angle) * baseRadius;
    const y1 = centerY + Math.sin(angle) * baseRadius;
    const x2 = centerX + Math.cos(angle) * (baseRadius + extension);
    const y2 = centerY + Math.sin(angle) * (baseRadius + extension);

    const alpha = barOpacityMin + amp * (barOpacityMax - barOpacityMin);
    
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, toRgba('#ffffff', Math.min(1, alpha + 0.12)));
    grad.addColorStop(0.35, toRgba(primaryColor, alpha));
    grad.addColorStop(1, toRgba(secondaryColor, alpha * 0.65));
    
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, (2.2 + amp * 2.2) * barWidthScale);
    ctx.shadowBlur = (10 + amp * 20) * glowIntensity * (0.75 + bloomStrength * 0.6);
    ctx.shadowColor = toRgba(primaryColor, 0.72);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
};

const drawSpectralRibbon = (ctx, payload) => {
  const { 
    bars, width, height, tick, glowIntensity, primaryColor, secondaryColor, 
    trailStrength, bloomStrength, beatPulse, thumb, vinylScale, vinylSpinSpeed 
  } = payload;
  
  const pulse = 1 + (beatPulse || 0) * 0.2;
  const base = Math.min(width, height);
  
  // Trail fade effect
  ctx.fillStyle = `rgba(2,6,23,${0.04 + trailStrength * 0.12})`;
  ctx.fillRect(0, 0, width, height);
  
  // Center vinyl/album art
  const cx = width / 2;
  const cy = height / 2;
  const vinylR = base * 0.12;
  drawVinyl(ctx, cx, cy, vinylR / (vinylScale || 1), thumb, tick * 0.0018 * (vinylSpinSpeed || 1), true, vinylScale || 1);
  
  // Ribbon parameters
  const ribbonWidth = width * 0.9;
  const ribbonStartX = (width - ribbonWidth) / 2;
  const step = ribbonWidth / Math.max(1, bars.length - 1);
  const baselineTop = height * 0.3;
  const baselineBottom = height * 0.7;
  const maxAmp = height * 0.22 * pulse;
  const phase = tick * 0.025;
  
  // Create smooth curve points for top ribbon
  const topPoints = [];
  const bottomPoints = [];
  
  for (let i = 0; i < bars.length; i += 1) {
    const v = bars[i] / 255;
    const x = ribbonStartX + i * step;
    
    // Wave motion
    const wave = Math.sin(i * 0.12 + phase) * 8;
    const wave2 = Math.cos(i * 0.08 + phase * 0.7) * 5;
    
    // Top ribbon flows upward
    const yTop = baselineTop - v * maxAmp - wave;
    topPoints.push({ x, y: yTop, v });
    
    // Bottom ribbon flows downward (mirrored)
    const yBottom = baselineBottom + v * maxAmp + wave2;
    bottomPoints.push({ x, y: yBottom, v });
  }
  
  // Draw filled area between ribbons (subtle glow)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y);
  for (let i = 1; i < topPoints.length; i += 1) {
    const prev = topPoints[i - 1];
    const curr = topPoints[i];
    const cpX = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + curr.y) / 2);
  }
  ctx.lineTo(topPoints[topPoints.length - 1].x, topPoints[topPoints.length - 1].y);
  ctx.lineTo(bottomPoints[bottomPoints.length - 1].x, bottomPoints[bottomPoints.length - 1].y);
  for (let i = bottomPoints.length - 2; i >= 0; i -= 1) {
    const prev = bottomPoints[i + 1];
    const curr = bottomPoints[i];
    const cpX = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + curr.y) / 2);
  }
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, baselineTop - maxAmp, 0, baselineBottom + maxAmp);
  fillGrad.addColorStop(0, toRgba(primaryColor, 0.08));
  fillGrad.addColorStop(0.5, toRgba(primaryColor, 0.02));
  fillGrad.addColorStop(1, toRgba(secondaryColor, 0.08));
  ctx.fillStyle = fillGrad;
  ctx.fill();
  ctx.restore();
  
  // Draw top ribbon with glow
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y);
  for (let i = 1; i < topPoints.length; i += 1) {
    const prev = topPoints[i - 1];
    const curr = topPoints[i];
    const cpX = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + curr.y) / 2);
  }
  const topGrad = ctx.createLinearGradient(ribbonStartX, 0, ribbonStartX + ribbonWidth, 0);
  topGrad.addColorStop(0, toRgba(secondaryColor, 0.7));
  topGrad.addColorStop(0.3, toRgba(primaryColor, 0.95));
  topGrad.addColorStop(0.7, toRgba(primaryColor, 0.95));
  topGrad.addColorStop(1, toRgba(secondaryColor, 0.7));
  ctx.strokeStyle = topGrad;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 18 * glowIntensity * (0.7 + bloomStrength * 0.5);
  ctx.shadowColor = toRgba(primaryColor, 0.8);
  ctx.stroke();
  ctx.restore();
  
  // Draw bottom ribbon with glow
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
  for (let i = 1; i < bottomPoints.length; i += 1) {
    const prev = bottomPoints[i - 1];
    const curr = bottomPoints[i];
    const cpX = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + curr.y) / 2);
  }
  const bottomGrad = ctx.createLinearGradient(ribbonStartX, 0, ribbonStartX + ribbonWidth, 0);
  bottomGrad.addColorStop(0, toRgba(secondaryColor, 0.5));
  bottomGrad.addColorStop(0.5, toRgba(secondaryColor, 0.8));
  bottomGrad.addColorStop(1, toRgba(secondaryColor, 0.5));
  ctx.strokeStyle = bottomGrad;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 14 * glowIntensity * (0.6 + bloomStrength * 0.4);
  ctx.shadowColor = toRgba(secondaryColor, 0.7);
  ctx.stroke();
  ctx.restore();
  
  // Draw vertical bars connecting the ribbons at intervals (NCS style accent)
  const barInterval = Math.max(4, Math.floor(bars.length / 24));
  for (let i = 0; i < bars.length; i += barInterval) {
    const amp = bars[i] / 255;
    if (amp < 0.15) continue;
    
    const x = ribbonStartX + i * step;
    const yTop = topPoints[i].y;
    const yBottom = bottomPoints[i].y;
    
    const barGrad = ctx.createLinearGradient(x, yTop, x, yBottom);
    barGrad.addColorStop(0, toRgba(primaryColor, amp * 0.6));
    barGrad.addColorStop(0.5, toRgba(primaryColor, amp * 0.2));
    barGrad.addColorStop(1, toRgba(secondaryColor, amp * 0.6));
    
    ctx.save();
    ctx.strokeStyle = barGrad;
    ctx.lineWidth = 1.5 + amp * 2;
    ctx.lineCap = 'round';
    ctx.shadowBlur = (4 + amp * 10) * glowIntensity;
    ctx.shadowColor = toRgba(primaryColor, 0.4);
    ctx.beginPath();
    ctx.moveTo(x, yTop + 5);
    ctx.lineTo(x, yBottom - 5);
    ctx.stroke();
    ctx.restore();
  }
  
  ctx.shadowBlur = 0;
};

const drawSaturnRing = (ctx, payload) => {
  const {
    bars, width, height, tick, primaryColor, secondaryColor, glowIntensity,
    barHeightScale, bloomStrength, beatPulse, thumb, vinylScale, vinylSpinSpeed,
    barWidthScale,
  } = payload;
  
  const base = Math.min(width, height);
  const pulse = 1 + (beatPulse || 0) * 0.25;
  
  // Saturn tilt angle (tilted to lower-left like real Saturn)
  const tiltAngle = -Math.PI / 6; // 30 degrees tilt
  
  // Center position
  const cx = width * 0.5;
  const cy = height * 0.5;
  
  // Planet (vinyl) size
  const planetR = base * 0.14;
  
  // Ring ellipse dimensions
  const ringRx = base * 0.38;
  const ringRy = base * 0.12;
  
  // Ring rotation phase (slow rotation)
  const ringPhase = tick * 0.0005;
  
  // Total bars around the ring (full 360 degrees)
  const totalBars = Math.min(72, Math.floor(bars.length));
  
  // Helper function to transform point by tilt
  const tiltPoint = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const cos = Math.cos(tiltAngle);
    const sin = Math.sin(tiltAngle);
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  };
  
  // Normalize angle to [0, 2π]
  const normalizeAngle = (angle) => {
    return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  };
  
  // Check if angle is in BACK portion (behind vinyl - should be hidden/faint)
  // Back is roughly from angle 0 to PI (top half of ellipse before tilt)
  // But we need to account for the ring rotation phase
  const isInBack = (angle) => {
    const normalized = normalizeAngle(angle - ringPhase);
    // Back half is 0 to PI (top arc when viewed from side)
    return normalized > 0.1 && normalized < Math.PI * 0.9;
  };
  
  // Draw subtle ambient glow
  ctx.save();
  const ambientGlow = ctx.createRadialGradient(cx, cy, ringRx * 0.3, cx, cy, ringRx * 1.1);
  ambientGlow.addColorStop(0, 'rgba(0,0,0,0)');
  ambientGlow.addColorStop(0.5, toRgba(primaryColor, 0.018));
  ambientGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  
  // === PROPER 3D DRAW ORDER ===
  // 1. Draw BACK portion of ring (faint) - this goes behind vinyl
  // 2. Draw BACK bars (very faint) - these are mostly hidden
  // 3. Draw vinyl/planet
  // 4. Draw FRONT portion of ring (bright) - this overlaps vinyl
  // 5. Draw FRONT bars (bright) - these overlap vinyl
  
  const barWidth = Math.max(2, (base * 0.005) * (barWidthScale || 1));
  const maxBarHeight = base * 0.16 * barHeightScale * pulse;
  
  // Helper to draw a single bar
  const drawBar = (angle, amp, alphaMultiplier) => {
    const barHeight = Math.max(2, amp * maxBarHeight);
    
    // Base position on ring
    const baseX = cx + Math.cos(angle) * ringRx * 0.97;
    const baseY = cy + Math.sin(angle) * ringRy * 0.97;
    const basePt = tiltPoint(baseX, baseY);
    
    // VERTICAL bar - straight up
    const topX = basePt.x;
    const topY = basePt.y - barHeight;
    
    const alpha = (0.5 + amp * 0.5) * alphaMultiplier;
    
    // Create gradient
    const grad = ctx.createLinearGradient(basePt.x, basePt.y, topX, topY);
    grad.addColorStop(0, toRgba(primaryColor, alpha * 0.85));
    grad.addColorStop(0.3, toRgba(primaryColor, alpha));
    grad.addColorStop(0.7, toRgba(secondaryColor, alpha * 0.75));
    grad.addColorStop(1, toRgba(secondaryColor, alpha * 0.2));
    
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = barWidth + amp * 2.5;
    ctx.lineCap = 'round';
    if (alphaMultiplier > 0.3) {
      ctx.shadowBlur = (5 + amp * 12) * glowIntensity * (0.5 + bloomStrength * 0.4);
      ctx.shadowColor = toRgba(primaryColor, 0.5 + amp * 0.3);
    }
    ctx.beginPath();
    ctx.moveTo(basePt.x, basePt.y);
    ctx.lineTo(topX, topY);
    ctx.stroke();
    ctx.restore();
  };
  
  // Helper to draw ring arc
  const drawRingArc = (startAngle, endAngle, alpha, lineW, innerScale = 1) => {
    ctx.save();
    ctx.beginPath();
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + (endAngle - startAngle) * t;
      const pt = tiltPoint(
        cx + Math.cos(angle) * ringRx * innerScale,
        cy + Math.sin(angle) * ringRy * innerScale
      );
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = toRgba(primaryColor, alpha);
    ctx.lineWidth = lineW;
    ctx.stroke();
    ctx.restore();
  };
  
  // === 1. BACK RING (behind vinyl) - BRIGHTER but still behind ===
  const backStart = ringPhase + 0.15;
  const backEnd = ringPhase + Math.PI - 0.15;
  
  // Back ring outer with gradient
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    const angle = backStart + (backEnd - backStart) * t;
    const pt = tiltPoint(
      cx + Math.cos(angle) * ringRx,
      cy + Math.sin(angle) * ringRy
    );
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  const backGrad = ctx.createLinearGradient(cx - ringRx, cy, cx + ringRx, cy);
  backGrad.addColorStop(0, toRgba(secondaryColor, 0.3));
  backGrad.addColorStop(0.5, toRgba(primaryColor, 0.5));
  backGrad.addColorStop(1, toRgba(secondaryColor, 0.3));
  ctx.strokeStyle = backGrad;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 8 * glowIntensity * (0.4 + bloomStrength * 0.3);
  ctx.shadowColor = toRgba(primaryColor, 0.35);
  ctx.stroke();
  ctx.restore();
  
  // Back ring inner
  drawRingArc(backStart, backEnd, 0.25, 1.2, 0.93);
  
  // === 2. BACK BARS - brighter but behind vinyl ===
  for (let i = 0; i < totalBars; i++) {
    const angle = ringPhase + (i / totalBars) * Math.PI * 2;
    
    if (isInBack(angle)) {
      // Mirror frequency data
      const freqIdx = Math.abs(Math.floor(totalBars / 2) - i);
      const amp = (bars[freqIdx] || 0) / 255;
      // Draw back bars at 65% brightness
      drawBar(angle, amp, 0.65);
    }
  }
  
  // === 3. VINYL/PLANET ===
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tiltAngle * 0.15);
  ctx.translate(-cx, -cy);
  drawVinyl(ctx, cx, cy, planetR / (vinylScale || 1), thumb, tick * 0.002 * (vinylSpinSpeed || 1), true, vinylScale || 1);
  ctx.restore();
  
  // === 4. FRONT RING (in front of vinyl) ===
  const frontStart = ringPhase + Math.PI + 0.15;
  const frontEnd = ringPhase + Math.PI * 2 - 0.15;
  
  // Outer ring with gradient
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const angle = frontStart + (frontEnd - frontStart) * t;
    const pt = tiltPoint(
      cx + Math.cos(angle) * ringRx,
      cy + Math.sin(angle) * ringRy
    );
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  const ringGrad = ctx.createLinearGradient(cx - ringRx, cy, cx + ringRx, cy);
  ringGrad.addColorStop(0, toRgba(secondaryColor, 0.4));
  ringGrad.addColorStop(0.4, toRgba(primaryColor, 0.65));
  ringGrad.addColorStop(0.6, toRgba(primaryColor, 0.65));
  ringGrad.addColorStop(1, toRgba(secondaryColor, 0.4));
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 10 * glowIntensity * (0.5 + bloomStrength * 0.35);
  ctx.shadowColor = toRgba(primaryColor, 0.45);
  ctx.stroke();
  ctx.restore();
  
  // Inner ring line (front)
  drawRingArc(frontStart, frontEnd, 0.2, 1.2, 0.93);
  
  // === 5. FRONT BARS (visible, in front of vinyl) ===
  for (let i = 0; i < totalBars; i++) {
    const angle = ringPhase + (i / totalBars) * Math.PI * 2;
    
    if (!isInBack(angle)) {
      // Mirror frequency data - bass on edges, mids/highs in center
      const freqIdx = Math.abs(Math.floor(totalBars / 2) - i);
      const amp = (bars[freqIdx] || 0) / 255;
      // Draw bright front bars
      drawBar(angle, amp, 1.0);
    }
  }
  
  ctx.shadowBlur = 0;
};

const drawKaleidoOrbit = (ctx, payload) => {
  const {
    bars, width, height, tick, primaryColor, secondaryColor, glowIntensity, barHeightScale, bloomStrength,
    thumb, vinylScale, vinylSpinSpeed, beatPulse, barWidthScale,
  } = payload;
  
  const cx = width / 2;
  const cy = height / 2;
  const base = Math.min(width, height);
  const pulse = 1 + (beatPulse || 0) * 0.35;
  
  // Mirror bars for symmetric effect (NCS style)
  const halfCount = Math.min(48, Math.floor(bars.length / 2));
  const count = halfCount * 2;
  
  const vinylR = base * 0.14;
  const orbitInner = base * 0.22;
  const orbitOuter = orbitInner + base * 0.04;
  const spin = tick * 0.0012;
  
  // Draw ambient glow behind everything
  const ambientGlow = ctx.createRadialGradient(cx, cy, vinylR, cx, cy, base * 0.5);
  ambientGlow.addColorStop(0, toRgba(primaryColor, 0.08));
  ambientGlow.addColorStop(0.5, toRgba(secondaryColor, 0.03));
  ambientGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, 0, width, height);
  
  // Draw outer decorative rings
  for (let ring = 0; ring < 3; ring += 1) {
    const ringRadius = orbitOuter + base * (0.12 + ring * 0.06);
    const ringAlpha = 0.08 - ring * 0.02;
    ctx.strokeStyle = toRgba(primaryColor, ringAlpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw frequency bars as radial lines (NCS/Trap Nation style)
  for (let i = 0; i < count; i += 1) {
    // Mirror: first half uses bars[0 to halfCount-1], second half mirrors
    const mirrorIdx = i < halfCount ? i : count - 1 - i;
    const amp = (bars[mirrorIdx] || 0) / 255;
    const reactive = Math.pow(amp, 0.65);
    
    const t = i / count;
    const angle = t * Math.PI * 2 + spin;
    
    // Bar dimensions
    const innerRadius = orbitInner + reactive * base * 0.02;
    const barLength = base * (0.08 + reactive * 0.18) * barHeightScale * pulse;
    const outerRadius = innerRadius + barLength;
    
    // Calculate positions
    const x1 = cx + Math.cos(angle) * innerRadius;
    const y1 = cy + Math.sin(angle) * innerRadius;
    const x2 = cx + Math.cos(angle) * outerRadius;
    const y2 = cy + Math.sin(angle) * outerRadius;
    
    // Gradient for bars - bright at tip
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    const alpha = 0.4 + reactive * 0.6;
    grad.addColorStop(0, toRgba(secondaryColor, alpha * 0.5));
    grad.addColorStop(0.3, toRgba(primaryColor, alpha));
    grad.addColorStop(1, toRgba('#ffffff', alpha * 0.9));
    
    // Draw bar with glow
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(2, (2 + reactive * 3) * (barWidthScale || 1));
    ctx.lineCap = 'round';
    ctx.shadowBlur = (8 + reactive * 20) * glowIntensity * (0.7 + bloomStrength * 0.5);
    ctx.shadowColor = toRgba(primaryColor, 0.6 + reactive * 0.4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
  
  // Draw inner orbit ring with glow
  ctx.save();
  ctx.strokeStyle = toRgba(primaryColor, 0.5);
  ctx.lineWidth = 2;
  ctx.shadowBlur = 12 * glowIntensity;
  ctx.shadowColor = toRgba(primaryColor, 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, orbitInner - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  
  // Draw vinyl/album art in center
  drawVinyl(ctx, cx, cy, vinylR / (vinylScale || 1), thumb, tick * 0.0022 * (vinylSpinSpeed || 1), true, vinylScale || 1);
  
  // Draw subtle outer ring
  ctx.strokeStyle = toRgba(secondaryColor, 0.2);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, orbitOuter + base * 0.01, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.shadowBlur = 0;
};

const drawDiagonalDrift = (ctx, payload) => {
  const { 
    bars, width, height, tick, primaryColor, secondaryColor, glowIntensity, 
    barWidthScale, barHeightScale, trailStrength, bloomStrength, beatPulse,
    thumb, vinylScale, vinylSpinSpeed,
  } = payload;
  
  const base = Math.min(width, height);
  const pulse = 1 + (beatPulse || 0) * 0.25;
  
  // Trail fade effect
  ctx.fillStyle = `rgba(2,6,23,${0.06 + trailStrength * 0.14})`;
  ctx.fillRect(0, 0, width, height);
  
  // Parameters for diagonal lanes
  const laneCount = 5;
  const barsPerLane = 28;
  const barSpacing = Math.max(16, 20 * (barWidthScale || 1));
  const laneWrap = width * 1.5 + barSpacing * barsPerLane;
  const diagonalAngle = Math.PI / 6; // 30 degrees
  const cos = Math.cos(diagonalAngle);
  const sin = Math.sin(diagonalAngle);
  
  // Draw album art in center (smaller, as accent)
  const cx = width * 0.5;
  const cy = height * 0.5;
  const vinylR = base * 0.1;
  
  // Draw subtle radial glow behind vinyl
  const centerGlow = ctx.createRadialGradient(cx, cy, vinylR * 0.5, cx, cy, vinylR * 3);
  centerGlow.addColorStop(0, toRgba(primaryColor, 0.1));
  centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, width, height);
  
  // Draw each lane of diagonal bars
  for (let lane = 0; lane < laneCount; lane += 1) {
    // Alternate lanes go different directions
    const direction = lane % 2 === 0 ? 1 : -1;
    const laneY = height * (0.15 + lane * 0.18);
    const speed = (1.2 + lane * 0.15) * direction;
    const offset = ((tick * speed * 1.5) % laneWrap + laneWrap) % laneWrap;
    
    // Lane-specific color variation
    const laneHue = lane / laneCount;
    const laneColor = lane % 2 === 0 ? primaryColor : secondaryColor;
    const laneColorAlt = lane % 2 === 0 ? secondaryColor : primaryColor;
    
    for (let i = 0; i < barsPerLane; i += 1) {
      // Get frequency data with variation per lane
      const freqIdx = (i * 2 + lane * 7) % bars.length;
      const amp = (bars[freqIdx] || 0) / 255;
      
      if (amp < 0.08) continue; // Skip very quiet bars
      
      // Bar dimensions
      const barWidth = Math.max(6, (8 + amp * 6) * (barWidthScale || 1));
      const barHeight = Math.max(20, amp * height * 0.28 * barHeightScale * pulse);
      
      // Position calculation
      const baseX = direction > 0 
        ? -barSpacing + i * barSpacing + offset 
        : width + barSpacing - i * barSpacing - offset + laneWrap;
      const wrappedX = ((baseX % laneWrap) + laneWrap) % laneWrap - barSpacing;
      
      // Skip if outside visible area
      if (wrappedX < -barWidth * 2 || wrappedX > width + barWidth * 2) continue;
      
      // Calculate diagonal position
      const diagX = wrappedX;
      const diagY = laneY + (wrappedX - width / 2) * 0.15 * direction;
      
      // Draw the bar as a rounded rectangle with gradient
      ctx.save();
      ctx.translate(diagX + barWidth / 2, diagY);
      ctx.rotate(diagonalAngle * direction * 0.5);
      
      // Gradient from bottom to top
      const grad = ctx.createLinearGradient(0, barHeight / 2, 0, -barHeight / 2);
      const alpha = 0.5 + amp * 0.5;
      grad.addColorStop(0, toRgba(laneColor, alpha * 0.3));
      grad.addColorStop(0.4, toRgba(laneColor, alpha));
      grad.addColorStop(0.85, toRgba(laneColorAlt, alpha * 0.8));
      grad.addColorStop(1, toRgba('#ffffff', alpha * 0.6));
      
      // Draw rounded bar
      const radius = Math.min(barWidth / 2, 4);
      ctx.beginPath();
      ctx.roundRect(-barWidth / 2, -barHeight / 2, barWidth, barHeight, radius);
      ctx.fillStyle = grad;
      ctx.shadowBlur = (6 + amp * 14) * glowIntensity * (0.6 + bloomStrength * 0.5);
      ctx.shadowColor = toRgba(laneColor, 0.6 + amp * 0.3);
      ctx.fill();
      
      // Bright cap at top
      ctx.beginPath();
      ctx.roundRect(-barWidth / 2, -barHeight / 2, barWidth, Math.max(3, barHeight * 0.08), [radius, radius, 0, 0]);
      ctx.fillStyle = toRgba('#ffffff', alpha * 0.9);
      ctx.shadowBlur = 0;
      ctx.fill();
      
      ctx.restore();
    }
  }
  
  // Draw center vinyl on top
  drawVinyl(ctx, cx, cy, vinylR / (vinylScale || 1), thumb, tick * 0.002 * (vinylSpinSpeed || 1), true, vinylScale || 1);
  
  // Draw subtle horizontal lines for depth
  ctx.save();
  ctx.strokeStyle = toRgba(primaryColor, 0.08);
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const y = height * (0.1 + i * 0.11);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
  
  ctx.shadowBlur = 0;
};

export { VISUALIZER_STYLES };

export default function Visualizer({ analyser, thumbnailUrl, settings }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const rafRef = useRef(0);
  const tickRef = useRef(0);
  const extractedColorsRef = useRef(null);
  const lastThumbnailRef = useRef(null);
  const smoothedBarsRef = useRef([]);
  const prevEnergyRef = useRef(0);
  const beatPulseRef = useRef(0);

  useEffect(() => {
    const full = getFullThumb(thumbnailUrl);
    
    // Reset extracted colors when thumbnail changes
    if (lastThumbnailRef.current !== thumbnailUrl) {
      extractedColorsRef.current = null;
      lastThumbnailRef.current = thumbnailUrl;
    }
    
    if (!full) {
      imageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = full;
    img.onload = () => { 
      imageRef.current = img;
      // Extract colors immediately when new image loads
      if (settings.autoExtractColor) {
        extractedColorsRef.current = extractDominantColor(img);
      }
    };
  }, [thumbnailUrl, settings.autoExtractColor]);

  useEffect(() => {
    if (settings.backgroundMode !== 'custom' || !settings.backgroundImage) {
      backgroundImageRef.current = null;
      return;
    }
    const img = new Image();
    img.src = settings.backgroundImage;
    img.onload = () => { backgroundImageRef.current = img; };
  }, [settings.backgroundImage, settings.backgroundMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
      const nextHeight = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const normalizedStyle = useMemo(() => normalizeVisualizerStyle(settings.style), [settings.style]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const safeFftSize = toValidFftSize(settings.fftSize);
    const safeSmoothing = clamp(settings.smoothing, 0, 1, 0.75);
    const barCount = Math.round(clamp(settings.barCount, 24, 256, 96));
    const glowIntensity = clamp(settings.glowIntensity, 0, 2, 0.7);
    const reactivity = clamp(settings.reactivity, 0.6, 2.6, 1);
    const barWidthScale = clamp(settings.barWidthScale, 0.5, 2.5, 1);
    const barGapScale = clamp(settings.barGapScale, 0.3, 2, 1);
    const barRoundness = clamp(settings.barRoundness, 0, 1, 0.45);
    const barHeightScale = clamp(settings.barHeightScale, 0.5, 3, 1);
    const mirrorEffect = settings.mirrorEffect !== false;
    const vinylScale = clamp(settings.vinylScale, 0.5, 1.5, 1);
    const vinylSpinSpeed = clamp(settings.vinylSpinSpeed, 0, 3, 1);
    const reflectionOpacity = clamp(settings.reflectionOpacity, 0.1, 0.5, 0.28);
    const particleSpeed = clamp(settings.particleSpeed, 0.2, 2, 1);
    const barOpacityMin = clamp(settings.barOpacityMin, 0.2, 0.8, 0.4);
    const barOpacityMax = clamp(settings.barOpacityMax, 0.7, 1, 0.95);
    const bassBoost = clamp(settings.bassBoost, 0.5, 2.5, 1);
    const trebleSensitivity = clamp(settings.trebleSensitivity, 0.5, 2, 1);
    const midSensitivity = clamp(settings.midSensitivity, 0.5, 2, 1);
    const pulseIntensity = clamp(settings.pulseIntensity, 0.5, 2, 1);
    const glowSpread = clamp(settings.glowSpread, 0.5, 2, 1);
    const energySmoothing = clamp(settings.energySmoothing, 0.2, 0.95, 0.68);
    const transientBoost = clamp(settings.transientBoost, 0.6, 2.2, 1.15);
    const beatSensitivity = clamp(settings.beatSensitivity, 0.6, 2.2, 1);
    const stereoSpread = clamp(settings.stereoSpread, 0, 1, 0.3);
    const trailStrength = clamp(settings.trailStrength, 0, 0.9, 0.3);
    const spectralTilt = clamp(settings.spectralTilt, -1, 1, 0);
    const freqData = new Uint8Array(Math.max(128, safeFftSize / 2));

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
      const nextHeight = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      tickRef.current += 1;

      let energy = 0;
      let bass = 0;
      let mid = 0;
      let treble = 0;
      
      if (analyser) {
        analyser.fftSize = safeFftSize;
        analyser.smoothingTimeConstant = safeSmoothing;
        analyser.getByteFrequencyData(freqData);
        // Calculate band energies using proper frequency ranges (Hz)
        // Bass: 20-250 Hz (kick drum, bass guitar, sub-bass)
        // Mid: 250-2000 Hz (vocals, guitars, piano - human ear most sensitive)
        // Treble: 2000-16000 Hz (cymbals, hi-hats, presence, air)
        const subBass = calcBandEnergyHz(freqData, 20, 60, safeFftSize);
        const bassMain = calcBandEnergyHz(freqData, 60, 250, safeFftSize);
        const lowMid = calcBandEnergyHz(freqData, 250, 500, safeFftSize);
        const midMain = calcBandEnergyHz(freqData, 500, 2000, safeFftSize);
        const highMid = calcBandEnergyHz(freqData, 2000, 4000, safeFftSize);
        const trebleMain = calcBandEnergyHz(freqData, 4000, 12000, safeFftSize);
        const air = calcBandEnergyHz(freqData, 12000, 20000, safeFftSize);
        
        // Combine into main bands with user sensitivity settings
        bass = (subBass * 1.2 + bassMain) / 2 * bassBoost;
        mid = (lowMid * 0.7 + midMain * 1.0 + highMid * 0.8) / 2.5 * midSensitivity;
        treble = (trebleMain + air * 0.6) / 1.6 * trebleSensitivity;
        
        // Weighted energy favoring mid frequencies (human hearing sensitivity)
        energy = (bass * 0.8 + mid * 1.2 + treble * 0.7) / 2.7;
      }

      drawBackground(ctx, width, height, settings, backgroundImageRef.current, tickRef.current, energy, particleSpeed);

      if (!analyser) {
        rafRef.current = window.requestAnimationFrame(draw);
        return;
      }

      const rawBars = sampleBars(freqData, barCount);
      if (smoothedBarsRef.current.length !== rawBars.length) {
        smoothedBarsRef.current = [...rawBars];
      }
      const smoothed = rawBars.map((value, i) => {
        const prev = smoothedBarsRef.current[i] ?? value;
        const next = prev * energySmoothing + value * (1 - energySmoothing);
        smoothedBarsRef.current[i] = next;
        return next;
      });

      const transient = Math.max(0, energy - prevEnergyRef.current);
      prevEnergyRef.current = energy * 0.8 + prevEnergyRef.current * 0.2;
      const beatGate = Math.max(0, transient / 255) * beatSensitivity;
      beatPulseRef.current = Math.max(beatPulseRef.current * 0.9, beatGate * transientBoost);

      const bars = smoothed.map((v, i) => {
        const edge = (i / Math.max(1, smoothed.length - 1)) * 2 - 1;
        const spreadBoost = 1 + Math.abs(edge) * stereoSpread * 0.7;
        const tiltBoost = 1 + edge * spectralTilt * 0.35;
        const beatBoost = 1 + beatPulseRef.current * 0.35;
        const boosted = v * pulseIntensity * spreadBoost * tiltBoost * beatBoost;
        const normalized = Math.max(0.02, (boosted / 255) * reactivity);
        return Math.min(255, Math.pow(normalized, 0.82) * 255);
      });

      // Extract colors from thumbnail if enabled (uses ref that resets on song change)
      if (settings.autoExtractColor && imageRef.current && !extractedColorsRef.current) {
        extractedColorsRef.current = extractDominantColor(imageRef.current);
      }
      
      // Use extracted colors if available and enabled, otherwise use settings
      const useExtracted = settings.autoExtractColor && extractedColorsRef.current;
      const primaryColor = useExtracted ? extractedColorsRef.current.primary : (settings.primaryColor || '#22d3ee');
      const secondaryColor = useExtracted ? extractedColorsRef.current.secondary : (settings.secondaryColor || '#06b6d4');

      const payload = {
        bars,
        width,
        height,
        bass,
        mid,
        treble,
        energy,
        glowIntensity: glowIntensity * glowSpread,
        primaryColor,
        secondaryColor,
        thumb: settings.showAlbumArt !== false ? imageRef.current : null,
        tick: tickRef.current,
        barWidthScale,
        barGapScale,
        barRoundness,
        barHeightScale,
        mirrorEffect,
        vinylScale,
        vinylSpinSpeed,
        reflectionOpacity,
        barOpacityMin,
        barOpacityMax,
        artBorderRadius: clamp(settings.artBorderRadius, 0, 50, 18),
        bloomStrength: glowSpread,
        trailStrength,
        beatPulse: beatPulseRef.current,
      };

      switch (normalizedStyle) {
        case 'round-base':
          drawRoundBase(ctx, payload);
          break;
        case 'semicircular':
          drawSemicircularVinylWrap(ctx, payload);
          break;
        case 'semi-arc':
          drawSemiArc(ctx, payload);
          break;
        case 'dual-mirrored':
          drawDualMirroredBars(ctx, payload);
          break;
        case 'cover-art':
          drawCoverArtBars(ctx, payload);
          break;
        case 'stacked-pillars':
          drawStackedPillars(ctx, payload);
          break;
        case 'horizon-tower':
          drawHorizonTower(ctx, payload);
          break;
        case 'pulse-frame':
          drawPulseFrame(ctx, payload);
          break;
        case 'spectral-ribbon':
          drawSpectralRibbon(ctx, payload);
          break;
        case 'saturn-ring':
          drawSaturnRing(ctx, payload);
          break;
        case 'kaleido-orbit':
          drawKaleidoOrbit(ctx, payload);
          break;
        case 'diagonal-drift':
          drawDiagonalDrift(ctx, payload);
          break;
        case 'bar':
        default:
          drawBar(ctx, payload);
          break;
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    rafRef.current = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [analyser, normalizedStyle, settings]);

  return <canvas ref={canvasRef} className="w-full h-full block" aria-label="Reactive music visualizer" />;
}
