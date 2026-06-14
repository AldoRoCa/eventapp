/**
 * useParticleEngine.js
 * -----------------------------------------------------------------------
 * Owns the particle simulation state and the per-frame update logic.
 * Deliberately framework-light: all particle data lives in flat
 * Float32Array / Uint8Array buffers (structure-of-arrays), NOT an array
 * of objects. With 1800+ particles updated 60x/sec, avoiding 1800
 * object allocations & property lookups per frame is the difference
 * between a smooth 60fps and visible jank on mid-range phones.
 *
 * The engine itself is framework-agnostic (no React state). The
 * `useParticleEngine` hook just memoizes one engine instance per
 * (isMobile) value so it survives re-renders without being rebuilt.
 * -----------------------------------------------------------------------
 */

import { useMemo } from 'react';
import {
  MEXICO_DESKTOP,
  BOLT_DESKTOP,
  MEXICO_MOBILE,
  BOLT_MOBILE,
} from './particlePoints';
import { lerp, clamp, easeInOutCubic, createRng } from './particleUtils';

// --- Tunable animation constants -----------------------------------------

/** Max random stagger (in progress units) before a particle starts moving. */
const MAX_DELAY = 0.16;

/** Peak organic wobble amplitude during the transition (normalized units). */
const WOBBLE_AMOUNT = 0.045;

/** Ambient drift radius once the bolt has formed (normalized units). */
const AMBIENT_AMOUNT = 0.014;

/** Progress at which the "formed" breathing/twinkle effects fully kick in. */
export const FORMED_START = 0.9;

/** Progress at which ambient drift fully kicks in (slightly later than FORMED_START). */
export const AMBIENT_START = 0.97;

/** Number of small ambient/sparkle particles added on top of the main set. */
const AMBIENT_COUNT_DESKTOP = 70;
const AMBIENT_COUNT_MOBILE = 28;

/**
 * Builds the full particle buffer set for one device profile.
 *
 * @param {boolean} isMobile
 * @returns {import('./types').ParticleEngine}
 */
function buildEngine(isMobile) {
  const mexicoPoints = isMobile ? MEXICO_MOBILE : MEXICO_DESKTOP;
  const boltPoints = isMobile ? BOLT_MOBILE : BOLT_DESKTOP;

  const mainCount = mexicoPoints.length / 2;
  const ambientCount = isMobile ? AMBIENT_COUNT_MOBILE : AMBIENT_COUNT_DESKTOP;
  const count = mainCount + ambientCount;

  // Edge particles are the first ~35% of the main set (see generate-points.mjs:
  // they were sampled along the shape perimeter first, then the interior).
  const edgeCount = Math.round(mainCount * 0.35);

  // Base sizes: mobile particles are drawn larger to compensate for the
  // lower particle count, keeping perceived density/"glow coverage" similar
  // to desktop instead of looking sparse.
  const EDGE_SIZE_MIN = isMobile ? 0.0095 : 0.0062;
  const EDGE_SIZE_MAX = isMobile ? 0.015 : 0.0105;
  const FILL_SIZE_MIN = isMobile ? 0.0062 : 0.004;
  const FILL_SIZE_MAX = isMobile ? 0.0105 : 0.0072;

  const x0 = new Float32Array(count);
  const y0 = new Float32Array(count);
  const x1 = new Float32Array(count);
  const y1 = new Float32Array(count);
  const baseSize = new Float32Array(count);
  const baseOpacity = new Float32Array(count);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  const delay = new Float32Array(count);
  const appearAt = new Float32Array(count);
  const spriteIndex = new Uint8Array(count);

  // Output buffers (mutated every frame by update()).
  const cx = new Float32Array(count);
  const cy = new Float32Array(count);
  const outSize = new Float32Array(count);
  const opacity = new Float32Array(count);

  // Seeded RNG -> deterministic across reloads (no hydration mismatch,
  // no "the particles look different every time" inconsistency).
  const rng = createRng(isMobile ? 0xa11ce : 0xb0bcaf);

  for (let i = 0; i < mainCount; i++) {
    x0[i] = mexicoPoints[i * 2];
    y0[i] = mexicoPoints[i * 2 + 1];
    x1[i] = boltPoints[i * 2];
    y1[i] = boltPoints[i * 2 + 1];

    const isEdge = i < edgeCount;
    baseSize[i] = isEdge
      ? lerp(EDGE_SIZE_MIN, EDGE_SIZE_MAX, rng())
      : lerp(FILL_SIZE_MIN, FILL_SIZE_MAX, rng());

    baseOpacity[i] = isEdge ? lerp(0.55, 0.95, rng()) : lerp(0.3, 0.7, rng());
    phase[i] = rng() * Math.PI * 2;
    speed[i] = lerp(0.6, 1.4, rng());
    // Particles closer to the edge of the silhouette start moving slightly
    // earlier than interior particles -> the shape feels like it "peels"
    // into the bolt rather than every point sliding in lockstep.
    delay[i] = (isEdge ? rng() * 0.5 : rng()) * MAX_DELAY;
    appearAt[i] = 0; // visible from the start
    spriteIndex[i] = Math.floor(rng() * 3);
  }

  // Ambient sparkle particles: static-ish position near the bolt silhouette
  // (x0 === x1, so the lerp is a no-op), only fading in once the bolt has
  // mostly formed. Positions are sampled from the bolt point cloud itself
  // with a small random offset so they hover near the logo, not anywhere
  // on screen.
  for (let i = 0; i < ambientCount; i++) {
    const idx = i % mainCount;
    const offsetX = (rng() - 0.5) * 0.25;
    const offsetY = (rng() - 0.5) * 0.25;
    const gi = mainCount + i;

    const px = boltPoints[idx * 2] + offsetX;
    const py = boltPoints[idx * 2 + 1] + offsetY;

    x0[gi] = px;
    y0[gi] = py;
    x1[gi] = px;
    y1[gi] = py;

    baseSize[gi] = lerp(0.003, 0.0065, rng());
    baseOpacity[gi] = lerp(0.15, 0.45, rng());
    phase[gi] = rng() * Math.PI * 2;
    speed[gi] = lerp(0.4, 1.0, rng());
    delay[gi] = 0;
    appearAt[gi] = lerp(0.82, 0.95, rng());
    spriteIndex[gi] = Math.floor(rng() * 3);
  }

  /**
   * Per-frame update. Mutates cx/cy/outSize/opacity in place.
   * Pure math, no allocations — safe to call every rAF tick.
   *
   * @param {number} progress - scroll progress, 0 (Mexico) to 1 (Bolt)
   * @param {number} elapsedMs - elapsed time in ms (performance.now() based)
   */
  function update(progress, elapsedMs) {
    const formedStrength = clamp((progress - FORMED_START) / (1 - FORMED_START), 0, 1);
    const ambientStrength = clamp((progress - AMBIENT_START) / (1 - AMBIENT_START), 0, 1);

    // Global "breathing" pulse applied to every particle's size once formed.
    // Slow (period ~5s) and subtle (+/-12%) so it reads as "alive" rather
    // than "blinking".
    const breathe = 1 + Math.sin(elapsedMs * 0.00125) * 0.12 * formedStrength;

    for (let i = 0; i < count; i++) {
      // --- Position -------------------------------------------------
      const localProgress = clamp((progress - delay[i]) / (1 - delay[i]), 0, 1);
      const eased = easeInOutCubic(localProgress);

      let px = lerp(x0[i], x1[i], eased);
      let py = lerp(y0[i], y1[i], eased);

      // Organic wobble: peaks mid-transition, vanishes at both ends so
      // particles land precisely on the bolt silhouette.
      const wobbleEnvelope = Math.sin(eased * Math.PI);
      if (wobbleEnvelope > 0.001) {
        px += Math.sin(elapsedMs * 0.0011 * speed[i] + phase[i]) * WOBBLE_AMOUNT * wobbleEnvelope;
        py += Math.cos(elapsedMs * 0.0013 * speed[i] + phase[i] * 1.7) * WOBBLE_AMOUNT * wobbleEnvelope;
      }

      // Ambient drift once formed.
      if (ambientStrength > 0.001) {
        px += Math.sin(elapsedMs * 0.00042 + phase[i]) * AMBIENT_AMOUNT * ambientStrength;
        py += Math.cos(elapsedMs * 0.00035 + phase[i] * 1.3) * AMBIENT_AMOUNT * ambientStrength;
      }

      cx[i] = px;
      cy[i] = py;

      // --- Size --------------------------------------------------------
      outSize[i] = baseSize[i] * breathe;

      // --- Opacity -------------------------------------------------------
      let fadeIn = 1;
      if (appearAt[i] > 0) {
        fadeIn = clamp((progress - appearAt[i]) / (1 - appearAt[i]), 0, 1);
      }

      // Twinkle: gentle per-particle flicker once formed.
      const twinkle = 1 - 0.22 * formedStrength * (0.5 + 0.5 * Math.sin(elapsedMs * 0.0021 * speed[i] + phase[i] * 2.1));

      opacity[i] = baseOpacity[i] * fadeIn * twinkle;
    }
  }

  return {
    count,
    cx,
    cy,
    size: outSize,
    opacity,
    spriteIndex,
    update,
  };
}

/**
 * React hook wrapper: returns a memoized particle engine for the given
 * device profile. The engine is rebuilt only if `isMobile` changes
 * (e.g. on viewport resize across the mobile breakpoint).
 *
 * @param {boolean} isMobile
 * @returns {import('./types').ParticleEngine}
 */
export { buildEngine };

export function useParticleEngine(isMobile) {
  return useMemo(() => buildEngine(isMobile), [isMobile]);
}
