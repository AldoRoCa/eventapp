/**
 * types.js
 * -----------------------------------------------------------------------
 * This project is plain JSX (not TypeScript) — matching the rest of the
 * VELA codebase, which is a Vite + React JS project (no tsconfig, no .tsx
 * anywhere). Converting just this feature to TypeScript would require
 * adding a parallel TS toolchain, which risks breaking the existing build.
 *
 * Instead, this file documents the data shapes used across the particle
 * hero system via JSDoc typedefs. Editors (VS Code) pick these up
 * automatically for autocomplete/type-checking on hover, giving most of
 * the safety benefits of TS without touching the build config.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} ParticleEngine
 * @property {Float32Array} cx - current x position per particle, normalized [-1, 1]
 * @property {Float32Array} cy - current y position per particle, normalized [-1, 1]
 * @property {Float32Array} size - current rendered radius per particle, in normalized units
 * @property {Float32Array} opacity - current opacity per particle [0, 1]
 * @property {Uint8Array} spriteIndex - which glow sprite (0-2) to draw for this particle
 * @property {number} count - total number of particles
 * @property {(progress: number, elapsedMs: number) => void} update -
 *   mutates cx/cy/size/opacity in place for the given scroll progress (0-1)
 *   and elapsed time in milliseconds (used for breathing/twinkle animation).
 */

/**
 * @typedef {Object} ScrollAnimationHandle
 * @property {React.MutableRefObject<number>} progressRef -
 *   current scroll progress (0-1), updated every scroll/rAF tick.
 *   Read this inside the render loop; do NOT use it to trigger React renders.
 * @property {boolean} isComplete - true once progress has reached ~1 and
 *   stayed there (used to reveal the overlay hero content). This DOES
 *   trigger a re-render (it's backed by useState) since it changes rarely.
 * @property {boolean} reducedMotion - true if the user has
 *   prefers-reduced-motion enabled. When true, the animation is skipped
 *   entirely and the formed state is shown immediately.
 */

/**
 * @typedef {Object} ProjectionConfig
 * @property {number} width - canvas width in CSS pixels
 * @property {number} height - canvas height in CSS pixels
 * @property {number} scale - px per normalized unit (maps [-1,1] -> px)
 * @property {number} originX - x offset in px for the [0,0] normalized point
 * @property {number} originY - y offset in px for the [0,0] normalized point
 */

export {};
