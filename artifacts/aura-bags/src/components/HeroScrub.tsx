import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getProductFrames, type Product } from '@/data/products';

gsap.registerPlugin(ScrollTrigger);

type HeroScrubProps = { product: Product };

export function HeroScrub({ product }: HeroScrubProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frames = useMemo(() => getProductFrames(product), [product]);
  const [sequenceReady, setSequenceReady] = useState(false);
  const [frame, setFrame] = useState(0);
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
    let cancelled = false;
    const images: HTMLImageElement[] = [];
    const timeouts: number[] = [];
    setSequenceReady(false);
    setFrame(0);

    if (reducedMotion) return;

    let settled = 0;
    let failed = false;
    const finish = (success: boolean) => {
      if (cancelled) return;
      settled += 1;
      failed ||= !success;
      if (failed) {
        setSequenceReady(false);
        return;
      }
      if (settled === frames.length) setSequenceReady(true);
    };

    frames.forEach((src) => {
      const image = new Image();
      images.push(image);
      const timeout = window.setTimeout(() => finish(false), 20000);
      timeouts.push(timeout);
      let imageSettled = false;
      const complete = (success: boolean) => {
        if (imageSettled) return;
        imageSettled = true;
        window.clearTimeout(timeout);
        finish(success);
      };
      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().then(() => complete(true)).catch(() => complete(false));
        } else {
          complete(true);
        }
      };
      image.onerror = () => complete(false);
      image.src = src;
      if (image.complete && image.naturalWidth > 0) complete(true);
    });

    return () => {
      cancelled = true;
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      images.forEach((image) => {
        image.onload = null;
        image.onerror = null;
        image.src = '';
      });
    };
  }, [frames, reducedMotion]);

  useEffect(() => {
    if (!sequenceReady || reducedMotion || !sectionRef.current) return;
    const hero = sectionRef.current.closest<HTMLElement>('.hero');
    if (!hero) return;
    const playhead = { frame: 0 };
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
        },
      });
      timeline.to(playhead, {
        frame: frames.length - 1,
        ease: 'none',
        onUpdate: () => setFrame(Math.round(playhead.frame)),
      }, 0);
      timeline.to(sectionRef.current, {
        scale: () => window.innerWidth < 600 ? 1.4 : 1.68,
        transformOrigin: '73% 52%',
        ease: 'none',
      }, 0);
      const heroContent = hero.querySelector<HTMLElement>('.hero-content');
      if (heroContent) {
        timeline.to(heroContent, {
          x: () => window.innerWidth < 600 ? '-82vw' : '-70vw',
          opacity: 0,
          ease: 'none',
        }, 0.24);
      }
      const heroIndex = hero.querySelector<HTMLElement>('.hero-index');
      if (heroIndex) timeline.to(heroIndex, { opacity: 0, ease: 'none' }, 0.18);
    }, hero);
    ScrollTrigger.refresh();

    return () => context.revert();
  }, [frames, reducedMotion, sequenceReady]);

  return (
    <div ref={sectionRef} className={`hero-visual ${sequenceReady && !reducedMotion ? 'is-scrubbable' : ''}`}>
      <img
        ref={imageRef}
        className="hero-product-image"
        src={sequenceReady && !reducedMotion ? frames[frame] : product.image}
        alt={product.name}
        draggable={false}
        fetchPriority="high"
      />
      {sequenceReady && !reducedMotion && (
        <div className="hero-scrub-caption" aria-hidden="true">
          <span>SCROLL TO ROTATE · THE SLOANE</span>
          <span className="hero-frame-count">{String(frame + 1).padStart(2, '0')} / {frames.length}</span>
        </div>
      )}
    </div>
  );
}
