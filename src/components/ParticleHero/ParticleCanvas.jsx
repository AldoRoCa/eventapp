/**
 * ParticleCanvas.jsx
 * -----------------------------------------------------------------------
 * Render-only component. Owns the <canvas>, the rAF loop, and the
 * glow-sprite drawing technique.
 *
 * RENDERING TECHNIQUE (why it's fast):
 * Drawing 1800-2000 particles per frame with per-particle radial
 * gradients or `ctx.shadowBlur` would tank frame rate on mid-range
 * mobile GPUs — both are notoriously expensive in Canvas2D.
 *
 * Instead, we pre-render 3 small "glow sprite" canvases ONCE (radial
 * gradients baked to bitmaps), then every frame we just `drawImage()`
 * a scaled copy of one of those sprites per particle, with
 * `globalCompositeOperation = 'lighter'` so overlapping glows add up
 * into brighter cores — exactly the "glowing particle" look, at a tiny
 * fraction of the cost. `drawImage` is GPU-accelerated even in
 * Canvas2D, so this scales comfortably to thousands of sprites at 60fps.
 * -----------------------------------------------------------------------
 */

import { useEffect, useRef } from 'react';
import { computeProjection, project, clamp } from './particleUtils';
import { FORMED_START } from './useParticleEngine';

/** Sprite resolution in px. Small is fine — they're heavily scaled/blurred by nature. */
const SPRITE_SIZE = 64;

/** Glow sprite color variants (RGB triplets), matching VELA's brand purples. */
const SPRITE_COLORS = [
  [196, 181, 253], // light lavender (#c4b5fd)
  [167, 139, 250], // violet (#a78bfa) — primary brand accent
  [129, 140, 248], // indigo-blue (#818cf8)
];

/** Caps devicePixelRatio to avoid huge canvases on 3x+ phones / 4K monitors. */
function getDpr(isMobile) {
  const raw = window.devicePixelRatio || 1;
  return Math.min(raw, isMobile ? 1.5 : 2);
}

/** Builds one radial-gradient glow sprite as an offscreen canvas. */
function createGlowSprite([r, g, b]) {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  const center = SPRITE_SIZE / 2;
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.55)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

/**
 * @param {Object} props
 * @param {import('./types').ParticleEngine} props.engine
 * @param {React.MutableRefObject<number>} props.progressRef
 * @param {boolean} props.isMobile
 * @param {boolean} props.reducedMotion
 */
export default function ParticleCanvas({ engine, progressRef, isMobile, reducedMotion }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });

    // Pre-render the glow sprites once.
    const sprites = SPRITE_COLORS.map(createGlowSprite);

    // Projection is recomputed on resize and read every frame.
    let proj = computeProjection(canvas.clientWidth, canvas.clientHeight);
    let dpr = getDpr(isMobile);

    function resize() {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      dpr = getDpr(isMobile);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      proj = computeProjection(cssW, cssH);
    }
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // --- Pausa por visibilidad -----------------------------------------
    // En cuanto el usuario hace scroll más allá de esta sección (o cambia
    // de pestaña), no tiene sentido seguir calculando la física de 1800+
    // partículas y redibujando cada frame — solo consume CPU/GPU/batería
    // de una sección que nadie está viendo. Mantenemos la cadena de rAF
    // viva (es barata) pero saltamos todo el trabajo pesado mientras
    // cualquiera de las dos condiciones sea cierta.
    let isOnScreen = true;
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isOnScreen = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    intersectionObserver.observe(canvas);

    let isTabVisible = !document.hidden;
    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const tmp = [0, 0]; // reused scratch array for project() — avoids per-particle allocation

    let rafId;

    function frame(now) {
      if (!isOnScreen || !isTabVisible) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      const progress = reducedMotion ? 1 : progressRef.current;

      engine.update(progress, now);

      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      ctx.clearRect(0, 0, cssW, cssH);

      // --- Central ambient glow behind the formed bolt ----------------
      const formedStrength = clamp((progress - FORMED_START) / (1 - FORMED_START), 0, 1);
      if (formedStrength > 0.01) {
        const breathe = 1 + Math.sin(now * 0.0008) * 0.08;
        const glowRadius = proj.scale * 1.15 * breathe;
        const grad = ctx.createRadialGradient(
          proj.originX, proj.originY, 0,
          proj.originX, proj.originY, glowRadius
        );
        grad.addColorStop(0, `rgba(124, 58, 237, ${0.16 * formedStrength})`);
        grad.addColorStop(1, 'rgba(124, 58, 237, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      // --- Particles -----------------------------------------------------
      ctx.globalCompositeOperation = 'lighter';

      const { cx, cy, size, opacity, spriteIndex, count } = engine;
      for (let i = 0; i < count; i++) {
        const op = opacity[i];
        if (op <= 0.01) continue;

        project(cx[i], cy[i], proj, tmp);
        const r = size[i] * proj.scale;
        const d = r * 2;

        ctx.globalAlpha = op;
        ctx.drawImage(sprites[spriteIndex[i]], tmp[0] - r, tmp[1] - r, d, d);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // engine is stable for the lifetime of a given isMobile value (see
    // useParticleEngine), progressRef/canvasRef are refs (stable
    // identity), reducedMotion only changes once on mount.
  }, [engine, progressRef, isMobile, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
