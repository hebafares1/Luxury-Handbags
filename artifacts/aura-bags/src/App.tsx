import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Check, Heart, Plus, ShoppingBag, X } from 'lucide-react';
import { getProducts } from '@workspace/api-client-react';
import { mapStoreProduct, type Product } from '@/data/products';
import { ProductImageViewer } from '@/components/ProductImageViewer';
import { HeroScrub } from '@/components/HeroScrub';
import { convertUsdToKwd, formatStorePrice } from '@/lib/currency';

type CartItem = { key: number; id: number; name: string; price: number };
type StoredCart = { currency: 'KWD'; items: CartItem[] };
const money = formatStorePrice;

function readStorage<T,>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function readCart(): CartItem[] {
  const stored = readStorage<unknown>('aura-cart', []);
  if (Array.isArray(stored)) {
    return (stored as CartItem[]).map((item) => ({
      ...item,
      price: convertUsdToKwd(item.price),
    }));
  }
  if (
    typeof stored === 'object' &&
    stored !== null &&
    'currency' in stored &&
    stored.currency === 'KWD' &&
    'items' in stored &&
    Array.isArray(stored.items)
  ) {
    return stored.items as CartItem[];
  }
  return [];
}

function App() {
  const [favorites, setFavorites] = useState<number[]>(() => readStorage('aura-favorites', []));
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All pieces');
  const [cartAnnouncement, setCartAnnouncement] = useState('');

  const categories = ['All pieces', ...new Set(products.map((product) => product.category).filter(Boolean))];
  const visibleProducts = activeCategory === 'All pieces'
    ? products
    : products.filter((product) => product.category === activeCategory);
  useEffect(() => { localStorage.setItem('aura-favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => {
    const storedCart: StoredCart = { currency: 'KWD', items: cart };
    localStorage.setItem('aura-cart', JSON.stringify(storedCart));
  }, [cart]);
  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(false);
    try {
      const items = (await getProducts()).map(mapStoreProduct);
      setProducts(items);
      setSelected((current) => items.find((item) => item.id === current?.id) ?? items[0] ?? null);
    } catch {
      setProductsError(true);
    } finally {
      setProductsLoading(false);
    }
  }, []);
  useEffect(() => { void loadProducts(); }, [loadProducts]);
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
  }, [products.length, activeCategory, productsLoading, productsError]);
  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => { if (event.key === 'Escape') setCartOpen(false); };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, []);

  const addToCart = (product: Product) => {
    setCart((items) => [...items, { key: Date.now() + Math.random(), id: product.id, name: product.name, price: product.price }]);
    setCartAnnouncement(`${product.name} added to your bag`);
    setCartOpen(true);
  };
  const scrollToSection = (selector: string) => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    document.querySelector(selector)?.scrollIntoView({ behavior });
  };
  const chooseProduct = (product: Product) => {
    setSelected(product);
    scrollToSection('#viewer');
  };
  const toggleFavorite = (id: number) => setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <>
      <header className="nav-shell">
        <div className="nav-inner">
          <a href="#home" className="brand-mark" aria-label="ROSE home" data-testid="link-home">ROSE</a>
          <nav className="nav-links" aria-label="Main navigation">
            <a href="#home" data-testid="link-nav-home">Home</a>
            <a href="#collection" data-testid="link-nav-collection">Collection</a>
            <a href="#contact" data-testid="link-nav-contact">Contact</a>
          </nav>
          <button className="nav-cart" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cart.length} items`} data-testid="button-open-cart">
            <ShoppingBag size={16} strokeWidth={1.5} /><span>Bag</span><span className="cart-count">{cart.length}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <HeroScrub />
          <div className="hero-content">
            <h1>Carry<br /><em>Your Story</em></h1>
            <a className="hero-cta" href="#collection" data-testid="link-shop-collection">Shop now <ArrowUpRight size={15} strokeWidth={1.6} /></a>
          </div>
        </section>

        <section className="collection-section" id="collection">
          <div className="section-wrap">
            <div className="section-heading reveal">
              <div><div className="eyebrow">Made to move with you</div><h2 className="serif">The collection<span className="heading-period">.</span></h2></div>
              <p className="collection-intro">Good things, carried daily.<br />Find the one that feels like yours.</p>
            </div>
            {!productsLoading && !productsError && products.length > 0 && (
              <div className="collection-toolbar" aria-label="Filter collection">
                <div className="category-list" role="group" aria-label="Product categories">
                  {categories.map((category) => (
                    <button type="button" key={category} className={`category-chip ${activeCategory === category ? 'is-active' : ''}`} onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category} data-testid={`filter-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                      {category}
                    </button>
                  ))}
                </div>
                <span className="result-count" data-testid="text-result-count">{String(visibleProducts.length).padStart(2, '0')} pieces</span>
              </div>
            )}
            <div className="product-grid">
              {productsLoading ? (
                <div className="collection-status" role="status">Loading the collection…</div>
              ) : productsError ? (
                <div className="collection-status" role="alert">
                  <span>We couldn’t load the collection.</span>
                  <button type="button" onClick={() => void loadProducts()}>Try again</button>
                </div>
              ) : products.length === 0 ? (
                <div className="collection-status" role="status">The collection is currently empty.</div>
              ) : visibleProducts.length === 0 ? (
                <div className="collection-status" role="status">No pieces in this edit yet.</div>
              ) : visibleProducts.map((product, index) => (
                  <article className="product-card reveal" key={product.id} onClick={() => chooseProduct(product)} style={{ transitionDelay: `${(index % 3) * 80}ms` }} data-testid={`card-product-${product.id}`}>
                    <div className="product-image-wrap">
                      <button type="button" className="product-preview" aria-label={`View ${product.name}`} onClick={(event) => { event.stopPropagation(); chooseProduct(product); }} data-testid={`button-view-product-${product.id}`}>
                        <img className="product-image" src={product.image} alt={product.name} />
                      </button>
                      <button
                        className={`favorite ${favorites.includes(product.id) ? 'is-loved' : ''}`}
                        onClick={(event) => { event.stopPropagation(); toggleFavorite(product.id); }}
                        aria-label={favorites.includes(product.id) ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
                        aria-pressed={favorites.includes(product.id)}
                        data-testid={`button-favorite-${product.id}`}
                      ><Heart size={17} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} strokeWidth={1.5} /></button>
                    </div>
                    <div className="product-meta">
                      <span className="product-name" data-testid={`text-product-name-${product.id}`}>{product.name}</span>
                      <span className="product-price" data-testid={`text-product-price-${product.id}`}>{money(product.price)}</span>
                    </div>
                    <p className="product-description">{product.description}</p>
                    <button className="add-button" onClick={(event) => { event.stopPropagation(); addToCart(product); }} data-testid={`button-add-product-${product.id}`}>Add to Bag <Plus size={14} strokeWidth={1.4} /></button>
                  </article>
                ))}
            </div>
          </div>
        </section>

        <section className="story-section" id="story">
          <div className="story-rail" aria-hidden="true">ROSE · A STUDY IN EVERYDAY</div>
          <div className="story-content reveal">
            <div className="eyebrow">A point of view, carried</div>
            <h2>Not another<br /><em>everyday bag.</em></h2>
            <p>ROSE is for the pieces you reach for without thinking—and still feel something when you do. Distinctive by design, made to find its place in your own everyday.</p>
            <a href="#collection" className="story-link" data-testid="link-story-discover">Find your ROSE <ArrowDown size={15} /></a>
          </div>
          <div className="story-note"><span>01 / 03</span><span>Style is personal.<br />Carry it that way.</span></div>
        </section>

        <section className="viewer-section" id="viewer">
          <div className="section-wrap">
            <div className="viewer-heading reveal">
              <div><div className="eyebrow">A closer look</div><h2 className="serif">See It From<br />Every Angle</h2></div>
              <div className="viewer-label">An object in motion · Drag to rotate</div>
            </div>
            <div className="viewer-panel reveal">
              {selected ? (
                <>
                  <ProductImageViewer key={selected.id} product={selected} />
                  <aside className="viewer-details">
                    <span className="detail-kicker">Selected piece</span>
                    <h3>{selected.name}</h3>
                    <span className="price">{money(selected.price)}</span>
                    <button className="viewer-add" onClick={() => addToCart(selected)} data-testid="button-add-selected">Add to Bag <Plus size={15} /></button>
                  </aside>
                </>
              ) : (
                <div className="viewer-status" role={productsError ? 'alert' : 'status'}>
                  {productsLoading ? 'Loading the collection…' : productsError ? 'Product details are unavailable.' : 'No products to display.'}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="contact-footer" id="contact">
        <a className="footer-brand" href="#home" data-testid="link-footer-home">ROSE</a>
        <span className="footer-note">Carry what feels like you.</span>
        <a href="mailto:rose-bags@gmail.com" data-testid="link-contact">Contact Us</a>
        <a className="email" href="mailto:rose-bags@gmail.com">rose-bags@gmail.com</a>
      </footer>

      <div className={`cart-backdrop ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} aria-hidden="true" />
      <aside className={`cart-drawer ${cartOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Your bag" aria-hidden={!cartOpen}>
        <div className="drawer-head"><h2>Your Bag <span style={{ color: '#9b825d' }}>({cart.length})</span></h2><button className="drawer-close" onClick={() => setCartOpen(false)} aria-label="Close cart"><X size={20} /></button></div>
        {cartAnnouncement && <div className="cart-confirmation" role="status" aria-live="polite" data-testid="status-cart-added"><Check size={16} /><span>{cartAnnouncement}</span><button type="button" onClick={() => setCartAnnouncement('')} aria-label="Dismiss added to bag message"><X size={14} /></button></div>}
        <div className="drawer-items">
          {cart.length === 0 ? <div className="empty-cart">Your bag is waiting.</div> : cart.map((item) => (
            <div className="cart-row" key={item.key}>
              <span className="cart-row-name">{item.name}</span><span className="cart-row-price">{money(item.price)}</span>
              <button className="remove-item" onClick={() => setCart((items) => items.filter((entry) => entry.key !== item.key))} aria-label={`Remove ${item.name}`} data-testid={`button-remove-cart-${item.key}`}><X size={16} /></button>
            </div>
          ))}
        </div>
        {cart.length > 0 && <div className="cart-total"><span>Subtotal</span><span>{money(total)}</span></div>}
      </aside>
    </>
  );
}

export default App;
