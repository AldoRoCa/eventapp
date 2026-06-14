/**
 * useScrollAnimation.js
 * -----------------------------------------------------------------------
 * Wires up a single GSAP ScrollTrigger that pins the hero section and
 * exposes scroll progress (0 -> 1) as a ref for the render loop to read.
 *
 * Design notes:
 * - progressRef is a plain mutable ref, NOT React state. ScrollTrigger
 *   fires onUpdate on every scroll tick (potentially many times per
 *   frame on fast trackpads); routing that through setState would cause
 *   a React re-render storm. The rAF loop in ParticleCanvas reads
 *   progressRef.current directly instead.
 * - `isComplete` IS React state, but only flips false -> true once,
 *   when progress first reaches ~0.98. This is what reveals the overlay
 *   hero content (title/search bar). It intentionally does not flip
 *   back to false on scroll-up, to avoid the content flickering in/out
 *   if the user scrolls back and forth near the boundary.
 * - Respects `prefers-reduced-motion`: if set, no ScrollTrigger/pin is
 *   created at all. progress is pinned at 1 (the formed bolt with its
 *   breathing/ambient effects, which are gentle and not flash-based) and
 *   the overlay content is shown immediately.
 * -----------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * @param {React.RefObject<HTMLElement>} containerRef - the element to pin
 * @param {Object} options
 * @param {number} options.scrollDistance - extra scroll distance (px) the
 *   pin lasts for. Larger = slower/more deliberate morph.
 * @returns {import('./types').ScrollAnimationHandle}
 */
export function useScrollAnimation(containerRef, { scrollDistance }) {
  const progressRef = useRef(0);
  const [isComplete, setIsComplete] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const prefersReduced = mql.matches;
    setReducedMotion(prefersReduced);

    if (prefersReduced) {
      // Skip the scroll-jacked morph entirely. Land directly on the
      // formed bolt and reveal the hero content right away.
      progressRef.current = 1;
      setIsComplete(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: () => `+=${scrollDistance}`,
      pin: true,
      pinType: 'transform',
      // A small scrub value smooths out jittery trackpad/scroll-wheel
      // input without introducing noticeable lag between scroll and
      // particle motion.
      scrub: 0.4,
      onUpdate: (self) => {
        progressRef.current = self.progress;
        if (self.progress >= 0.98) {
          // Calling setState(true) when state is already true is a
          // cheap no-op in React (bails out before re-render), so no
          // need to guard this with a ref/flag.
          setIsComplete(true);
        }
      },
    });

    return () => {
      trigger.kill();
    };
  }, [containerRef, scrollDistance]);

  return { progressRef, isComplete, reducedMotion };
}
