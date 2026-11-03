import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle, Pause, Play, RefreshCw } from 'lucide-react';
import { getProductFrames, type Product } from '@/data/products';

const wrapFrame = (frame: number, count: number) => ((frame % count) + count) % count;

export function ProductImageViewer({ product }: { product: Product }) {
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [frame, setFrame] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const frames = useMemo(() => getProductFrames(product), [product]);
  const preloadedImages = useRef<HTMLImageElement[]>([]);
  const drag = useRef<{ x: number; frame: number; pointerId: number } | null>(null);
  const ready = loaded === frames.length && !failed;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setLoaded(0);
    setFailed(false);
    setFrame(0);
    preloadedImages.current = frames.map((src) => {
      const image = new Image();
      let settled = false;
      const complete = (success: boolean) => {
        if (settled || cancelled) return;
        settled = true;
        clearTimeout(timer);
        if (success) setLoaded((count) => count + 1);
        else setFailed(true);
      };
      const timer = setTimeout(() => complete(false), 45000);
      timers.push(timer);
      image.onload = () => {
        image.decode().then(() => complete(true)).catch(() => complete(false));
      };
      image.onerror = () => complete(false);
      image.src = src;
      return image;
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      preloadedImages.current.forEach((image) => {
        image.onload = null;
        image.onerror = null;
        image.src = '';
      });
      preloadedImages.current = [];
    };
  }, [frames, retry]);

  useEffect(() => {
    if (!playing || !ready || dragging) return;
    const timer = window.setInterval(() => {
      setFrame((current) => wrapFrame(current + 1, frames.length));
    }, 240);
    return () => window.clearInterval(timer);
  }, [playing, ready, dragging, frames.length]);

  const release = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
  };

  const step = (amount: number) => {
    if (!ready) return;
    setPlaying(false);
    setFrame((current) => wrapFrame(current + amount, frames.length));
  };

  return (
    <div className="stage">
      <div
        className={`viewer-image-interaction ${dragging ? 'is-dragging' : ''}`}
        tabIndex={0}
        role="group"
        aria-label={`${product.name} 360 degree view. Drag left or right, or use the arrow keys to rotate.`}
        aria-busy={!ready && !failed}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            step(event.key === 'ArrowLeft' ? -1 : 1);
          } else if (event.key === 'Home') {
            event.preventDefault();
            setPlaying(false);
            setFrame(0);
          } else if (event.key === ' ' && ready) {
            event.preventDefault();
            setPlaying((value) => !value);
          }
        }}
        onPointerDown={(event) => {
          if (!ready || !event.isPrimary || event.button !== 0) return;
          drag.current = { x: event.clientX, frame, pointerId: event.pointerId };
          setPlaying(false);
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointerId === event.pointerId) {
            setFrame(wrapFrame(drag.current.frame - Math.round((event.clientX - drag.current.x) / 10), frames.length));
          }
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <img
          className="viewer-product-image"
          src={ready ? frames[frame] : product.image}
          alt={`${product.name}, ${ready ? frame * 15 : 0} degree view`}
          draggable={false}
        />
      </div>
      {!ready && !failed && (
        <div className="sequence-loading" role="status">
          <span><LoaderCircle className="sequence-spinner" size={14} /> Loading 360° view · {loaded}/{frames.length}</span>
          <progress value={loaded} max={frames.length} aria-label="Loading rotation images" />
        </div>
      )}
      {failed && (
        <div className="sequence-error">
          <span role="alert">Couldn’t load all angles.</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={13} /> Retry</button>
        </div>
      )}
      <div className="stage-caption">ROSE / {product.name.replace('The ', '')} · AI views</div>
      {ready && <span className="sequence-frame-count" aria-label={`Frame ${frame + 1} of ${frames.length}`}>{String(frame + 1).padStart(2, '0')} / {frames.length}</span>}
      <div className="stage-controls">
        <button type="button" className="round-control" disabled={!ready} onClick={() => step(-1)} aria-label="Rotate left"><ArrowLeft size={15} /></button>
        <button type="button" className="round-control" disabled={!ready} onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause auto rotation' : 'Play auto rotation'} aria-pressed={playing}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button type="button" className="round-control" disabled={!ready} onClick={() => step(1)} aria-label="Rotate right"><ArrowRight size={15} /></button>
      </div>
    </div>
  );
}
