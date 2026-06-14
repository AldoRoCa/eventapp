/**
 * particleUtils.js
 * -----------------------------------------------------------------------
 * Small, allocation-free helper functions shared by the particle engine
 * and the canvas renderer. Kept dependency-free (no lodash/d3 at runtime)
 * so the hero loads as fast as possible.
 * -----------------------------------------------------------------------
 */

/** Linear interpolation between a and b by t (0-1). */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Clamp a value between min and max. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 * Cubic ease-in-out. Used to make the Mexico -> Bolt morph feel like it
 * accelerates out of the start and settles gently into the final shape,
 * instead of a robotic linear slide.
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Ease-out cubic. Used for the overlay content fade-in so it arrives
 * quickly and settles, rather than crawling in linearly at the end.
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Computes the projection from normalized particle space [-1, 1] to
 * canvas pixel space, fitting the shape inside the canvas with some
 * breathing room (margin) and keeping aspect ratio.
 *
 * @param {number} width - canvas CSS width in px
 * @param {number} height - canvas CSS height in px
 * @param {number} marginRatio - fraction of the smaller dimension to
 *   leave empty around the shape (e.g. 0.12 = 12% margin on each side)
 * @returns {import('./types').ProjectionConfig}
 */
export function computeProjection(width, height, marginRatio = 0.12) {
  const smaller = Math.min(width, height);
  const scale = (smaller * (1 - marginRatio * 2)) / 2; // /2 because normalized range is [-1, 1] -> span of 2
  return {
    width,
    height,
    scale,
    originX: width / 2,
    originY: height / 2,
  };
}

/**
 * Projects a normalized [-1, 1] coordinate pair into canvas pixel space.
 * Returns a 2-element array to avoid object allocation in hot loops
 * (caller should destructure or write directly into target arrays).
 */
export function project(x, y, proj, out) {
  out[0] = proj.originX + x * proj.scale;
  out[1] = proj.originY + y * proj.scale;
  return out;
}

/**
 * Seeded pseudo-random number generator (mulberry32). Using a seeded RNG
 * means the "random" per-particle variance (size, phase, delay) is
 * IDENTICAL on every page load and on server vs client — no hydration
 * mismatches, no "jumping" particles on refresh.
 */
export function createRng(seed) {
  let s = seed;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
