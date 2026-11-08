import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HeroScrub() {
  const imageRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    const hero = image?.closest<HTMLElement>('.hero');
    if (reducedMotion || !image || !hero) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: () => `+=${Math.max(window.innerHeight * 2.4, 1200)}`,
          scrub: 0.4,
          pin: hero,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const nextStep = Math.min(6, Math.floor(self.progress * 6) + 1);
            setStep((current) => current === nextStep ? current : nextStep);
          },
        },
      });
      timeline.to(image, {
        scale: () => window.innerWidth < 600 ? 1.18 : 1.32,
        transformOrigin: '73% 52%',
        ease: 'none',
      }, 0);
    }, hero);

    ScrollTrigger.refresh();
    return () => context.revert();
  }, [reducedMotion]);

  return (
    <>
      <div ref={imageRef} className="hero-image" aria-hidden="true" />
      {!reducedMotion && (
        <div className="hero-index" aria-hidden="true">
          <span className="hero-index-number">{String(step).padStart(2, '0')}</span>
          <span className="hero-index-rule" />
          <span className="hero-index-number">06</span>
        </div>
      )}
    </>
  );
}
