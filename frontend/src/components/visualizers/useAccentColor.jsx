import { useEffect, useState } from 'react';

const FALLBACK = { hue: 312, accentHue: 198 };
const CACHE = new Map();
const STORAGE_KEY = 'archive-accent-cache';
const SOURCES = ['dominant', 'vivid', 'dark', 'light'];

const readCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.entries(parsed).forEach(([key, value]) => CACHE.set(key, value));
  } catch (_e) {}
};

const writeCache = () => {
  try {
    const obj = Object.fromEntries(CACHE.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (_e) {}
};

readCache();

const makeKey = (imageUrl, source) => `${imageUrl}::${source}`;

export const extractAccentColor = (imageUrl, source = 'dominant') => new Promise((resolve) => {
  const sourceMode = SOURCES.includes(source) ? source : 'dominant';
  const cacheKey = makeKey(imageUrl, sourceMode);
  if (!imageUrl) return resolve(FALLBACK);
  if (CACHE.has(cacheKey)) return resolve(CACHE.get(cacheKey));

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        CACHE.set(imageUrl, FALLBACK);
        writeCache();
        return resolve(FALLBACK);
      }

      const size = 24;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const { data } = ctx.getImageData(0, 0, size, size);
      const buckets = new Array(18).fill(0).map(() => ({ weight: 0, sat: 0, val: 0, vivid: 0, dark: 0, light: 0 }));

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        if (max < 0.16) continue;

        let h = 0;
        if (d !== 0) {
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            default: h = ((r - g) / d + 4) / 6; break;
          }
        }
        const s = max === 0 ? 0 : d / max;
        if (s < 0.22) continue;
        const hue = h * 360;
        const bucketIndex = Math.min(17, Math.floor(hue / 20));
        const vividness = (s ** 2.2) * (0.45 + max * 0.55);
        const weight = vividness * (0.7 + s * 0.3);
        buckets[bucketIndex].weight += weight;
        buckets[bucketIndex].sat += s;
        buckets[bucketIndex].val += max;
        buckets[bucketIndex].vivid += vividness;
        buckets[bucketIndex].dark += vividness * (1 - max);
        buckets[bucketIndex].light += vividness * max;
      }

      const scoreBucket = (bucket) => {
        if (sourceMode === 'vivid') return bucket.vivid;
        if (sourceMode === 'dark') return bucket.dark;
        if (sourceMode === 'light') return bucket.light;
        return bucket.weight;
      };

      const winner = buckets.reduce((best, bucket, index) => {
        const score = scoreBucket(bucket);
        const bestScore = scoreBucket(best);
        return score > bestScore || (score === bestScore && bucket.vivid > best.vivid)
          ? { ...bucket, index }
          : best;
      }, { weight: 0, sat: 0, val: 0, vivid: 0, dark: 0, light: 0, index: -1 });

      const baseHue = winner.index * 20 + 10;
      const next = winner.index === -1 || winner.weight <= 0
        ? FALLBACK
        : sourceMode === 'vivid'
          ? { hue: (baseHue + 18) % 360, accentHue: (baseHue + 72) % 360 }
          : sourceMode === 'dark'
            ? { hue: (baseHue + 210) % 360, accentHue: (baseHue + 260) % 360 }
            : sourceMode === 'light'
              ? { hue: (baseHue + 330) % 360, accentHue: (baseHue + 24) % 360 }
              : {
                  hue: baseHue,
                  accentHue: (baseHue + 42) % 360,
                };

      CACHE.set(cacheKey, next);
      writeCache();
      resolve(next);
    } catch (_e) {
      CACHE.set(cacheKey, FALLBACK);
      writeCache();
      resolve(FALLBACK);
    }
  };

  img.onerror = () => {
    CACHE.set(cacheKey, FALLBACK);
    writeCache();
    resolve(FALLBACK);
  };

  img.src = imageUrl;
});

export default function useAccentColor(imageUrl, source = 'dominant') {
  const sourceMode = SOURCES.includes(source) ? source : 'dominant';
  const cacheKey = imageUrl ? makeKey(imageUrl, sourceMode) : null;
  const [accent, setAccent] = useState(() => (cacheKey && CACHE.get(cacheKey)) || FALLBACK);

  useEffect(() => {
    if (!imageUrl) {
      setAccent(FALLBACK);
      return;
    }
    if (cacheKey && CACHE.has(cacheKey)) {
      setAccent(CACHE.get(cacheKey));
    }
    let cancelled = false;
    extractAccentColor(imageUrl, sourceMode).then((next) => {
      if (!cancelled) setAccent(next);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, sourceMode, cacheKey]);

  return accent;
}
