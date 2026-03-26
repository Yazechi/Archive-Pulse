import { useEffect, useMemo, useRef } from 'react';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const PALETTES = {
  aurora: { hue: 192, spread: 70 },
  sunset: { hue: 18, spread: 58 },
  mono: { hue: 205, spread: 8 },
};

export default function MiniBarVisualizer({ analyser, isPlaying, settings, accentColor }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const safeSettings = useMemo(() => ({
    intensity: clamp(settings?.intensity ?? 1, 0.3, 2),
    motion: clamp(settings?.motion ?? 1, 0.3, 2),
    bloom: clamp(settings?.bloom ?? 1, 0.2, 2),
    palette: settings?.palette || 'aurora',
  }), [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BAR_COUNT = 56;
    const MAX_FPS = 42;
    const FRAME_MS = 1000 / MAX_FPS;
    const freqBins = analyser?.frequencyBinCount || 512;
    const freqData = new Uint8Array(freqBins);
    const bars = new Float32Array(BAR_COUNT);
    const basePalette = PALETTES[safeSettings.palette] || PALETTES.aurora;
    const palette = {
      hue: accentColor?.hue ?? basePalette.hue,
      spread: basePalette.spread,
    };
    let pulse = 0;
    let playMix = 0;
    let lastTs = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    const drawRoundedRect = (x, y, w, h, r) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    const draw = (ts) => {
      rafRef.current = requestAnimationFrame(draw);
      if (document.hidden) return;
      if (ts - lastTs < FRAME_MS) return;
      lastTs = ts;

      const w = canvas.width;
      const h = canvas.height;
      const centerY = h * 0.5;

      if (analyser) analyser.getByteFrequencyData(freqData);

      let energy = 0;
      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.floor(((i / BAR_COUNT) ** 1.45) * Math.min(360, freqBins - 1));
        const raw = (freqData[idx] || 0) / 255;
        bars[i] += (raw - bars[i]) * 0.18;
        energy += bars[i];
      }
      energy /= BAR_COUNT;
      pulse = pulse * 0.82 + energy * 0.18;
      playMix += ((isPlaying ? 1 : 0) - playMix) * 0.08;

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, 'rgba(10, 24, 38, 0.24)');
      bg.addColorStop(0.5, 'rgba(18, 18, 34, 0.18)');
      bg.addColorStop(1, 'rgba(36, 18, 22, 0.2)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = `rgba(255,255,255,${0.08 + pulse * 0.12})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();

      const gap = 2;
      const barW = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      const maxH = h * 0.4;

      for (let i = 0; i < BAR_COUNT; i++) {
        const t = i / BAR_COUNT;
        const v = isPlaying
          ? bars[i]
          : 0.05 + Math.sin(ts * 0.002 * safeSettings.motion + i * 0.34) * 0.012;
        const barH = Math.max(2, v * maxH * (0.35 + playMix * 1.1) * safeSettings.intensity);
        const x = i * (barW + gap);

        const hue = palette.hue + Math.sin(t * Math.PI * 2) * palette.spread;
        const grad = ctx.createLinearGradient(0, centerY - barH, 0, centerY + barH);
        grad.addColorStop(0, `hsla(${hue}, 92%, 72%, ${0.28 + v * 0.58})`);
        grad.addColorStop(0.5, `hsla(${hue + 26}, 88%, 68%, ${0.18 + v * 0.54})`);
        grad.addColorStop(1, `hsla(${hue}, 92%, 72%, ${0.28 + v * 0.58})`);

        ctx.fillStyle = grad;
        ctx.shadowBlur = (6 + v * 12) * safeSettings.bloom;
        ctx.shadowColor = `hsla(${hue}, 95%, 74%, ${0.2 + v * 0.34})`;

        drawRoundedRect(x, centerY - barH, barW, barH, Math.min(2.4, barW * 0.45));
        ctx.fill();
        drawRoundedRect(x, centerY, barW, barH, Math.min(2.4, barW * 0.45));
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    };

    draw(0);
    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObs.disconnect();
    };
  }, [analyser, isPlaying, safeSettings]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-70" />;
}
