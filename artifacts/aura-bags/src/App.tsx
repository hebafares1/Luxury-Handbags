import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Heart, Pause, Play, Plus, ShoppingBag, X } from 'lucide-react';
import * as THREE from 'three';

type Product = { id: number; name: string; price: number; image: string; color: string };
type CartItem = { key: number; id: number; name: string; price: number };

const products: Product[] = [
  { id: 1, name: 'The Sloane', price: 485, image: '/bag-1.jpg', color: '#773832' },
  { id: 2, name: 'The Solenne', price: 520, image: '/bag-2.jpg', color: '#797b67' },
  { id: 3, name: 'The Marais', price: 445, image: '/bag-3.jpg', color: '#9b6037' },
  { id: 4, name: 'The No. 8', price: 560, image: '/bag-4.jpg', color: '#242323' },
  { id: 5, name: 'The Alba', price: 395, image: '/bag-5.jpg', color: '#b67d79' },
  { id: 6, name: 'The Liora', price: 610, image: '/bag-6.jpg', color: '#d4c6ae' },
];
const palette = [
  { name: 'Oxblood', color: '#773832' },
  { name: 'Olive', color: '#797b67' },
  { name: 'Cognac', color: '#9b6037' },
  { name: 'Black', color: '#242323' },
  { name: 'Rose', color: '#b67d79' },
  { name: 'Ivory', color: '#d4c6ae' },
];
const money = (price: number) => `$${price.toLocaleString('en-US')}`;

function readStorage<T,>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function ViewerBag({ color, rotation }: { color: string; rotation: number }) {
  const host = useRef<HTMLDivElement>(null);
  const model = useRef<THREE.Group | null>(null);
  const leather = useRef<THREE.MeshStandardMaterial | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    camera.position.set(0, .5, 7.2);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.current.clientWidth, host.current.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.current.appendChild(renderer.domElement);
    const group = new THREE.Group();
    scene.add(group);
    model.current = group;

    const leatherMaterial = new THREE.MeshStandardMaterial({ color, roughness: .38, metalness: .02 });
    leather.current = leatherMaterial;
    const gold = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: .72, roughness: .24 });
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-1.25, .72);
    bodyShape.quadraticCurveTo(-1.27, .84, -1.1, .82);
    bodyShape.lineTo(1.1, .82);
    bodyShape.quadraticCurveTo(1.27, .84, 1.25, .65);
    bodyShape.lineTo(1.12, -1.06);
    bodyShape.quadraticCurveTo(0, -1.36, -1.12, -1.06);
    bodyShape.closePath();
    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, { depth: .52, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: .075, bevelThickness: .08, curveSegments: 16 });
    bodyGeometry.center();
    const body = new THREE.Mesh(bodyGeometry, leatherMaterial);
    group.add(body);
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.66, .56, .1), new THREE.Vector3(-.66, 1.55, .12),
      new THREE.Vector3(0, 1.93, .12), new THREE.Vector3(.66, 1.55, .12),
      new THREE.Vector3(.66, .56, .1),
    ]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 48, .075, 10, false), leatherMaterial);
    group.add(handle);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(1.57, .42, .09), leatherMaterial);
    flap.position.set(0, .42, .31);
    group.add(flap);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(.22, .28, .045), gold);
    clasp.position.set(0, .17, .39);
    group.add(clasp);
    const inset = new THREE.Mesh(new THREE.BoxGeometry(.12, .17, .025), leatherMaterial);
    inset.position.set(0, .17, .419);
    group.add(inset);
    const leftRing = new THREE.Mesh(new THREE.TorusGeometry(.09, .025, 8, 24), gold);
    leftRing.position.set(-.84, .65, .31);
    leftRing.rotation.y = Math.PI / 2;
    group.add(leftRing);
    const rightRing = leftRing.clone();
    rightRing.position.x = .84;
    group.add(rightRing);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(2.16, .018, .015), gold);
    seam.position.set(0, -.63, .32);
    seam.material = gold.clone();
    (seam.material as THREE.MeshStandardMaterial).transparent = true;
    (seam.material as THREE.MeshStandardMaterial).opacity = .55;
    group.add(seam);

    scene.add(new THREE.HemisphereLight('#fff6e8', '#887360', 2.05));
    const key = new THREE.DirectionalLight('#fff5dc', 3.2);
    key.position.set(-3, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#d8b67d', 2.1);
    rim.position.set(4, 2, -4);
    scene.add(rim);
    let frame = 0;
    const render = () => { renderer.render(scene, camera); frame = requestAnimationFrame(render); };
    render();
    const resize = () => {
      if (!host.current) return;
      const width = host.current.clientWidth;
      const height = host.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      bodyGeometry.dispose();
      host.current?.replaceChildren();
      model.current = null;
      leather.current = null;
    };
    } catch {
      setWebglUnavailable(true);
      host.current?.replaceChildren();
      return undefined;
    }
  }, []);
  useEffect(() => {
    if (model.current) model.current.rotation.y = (rotation * Math.PI) / 180;
  }, [rotation]);
  useEffect(() => {
    leather.current?.color.set(color);
  }, [color]);
  if (webglUnavailable) {
    return (
      <div className="viewer-bag fallback-viewer" role="img" aria-label="Interactive handbag preview">
        <div className="fallback-handle" style={{ borderColor: color }} />
        <div className="fallback-purse" style={{ backgroundColor: color, transform: `rotateY(${rotation}deg)` }}>
          <span className="fallback-flap" />
          <span className="fallback-clasp" />
          <span className="fallback-seam" />
        </div>
      </div>
    );
  }
  return <div className="viewer-bag" ref={host} role="img" aria-label="Interactive 3D handbag model" />;
}

function App() {
  const [favorites, setFavorites] = useState<number[]>(() => readStorage('aura-favorites', []));
  const [cart, setCart] = useState<CartItem[]>(() => readStorage('aura-cart', []));
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState<Product>(products[0]);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [rotation, setRotation] = useState(0);
  const [swatch, setSwatch] = useState(palette[0]);
  const drag = useRef<{ x: number; rotation: number } | null>(null);

  useEffect(() => { localStorage.setItem('aura-favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('aura-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setRotation((value) => value + .35), 32);
    return () => window.clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => { if (event.key === 'Escape') setCartOpen(false); };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, []);

  const addToCart = (product: Product) => {
    setCart((items) => [...items, { key: Date.now() + Math.random(), id: product.id, name: product.name, price: product.price }]);
    setCartOpen(true);
  };
  const chooseProduct = (product: Product) => {
    setSelected(product);
    setSwatch(palette.find((shade) => shade.color === product.color) ?? palette[0]);
    setRotation(0);
    document.querySelector('#viewer')?.scrollIntoView({ behavior: 'smooth' });
  };
  const toggleFavorite = (id: number) => setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const rotateBy = (amount: number) => setRotation((value) => value + amount);
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <>
      <header className="nav-shell">
        <div className="nav-inner">
          <a href="#home" className="brand-mark" aria-label="AURA home">AURA</a>
          <nav className="nav-links" aria-label="Main navigation">
            <a href="#home">Home</a>
            <a href="#collection">Collection</a>
            <a href="#contact">Contact</a>
          </nav>
          <button className="nav-cart" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cart.length} items`}>
            <ShoppingBag size={16} strokeWidth={1.5} /><span>Bag</span><span className="cart-count">{cart.length}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-image" />
          <div className="hero-content">
            <h1>Carry<br /><em>Your Story</em></h1>
            <a className="hero-cta" href="#collection">Shop Now <ArrowUpRight size={15} strokeWidth={1.6} /></a>
          </div>
          <div className="hero-index">01 <span /> 06</div>
        </section>

        <section className="collection-section" id="collection">
          <div className="section-wrap">
            <div className="section-heading reveal">
              <h2 className="serif">Our Collection</h2>
            </div>
            <div className="product-grid">
              {products.map((product, index) => (
                <article className="product-card reveal" key={product.id} style={{ transitionDelay: `${(index % 3) * 80}ms` }}>
                  <div className="product-image-wrap">
                    <img className="product-image" src={product.image} alt={product.name} onClick={() => chooseProduct(product)} />
                    <button
                      className={`favorite ${favorites.includes(product.id) ? 'is-loved' : ''}`}
                      onClick={() => toggleFavorite(product.id)}
                      aria-label={favorites.includes(product.id) ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
                      aria-pressed={favorites.includes(product.id)}
                    ><Heart size={17} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} strokeWidth={1.5} /></button>
                  </div>
                  <div className="product-meta">
                    <span className="product-name" onClick={() => chooseProduct(product)}>{product.name}</span>
                    <span className="product-price">{money(product.price)}</span>
                  </div>
                  <button className="add-button" onClick={() => addToCart(product)}>Add to Cart <Plus size={14} strokeWidth={1.4} /></button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="viewer-section" id="viewer">
          <div className="section-wrap">
            <div className="viewer-heading reveal">
              <div><div className="eyebrow">A closer look</div><h2 className="serif">See It From<br />Every Angle</h2></div>
              <div className="viewer-label">Drag to explore&nbsp;&nbsp; · &nbsp;&nbsp;360°</div>
            </div>
            <div className="viewer-panel reveal">
              <div
                className="stage"
                onPointerDown={(event) => { drag.current = { x: event.clientX, rotation }; event.currentTarget.setPointerCapture(event.pointerId); setPlaying(false); }}
                onPointerMove={(event) => { if (drag.current) setRotation(drag.current.rotation + (event.clientX - drag.current.x) * .8); }}
                onPointerUp={() => { drag.current = null; }}
                onPointerCancel={() => { drag.current = null; }}
                aria-label="Drag to rotate handbag"
              >
                <ViewerBag color={swatch.color} rotation={rotation} />
                <div className="stage-caption">AURA / {selected.name.replace('The ', '')}</div>
                <div className="stage-controls">
                  <button className="round-control" onClick={() => rotateBy(-28)} aria-label="Rotate left"><ArrowLeft size={15} /></button>
                  <button className="round-control" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause auto rotation' : 'Play auto rotation'}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
                  <button className="round-control" onClick={() => rotateBy(28)} aria-label="Rotate right"><ArrowRight size={15} /></button>
                </div>
              </div>
              <aside className="viewer-details">
                <span className="detail-kicker">Selected piece</span>
                <h3>{selected.name}</h3>
                <span className="price">{money(selected.price)}</span>
                <span className="swatch-title">Color · {swatch.name}</span>
                <div className="swatches" role="group" aria-label="Choose bag color">
                  {palette.map((shade) => (
                    <button key={shade.name} className={`swatch ${swatch.name === shade.name ? 'selected' : ''}`} style={{ '--swatch': shade.color } as CSSProperties} onClick={() => setSwatch(shade)} aria-label={shade.name} aria-pressed={swatch.name === shade.name} />
                  ))}
                </div>
                <button className="viewer-add" onClick={() => addToCart(selected)}>Add to Cart <Plus size={15} /></button>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <footer className="contact-footer" id="contact">
        <a href="mailto:hello@aura-bags.com">Contact Us</a>
        <a className="email" href="mailto:hello@aura-bags.com">hello@aura-bags.com</a>
      </footer>

      <div className={`cart-backdrop ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} aria-hidden="true" />
      <aside className={`cart-drawer ${cartOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Your bag">
        <div className="drawer-head"><h2>Your Bag <span style={{ color: '#9b825d' }}>({cart.length})</span></h2><button className="drawer-close" onClick={() => setCartOpen(false)} aria-label="Close cart"><X size={20} /></button></div>
        <div className="drawer-items">
          {cart.length === 0 ? <div className="empty-cart">Your bag is waiting.</div> : cart.map((item) => (
            <div className="cart-row" key={item.key}>
              <span className="cart-row-name">{item.name}</span><span className="cart-row-price">{money(item.price)}</span>
              <button className="remove-item" onClick={() => setCart((items) => items.filter((entry) => entry.key !== item.key))} aria-label={`Remove ${item.name}`}><X size={16} /></button>
            </div>
          ))}
        </div>
        {cart.length > 0 && <div className="cart-total"><span>Subtotal</span><span>{money(total)}</span></div>}
      </aside>
    </>
  );
}

export default App;
