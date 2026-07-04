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
  // Leídos una sola vez al montar (mismo patrón que useIsMobileViewport en
  // index.jsx) en vez de vía setState dentro de un efecto — matchMedia no
  // cambia de valor sin recargar la página, así que no necesita un
  // listener de 'change'. isComplete arranca en true directamente cuando
  // hay preferencia de movimiento reducido, sin pasar por el efecto.
  const [reducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [isComplete, setIsComplete] = useState(() => reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      // Skip the scroll-jacked morph entirely. Land directly on the
      // formed bolt; isComplete ya arrancó en true (arriba).
      progressRef.current = 1;
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: () => `+=${scrollDistance}`,
      pin: true,
      // Helps GSAP "anticipate" reaching the pin boundary on fast
      // scrolls/trackpad flicks, reducing the small visual snap that can
      // otherwise occur right as the section pins/unpins.
      anticipatePin: 1,
      // scrub: true ata el progreso DIRECTAMENTE a la posición de
      // scroll (sin un tween de suavizado independiente). Un scrub
      // numérico (ej. 0.4) seguía "reajustándose" en micro-incrementos
      // de sub-píxel incluso con el scroll detenido, lo cual hacía
      // "temblar" el texto por el antialiasing de las fuentes.
      scrub: true,
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
  }, [containerRef, scrollDistance, reducedMotion]);

  return { progressRef, isComplete, reducedMotion };
}
