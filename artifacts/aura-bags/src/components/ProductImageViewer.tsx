import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import type { Product } from '@/data/products';

const clampTilt = (angle: number) => Math.max(-25, Math.min(25, angle));

export function ProductImageViewer({ product }: { product: Product }) {
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; rotation: number; pointerId: number } | null>(null);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let start: number | undefined;
    const sway = (time: number) => {
      start ??= time;
      setRotation(Math.sin((time - start) / 1600) * 7);
      frame = window.requestAnimationFrame(sway);
    };
    frame = window.requestAnimationFrame(sway);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const release = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    setRotation(0);
  };

  const rotateBy = (amount: number) => {
    setPlaying(false);
    setRotation((angle) => clampTilt(angle + amount));
  };

  return (
    <div className="stage">
      <div
        className={`viewer-image-interaction ${dragging ? 'is-dragging' : ''}`}
        tabIndex={0}
        role="group"
        aria-label={`${product.name} image preview. Drag left or right, or use the arrow keys to tilt.`}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            rotateBy(event.key === 'ArrowLeft' ? -12 : 12);
          } else if (event.key === 'Home') {
            event.preventDefault();
            setPlaying(false);
            setRotation(0);
          }
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          drag.current = { x: event.clientX, rotation, pointerId: event.pointerId };
          setPlaying(false);
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointerId === event.pointerId) {
            setRotation(clampTilt(drag.current.rotation + (event.clientX - drag.current.x) * .2));
          }
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span
          className="viewer-image-shadow"
          aria-hidden="true"
          style={{ transform: `translateX(${rotation * .8}px) scaleX(${1 - Math.abs(rotation) / 100})` }}
        />
        <img
          className="viewer-product-image"
          src={product.image}
          alt={product.name}
          draggable={false}
          style={{
            transform: `rotateX(${-Math.abs(rotation) * .08}deg) rotateY(${rotation}deg)`,
            transitionDuration: dragging || playing ? '0ms' : '650ms',
          }}
        />
      </div>
      <div className="stage-caption">ROSE / {product.name.replace('The ', '')}</div>
      <div className="stage-controls">
        <button type="button" className="round-control" onClick={() => rotateBy(-12)} aria-label="Rotate left"><ArrowLeft size={15} /></button>
        <button type="button" className="round-control" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause auto sway' : 'Play auto sway'} aria-pressed={playing}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button type="button" className="round-control" onClick={() => rotateBy(12)} aria-label="Rotate right"><ArrowRight size={15} /></button>
      </div>
    </div>
  );
}
