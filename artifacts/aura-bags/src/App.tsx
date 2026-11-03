import { useEffect, useState } from 'react';
import { ArrowUpRight, Heart, Plus, ShoppingBag, X } from 'lucide-react';
import { products, type Product } from '@/data/products';
import { ProductImageViewer } from '@/components/ProductImageViewer';

type CartItem = { key: number; id: number; name: string; price: number };
const money = (price: number) => `$${price.toLocaleString('en-US')}`;

function readStorage<T,>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [favorites, setFavorites] = useState<number[]>(() => readStorage('aura-favorites', []));
  const [cart, setCart] = useState<CartItem[]>(() => readStorage('aura-cart', []));
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState<Product>(products[0]);

  useEffect(() => { localStorage.setItem('aura-favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('aura-cart', JSON.stringify(cart)); }, [cart]);
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
    document.querySelector('#viewer')?.scrollIntoView({ behavior: 'smooth' });
  };
  const toggleFavorite = (id: number) => setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <>
      <header className="nav-shell">
        <div className="nav-inner">
          <a href="#home" className="brand-mark" aria-label="ROSE home">ROSE</a>
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
                <article className="product-card reveal" key={product.id} onClick={() => chooseProduct(product)} style={{ transitionDelay: `${(index % 3) * 80}ms` }}>
                  <div className="product-image-wrap">
                    <button type="button" className="product-preview" aria-label={`View ${product.name}`}>
                      <img className="product-image" src={product.image} alt={product.name} />
                    </button>
                    <button
                      className={`favorite ${favorites.includes(product.id) ? 'is-loved' : ''}`}
                      onClick={(event) => { event.stopPropagation(); toggleFavorite(product.id); }}
                      aria-label={favorites.includes(product.id) ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
                      aria-pressed={favorites.includes(product.id)}
                    ><Heart size={17} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} strokeWidth={1.5} /></button>
                  </div>
                  <div className="product-meta">
                    <span className="product-name">{product.name}</span>
                    <span className="product-price">{money(product.price)}</span>
                  </div>
                  <button className="add-button" onClick={(event) => { event.stopPropagation(); addToCart(product); }}>Add to Cart <Plus size={14} strokeWidth={1.4} /></button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="viewer-section" id="viewer">
          <div className="section-wrap">
            <div className="viewer-heading reveal">
              <div><div className="eyebrow">A closer look</div><h2 className="serif">See It From<br />Every Angle</h2></div>
              <div className="viewer-label">Drag to tilt</div>
            </div>
            <div className="viewer-panel reveal">
              <ProductImageViewer key={selected.id} product={selected} />
              <aside className="viewer-details">
                <span className="detail-kicker">Selected piece</span>
                <h3>{selected.name}</h3>
                <span className="price">{money(selected.price)}</span>
                <button className="viewer-add" onClick={() => addToCart(selected)}>Add to Cart <Plus size={15} /></button>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <footer className="contact-footer" id="contact">
        <a href="mailto:rose-bags@gmail.com">Contact Us</a>
        <a className="email" href="mailto:rose-bags@gmail.com">rose-bags@gmail.com</a>
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
