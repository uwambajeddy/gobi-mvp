"use client";

import { useEffect, useRef } from "react";

/** Depth layers, far to near: nearer drops are longer, faster, thicker and brighter. */
const LAYERS = [
  { share: 0.55, length: [10, 18], speed: [560, 720], width: 0.75, alpha: 0.16 },
  { share: 0.3, length: [20, 32], speed: [860, 1080], width: 1, alpha: 0.22 },
  { share: 0.15, length: [36, 56], speed: [1250, 1550], width: 1.35, alpha: 0.3 },
];

/** Drops per square CSS pixel, capped so big screens stay cheap. */
const DENSITY = 1 / 4200;
const MAX_DROPS = 420;

/** The photo's rain falls almost straight down; a slow gust sways it a little either side. */
const LEAN = -0.07;
const GUST = 0.035;

const COLOR = "214, 228, 245";

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
}

const between = ([min, max]: number[]) => min + Math.random() * (max - min);

/**
 * Animated rain over HERO_PHOTO, matching the rain already in it. Streaks
 * fall at three depths with a faint tail and a brighter head, and pause while
 * the hero is off screen. Nothing is drawn with reduced motion: the photo's
 * own rain is enough.
 */
export function HeroRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let width = 0;
    let height = 0;
    let layers: Drop[][] = [];

    // Drops drift left as they fall, so spawn them across the width plus that drift.
    const spawnX = () => between([0, width + height * (GUST - LEAN)]);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";

      const count = Math.min(MAX_DROPS, Math.round(width * height * DENSITY));
      layers = LAYERS.map((layer) =>
        Array.from({ length: Math.round(count * layer.share) }, () => ({
          x: spawnX(),
          y: Math.random() * height,
          length: between(layer.length),
          speed: between(layer.speed),
        })),
      );
    };

    let frame = 0;
    let last = 0;

    const draw = (now: number) => {
      // Clamp the step so a stalled frame doesn't teleport every drop.
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const wind = LEAN + GUST * Math.sin(now / 2800);

      ctx.clearRect(0, 0, width, height);
      layers.forEach((drops, i) => {
        const { width: lineWidth, alpha } = LAYERS[i];

        for (const drop of drops) {
          const dy = drop.speed * dt;
          drop.y += dy;
          drop.x += dy * wind;
          if (drop.y - drop.length > height) {
            drop.y = -Math.random() * height * 0.15;
            drop.x = spawnX();
          }
        }

        // Faint full-length tail, then a brighter head over its lower part.
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = `rgba(${COLOR}, ${alpha * 0.45})`;
        ctx.beginPath();
        for (const { x, y, length } of drops) {
          ctx.moveTo(x - length * wind, y - length);
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
        ctx.beginPath();
        for (const { x, y, length } of drops) {
          ctx.moveTo(x - length * 0.4 * wind, y - length * 0.4);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(draw);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    resize();
    const resizer = new ResizeObserver(resize);
    resizer.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    observer.observe(canvas);
    canvas.style.opacity = "1";

    return () => {
      stop();
      resizer.disconnect();
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0 transition-opacity duration-1000"
    />
  );
}
