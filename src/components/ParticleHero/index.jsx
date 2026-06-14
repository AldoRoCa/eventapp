/**
 * ParticleHero / index.jsx
 * -----------------------------------------------------------------------
 * Public entry point for the VELA particle hero.
 *
 * Usage in App.jsx (HomePage):
 *
 *   <ParticleHero>
 *     <h1>Descubre eventos cerca de ti</h1>
 *     <SearchBar ... />
 *   </ParticleHero>
 *
 * Behavior:
 * 1. On load, particles appear distributed across a silhouette of Mexico.
 * 2. As the user scrolls through this section (which is pinned), the
 *    particles morph into the VELA lightning-bolt logo.
 * 3. Once formed, the bolt gets a soft ambient glow, a slow "breathing"
 *    pulse, gentle per-particle twinkle, and small ambient sparkles.
 * 4. The `children` (hero title / search bar) fade in on top of the
 *    formed bolt, synced to the same scroll progress.
 * 5. After this section, the rest of the page (categories, events, etc.)
 *    continues normally below — no special handling needed there.
 * -----------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from 'react';
import ParticleCanvas from './ParticleCanvas';
import { useParticleEngine } from './useParticleEngine';
import { useScrollAnimation } from './useScrollAnimation';
import { clamp, easeOutCubic, lerp } from './particleUtils';

const MOBILE_BREAKPOINT = 768;

/** Progress at which the overlay content starts fading in. */
const OVERLAY_FADE_START = 0.62;

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - hero overlay content
 *   (title, subtitle, search bar). Rendered centered, fading in once the
 *   bolt has formed.
 * @param {string} [props.background] - optional CSS background for the
 *   pinned section. Defaults to transparent so the page's existing
 *   gradient background shows through.
 */
export default function ParticleHero({ children, background = 'transparent' }) {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const isMobile = useIsMobileViewport();

  const engine = useParticleEngine(isMobile);

  // Slower / shorter scroll-driven morph on mobile keeps the section from
  // feeling like it takes "forever" to scroll past on a small screen,
  // while still giving the animation room to breathe on desktop.
  const [scrollDistance, setScrollDistance] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight * (isMobile ? 1.0 : 1.3) : 800
  );
  useEffect(() => {
    setScrollDistance(window.innerHeight * (isMobile ? 1.0 : 1.3));
  }, [isMobile]);

  const { progressRef, reducedMotion } = useScrollAnimation(containerRef, { scrollDistance });

  // Drives the overlay (children) fade/translate every frame. Kept as a
  // direct DOM write (not React state) so it doesn't compete with the
  // particle rAF loop or cause re-renders 60x/sec.
  useEffect(() => {
    let rafId;

    function frame() {
      const progress = reducedMotion ? 1 : progressRef.current;
      const localProgress = clamp((progress - OVERLAY_FADE_START) / (1 - OVERLAY_FADE_START), 0, 1);
      const eased = easeOutCubic(localProgress);

      const el = overlayRef.current;
      if (el) {
        el.style.opacity = String(eased);
        el.style.transform = `translateY(${lerp(28, 0, eased)}px)`;
        el.style.pointerEvents = eased > 0.5 ? 'auto' : 'none';
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [progressRef, reducedMotion]);

  return (
    <section
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background,
        zIndex: 1,
      }}
    >
      <ParticleCanvas
        engine={engine}
        progressRef={progressRef}
        isMobile={isMobile}
        reducedMotion={reducedMotion}
      />

      <div
        ref={overlayRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 24px',
          opacity: 0,
          pointerEvents: 'none',
          willChange: 'opacity, transform',
        }}
      >
        {children}
      </div>
    </section>
  );
}
